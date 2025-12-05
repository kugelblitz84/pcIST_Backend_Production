import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";
import PadStatement from "../models/padStatementModel.js";
import Invoice from "../models/invoiceModel.js";
import { getPuppeteerInstance } from "./puppeteerInstance.js";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const assetPath = (relativePath) => path.resolve(__dirname, "..", relativePath);

async function loadLogoBase64(path, size = 48) {
  const buf = await sharp(path)
    .resize(size, size, { fit: "contain" })
    .png()
    .toBuffer();
  return buf.toString("base64");
}

const generatePadPDFWithPuppeteer = async (opts = {}) => {
  const {
    uploadedPdfBuffer = null,
    statement = "",
    authorizers: authorizersParam = [],
    contactEmail = "",
    contactPhone = "",
    address = "Institute of Science & Technology (IST), Dhaka",
    serial: preGeneratedSerial = null,
    dateStr: preGeneratedDateStr = null,
  } = opts;

  if (!Buffer.isBuffer(uploadedPdfBuffer))
    throw new Error("You must provide uploadedPdfBuffer as a Buffer");

  // Load and prepare assets
  const istLogoPath = assetPath("assets/logos/IST_logo.png");
  const pcistLogoPath = assetPath("assets/logos/pcIST_logo.png");
  const [istLogoBase64, pcistLogoBase64] = await Promise.all([
    loadLogoBase64(istLogoPath),
    loadLogoBase64(pcistLogoPath),
  ]);

  const istLogoBytes = Buffer.from(istLogoBase64, "base64");
  const pcistLogoBytes = Buffer.from(pcistLogoBase64, "base64");

  // Create a new PDF document to avoid overlapping with existing content
  const decoratedPdf = await PDFDocument.create();

  // Embed fonts in the new PDF
  const font = await decoratedPdf.embedFont(StandardFonts.Helvetica);
  const boldFont = await decoratedPdf.embedFont(StandardFonts.HelveticaBold);

  // Embed logos in the new PDF
  const istImage = await decoratedPdf.embedPng(istLogoBytes);
  const pcistImage = await decoratedPdf.embedPng(pcistLogoBytes);

  // Serial and date handling
  let serial = preGeneratedSerial;
  let dateStr = preGeneratedDateStr;
  if (!serial || !dateStr) {
    const today = new Date();
    dateStr = today.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
    const currentCount = await PadStatement.countDocuments({});
    const nextNumber = currentCount + 1;
    const paddedNumber = nextNumber.toString().padStart(4, "0");
    serial = `pcIST-${today.getFullYear()}-${paddedNumber}`;
  }

  // Compose contact line
  const contactLine = [
    contactEmail ? `Email: ${contactEmail}` : null,
    contactPhone ? `Phone: ${contactPhone}` : null,
  ]
    .filter(Boolean)
    .join(" | ");

  // Decoration colors
  const blue = rgb(0.05, 0.45, 0.95);

  // Layout measurements for formal letter styling
  // Reduced top/bottom margins and slightly smaller header spacing
  const leftMargin = 40;
  const rightMargin = 40;
  const topMargin = 28;//28;
  const baseBottomPadding = 0; // minimal bottom padding to use more vertical space
  const signatureBottomPadding = 120;
  const signatureLineHeight = 90;
  const headerGap = 6; // minimal gap between meta line and horizontal rule
  const contentGap = 2; // minimal gap between rule and content
  // Increase overlap between slices to avoid splitting a text line between pages
  // ~60pt covers roughly 2 typical text lines, ensuring no partial line at page bottom
  const sliceGap = 60;

  // Crop margins from input PDF before embedding
  // This gives us full control over positioning without double margins
  const inputTopCrop = 50;    // crop this much from top of input PDF
  const inputBottomCrop = 40; // crop this much from bottom of input PDF
  const inputLeftCrop = 35;   // crop from left
  const inputRightCrop = 35;  // crop from right

  // Load the input PDF to crop it
  const inputPdf = await PDFDocument.load(uploadedPdfBuffer);
  const inputPages = inputPdf.getPages();

  const authorizers = (authorizersParam || []).slice(0, 3);
  for (let i = 0; i < inputPages.length; i++) {
    const inputPage = inputPages[i];
    const { width: origWidth, height: origHeight } = inputPage.getSize();

    // Calculate cropped dimensions
    const croppedWidth = origWidth - inputLeftCrop - inputRightCrop;
    const croppedHeight = origHeight - inputTopCrop - inputBottomCrop;

    // Set crop box on the input page to remove margins
    inputPage.setCropBox(
      inputLeftCrop,
      inputBottomCrop,
      croppedWidth,
      croppedHeight
    );
  }

  // Save cropped PDF and re-embed
  const croppedPdfBytes = await inputPdf.save();
  const embeddedPages = await decoratedPdf.embedPdf(croppedPdfBytes);

  for (let i = 0; i < embeddedPages.length; i++) {
    const embeddedPage = embeddedPages[i];
    const originalDims = embeddedPage.scale(1);
    // Use A4 dimensions for output page
    const width = 595.28;  // A4 width in points
    const height = 841.89; // A4 height in points

    const maxContentWidth = width - leftMargin - rightMargin;
    // Scale cropped content to fit our content area width
    const baseWidthScale = maxContentWidth / originalDims.width;
    // Zoom slightly to fill vertical space better
    const zoomMultiplier = 1.15;
    const maxZoomMultiplier = 1.5;

    let scale = Math.min(baseWidthScale * zoomMultiplier, baseWidthScale * maxZoomMultiplier);
    let finalScaledWidth = originalDims.width * scale;
    let finalScaledHeight = originalDims.height * scale;

    const isLastSourcePage = i === embeddedPages.length - 1;
    let shownHeight = 0;

    while (shownHeight < finalScaledHeight - 0.5) {
      const page = decoratedPdf.addPage([width, height]);

      // Pre-compute header layout so we can clip embedded content before drawing overlays
      // Smaller logos to avoid clipping header/meta when rendering from website
      const logoSize = 48;
      // position logos lower so they align with header text (not clipping date/serial)
      const logoY = height - topMargin - logoSize;

      const title = "Programming Club of IST (pcIST)";
      const titleSize = 20;
      const titleWidth = boldFont.widthOfTextAtSize(title, titleSize);
      const titleY = height - topMargin - 12;

      const sub = "Institute of Science & Technology — Dhaka";
      const subSize = 12;
      const subWidth = font.widthOfTextAtSize(sub, subSize);
      const contactSize = 11;
      const addressSize = 11;
      const metaSize = 10;

      let headerCursor = titleY;
      const subY = headerCursor - subSize - 4;
      headerCursor = subY;

      let contactY = null;
      let contactWidth = 0;
      if (contactLine) {
        headerCursor -= contactSize + 4;
        contactY = headerCursor;
        contactWidth = font.widthOfTextAtSize(contactLine, contactSize);
      }

      headerCursor -= addressSize + 4;
      const addressY = headerCursor;
      const addressWidth = font.widthOfTextAtSize(address, addressSize);

      headerCursor -= metaSize + 6;
      const metaY = headerCursor;
      const lineY = metaY - headerGap;
      const contentTop = lineY - contentGap;

      // After drawing first header, adjust scale if we have spare vertical room.
      if (shownHeight === 0) {
        const baseAreaHeight = Math.max(10, contentTop - baseBottomPadding);
        if (finalScaledHeight < baseAreaHeight) {
          const scaleToFill = baseAreaHeight / originalDims.height;
          scale = Math.min(scaleToFill, baseWidthScale * maxZoomMultiplier);
          finalScaledWidth = originalDims.width * scale;
          finalScaledHeight = originalDims.height * scale;
        }
      }

      let bottomPadding = baseBottomPadding;
      let contentAreaHeight = Math.max(10, contentTop - bottomPadding);
      const remainingHeight = finalScaledHeight - shownHeight;
      const isLastSliceCandidate = remainingHeight <= contentAreaHeight + 1;

      if (isLastSliceCandidate && isLastSourcePage && authorizers.length > 0) {
        bottomPadding = signatureBottomPadding;
        contentAreaHeight = Math.max(10, contentTop - bottomPadding);
      }

      // Compute slice height; enforce a minimum so we never show only a tiny sliver (partial line)
      const minSliceHeight = 40; // ~1.5 typical text lines; prevents partial-line exposure
      let sliceHeight = Math.min(contentAreaHeight, remainingHeight);
      if (sliceHeight <= 0) {
        // Unable to place content safely; break to avoid infinite loop.
        break;
      }
      // If the remaining is very small but non-final, push it entirely to the next page
      if (!isLastSliceCandidate && sliceHeight < minSliceHeight) {
        // Skip drawing this tiny slice; loop will terminate as shownHeight won't advance
        break;
      }

      // Center the embedded PDF within the content area (between left and right margins)
      // This ensures consistent side margins on all pages
      const drawX = (width - finalScaledWidth) / 2;

      const drawY = contentTop - finalScaledHeight + shownHeight;
  const sliceBottom = contentTop - sliceHeight;
  const skipGap = !isLastSliceCandidate ? sliceGap : 0;

      page.drawPage(embeddedPage, {
        x: drawX,
        y: drawY,
        width: finalScaledWidth,
        height: finalScaledHeight,
      });

      const maskTopHeight = Math.max(0, height - contentTop);
      if (maskTopHeight > 0) {
        page.drawRectangle({
          x: 0,
          y: contentTop,
          width: width,
          height: maskTopHeight,
          color: rgb(1, 1, 1),
          borderWidth: 0,
        });
      }

      const maskBottomHeight = Math.min(
        contentTop,
        Math.max(0, Math.min(contentTop, sliceBottom + skipGap))
      );
      if (maskBottomHeight > 0) {
        page.drawRectangle({
          x: 0,
          y: 0,
          width: width,
          height: maskBottomHeight,
          color: rgb(1, 1, 1),
          borderWidth: 0,
        });
      }

  // Header logos and title are drawn after masking so they sit above embedded content
      page.drawImage(istImage, {
        x: leftMargin,
        y: logoY,
        width: logoSize,
        height: logoSize,
      });
      page.drawImage(pcistImage, {
        x: width - rightMargin - logoSize,
        y: logoY,
        width: logoSize,
        height: logoSize,
      });

      page.drawText(title, {
        x: (width - titleWidth) / 2,
        y: titleY,
        size: titleSize,
        font: boldFont,
        color: rgb(0, 0, 0),
      });

      page.drawText(sub, {
        x: (width - subWidth) / 2,
        y: subY,
        size: subSize,
        font,
        color: rgb(0.3, 0.3, 0.3),
      });

      if (contactLine && contactY !== null) {
        page.drawText(contactLine, {
          x: (width - contactWidth) / 2,
          y: contactY,
          size: contactSize,
          font,
          color: rgb(0.3, 0.3, 0.3),
        });
      }

      // page.drawText(address, {
      //   x: (width - addressWidth) / 2,
      //   y: addressY,
      //   size: addressSize,
      //   font,
      //   color: rgb(0.3, 0.3, 0.3),
      // });

      page.drawText(`Date: ${dateStr}`, {
        x: leftMargin,
        y: metaY,
        size: metaSize,
        font: boldFont,
        color: rgb(0.19, 0.19, 0.19),
      });
      const serialText = `SN: ${serial}`;
      const serialWidth = boldFont.widthOfTextAtSize(serialText, metaSize);
      page.drawText(serialText, {
        x: width - rightMargin - serialWidth,
        y: metaY,
        size: metaSize,
        font: boldFont,
        color: rgb(0.19, 0.19, 0.19),
      });

      page.drawLine({
        start: { x: leftMargin, y: lineY },
        end: { x: width - rightMargin, y: lineY },
        thickness: 1.4,
        color: blue,
        opacity: 0.45,
      });

      // Decorative frame (after header so stroke sits on top of clipped content)
      page.drawRectangle({
        x: 15,
        y: 15,
        width: width - 30,
        height: height - 30,
        borderWidth: 1.5,
        borderColor: blue,
      });

      // Advance by the slice height, but if this is the last slice, advance by remaining to exit loop
      const advanceBy = isLastSliceCandidate ? remainingHeight : Math.max(0, sliceHeight - skipGap);
      shownHeight = Math.min(finalScaledHeight, shownHeight + advanceBy);
      
      // Safety: if we didn't advance, break to avoid infinite loop
      if (advanceBy <= 0) break;
    }
  }

  // Add signature section to last page
  const pages = decoratedPdf.getPages();
  const lastPage = pages[pages.length - 1];
  const sigLineHeight = signatureLineHeight;

  if (authorizers.length > 0) {
    const pageWidth = lastPage.getWidth();
    const lineWidth = 160;

    const computeCenters = () => {
      if (authorizers.length === 1) {
        return [pageWidth - rightMargin - lineWidth / 2];
      }
      if (authorizers.length === 2) {
        return [
          leftMargin + lineWidth / 2,
          pageWidth - rightMargin - lineWidth / 2,
        ];
      }
      return [
        leftMargin + lineWidth / 2,
        pageWidth / 2,
        pageWidth - rightMargin - lineWidth / 2,
      ];
    };

    const centers = computeCenters();

    authorizers.forEach((auth, index) => {
      const centerX = centers[index];
      const lineStartX = centerX - lineWidth / 2;

      lastPage.drawLine({
        start: { x: lineStartX, y: sigLineHeight },
        end: { x: lineStartX + lineWidth, y: sigLineHeight },
        thickness: 1.2,
        color: blue,
      });

      const nameText = auth.name || "";
      const nameSize = 12;
      const nameWidth = boldFont.widthOfTextAtSize(nameText, nameSize);
      lastPage.drawText(nameText, {
        x: centerX - nameWidth / 2,
        y: sigLineHeight - 18,
        size: nameSize,
        font: boldFont,
        color: rgb(0, 0, 0),
      });

      const roleText = auth.role || auth.title || "";
      const roleSize = 10;
      const roleWidth = font.widthOfTextAtSize(roleText, roleSize);
      lastPage.drawText(roleText, {
        x: centerX - roleWidth / 2,
        y: sigLineHeight - 34,
        size: roleSize,
        font,
        color: rgb(0.2, 0.2, 0.2),
      });

      const clubText = "pcIST";
      const clubSize = 9;
      const clubWidth = font.widthOfTextAtSize(clubText, clubSize);
      lastPage.drawText(clubText, {
        x: centerX - clubWidth / 2,
        y: sigLineHeight - 48,
        size: clubSize,
        font,
        color: rgb(0.3, 0.3, 0.3),
      });
    });
  }

  // Save the modified PDF
  const buffer = Buffer.from(await decoratedPdf.save());
  return { buffer, serial, dateStr };
};

// const generatePadPDFWithPuppeteer = async (opts = {}) => {
//   const {
//     statement = '',
//     authorizers: authorizersParam = [],
//     contactEmail = '',
//     contactPhone = '',
//     address = 'Institute of Science & Technology (IST), Dhaka',
//     serial: preGeneratedSerial = null,
//     dateStr: preGeneratedDateStr = null,
//     uploadedPdfBuffer = null,
//   } = opts;
//   const istLogoPath = assetPath('assets/logos/IST_logo.png');
//   const pcistLogoPath = assetPath('assets/logos/pcIST_logo.png');

//   // Process logos with smaller, consistent sizing
//   const [istBuf, pcistBuf] = await Promise.all([
//     sharp(istLogoPath)
//       .resize(56, 56, { // Reduced from 76x76 to 56x56 (about 25% smaller)
//         fit: 'contain',
//         background: { r: 255, g: 255, b: 255, alpha: 0 } // Transparent background
//       })
//       .png({
//         compressionLevel: 6, // More stable compression
//         quality: 90,
//         adaptiveFiltering: false // Consistent filtering
//       })
//       .toBuffer(),
//     sharp(pcistLogoPath)
//       .resize(56, 56, { // Reduced from 76x76 to 56x56 (about 25% smaller)
//         fit: 'contain',
//         background: { r: 255, g: 255, b: 255, alpha: 0 } // Transparent background
//       })
//       .png({
//         compressionLevel: 6, // More stable compression
//         quality: 90,
//         adaptiveFiltering: false // Consistent filtering
//       })
//       .toBuffer(),
//   ]);
//   const istData = `data:image/png;base64,${istBuf.toString('base64')}`;
//   const pcistData = `data:image/png;base64,${pcistBuf.toString('base64')}`;

//   // Use pre-generated values if provided, otherwise generate them
//   let serial, dateStr;

//   if (preGeneratedSerial && preGeneratedDateStr) {
//     serial = preGeneratedSerial;
//     dateStr = preGeneratedDateStr;
//   } else {
//     // Fallback to original generation logic for backward compatibility
//     const today = new Date();
//     dateStr = today.toLocaleDateString('en-GB', {
//       day: '2-digit',
//       month: 'long',
//       year: 'numeric',
//     });

//     // Get current count from database and generate incremental serial number
//     const currentCount = await PadStatement.countDocuments({});
//     const nextNumber = currentCount + 1;
//     const paddedNumber = nextNumber.toString().padStart(4, '0');
//     serial = `pcIST-${today.getFullYear()}-${paddedNumber}`;
//   }

//   const hasUploadedPdf = Buffer.isBuffer(uploadedPdfBuffer) && uploadedPdfBuffer.length > 0;

//   const paragraphs = hasUploadedPdf
//     ? ''
//     : String(statement)
//         .split(/\n\n+/)
//         .map((p) => p.trim())
//         .filter(Boolean)
//         .map((p) => `<p class="para">${p.replace(/\n/g, '<br/>')}</p>`)
//         .join('\n');

//   const uploadedPdfBase64 = hasUploadedPdf
//     ? `data:application/pdf;base64,${uploadedPdfBuffer.toString('base64')}`
//     : null;

//   const contentBody = hasUploadedPdf
//     ? `<div class="embedded-pdf-wrapper">
//         <object class="embedded-pdf" data="${uploadedPdfBase64}#toolbar=0&navpanes=0&scrollbar=0" type="application/pdf">
//           <embed src="${uploadedPdfBase64}#toolbar=0&navpanes=0&scrollbar=0" type="application/pdf" />
//           <p>Your browser does not support embedded PDFs. Please download the attachment instead.</p>
//         </object>
//       </div>`
//     : paragraphs;

//   const contactLine = [
//     contactEmail ? `Email: ${contactEmail}` : null,
//     contactPhone ? `Phone: ${contactPhone}` : null,
//   ]
//     .filter(Boolean)
//     .join(' | ');

//   // Handle authorizers array
//   let authorizers = [];
//   if (Array.isArray(authorizersParam) && authorizersParam.length > 0) {
//     authorizers = authorizersParam
//       .slice(0, 3)
//       .map((a) => ({ name: a.name || '', role: a.role || a.title || '' }));
//   }
//   authorizers = authorizers.slice(0, 3);

//   const signatureHtml = (() => {
//     if (authorizers.length === 0) return '';
//     if (authorizers.length === 1) {
//       const a = authorizers[0];
//       return `<div class="signatures single"><div class="sig center"><div class="sig-line"></div><div class="sig-name">${a.name || ''}</div><div class="sig-role">${a.role || ''}</div><div>pcIST</div></div></div>`;
//     }
//     if (authorizers.length === 2) {
//       const left = authorizers[0];
//       const right = authorizers[1];
//       return `<div class="signatures two">
//         <div class="sig left">
//           <div class="sig-line"></div>
//           <div class="sig-name">${left.name || ''}</div>
//           <div class="sig-role">${left.role || ''}</div>
//           <div>pcIST</div>
//         </div>
//         <div class="sig right">
//           <div class="sig-line"></div>
//           <div class="sig-name">${right.name || ''}</div>
//           <div class="sig-role">${right.role || ''}</div>
//           <div>pcIST</div>
//         </div>
//       </div>`;
//     }
//     // three
//     const a0 = authorizers[0];
//     const a1 = authorizers[1];
//     const a2 = authorizers[2];
//     return `<div class="signatures three">
//       <div class="sig left">
//         <div class="sig-line"></div>
//         <div class="sig-name">${a0.name || ''}</div>
//         <div class="sig-role">${a0.role || ''}</div>
//         <div>pcIST</div>
//       </div>
//       <div class="sig center">
//         <div class="sig-line"></div>
//         <div class="sig-name">${a1.name || ''}</div>
//         <div class="sig-role">${a1.role || ''}</div>
//         <div>pcIST</div>
//       </div>
//       <div class="sig right">
//         <div class="sig-line"></div>
//         <div class="sig-name">${a2.name || ''}</div>
//         <div class="sig-role">${a2.role || ''}</div>
//         <div>pcIST</div>
//       </div>
//     </div>`;
//   })();

//   const html = `
// <!doctype html>
// <html lang="en">
// <head>
// <meta charset="utf-8" />
// <meta name="viewport" content="width=device-width,initial-scale=1" />
// <title>pcIST — High Tech Letter</title>
// <style>
//   @page { size: A4; margin: 15mm 12mm 20mm 12mm; }
//   html,body{height:100%;margin:0;background:#fff;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,"Noto Sans",sans-serif;color:#1f2937;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;text-rendering:optimizeLegibility;}
//   :root{
//     --blue-1:#0d6efd;
//     --blue-2:#4dabf7;
//     --cyan:#0dcaf0;
//     --accent:linear-gradient(135deg,var(--blue-1),var(--blue-2));
//   }

//   /* Mobile-optimized styling for consistent PDF rendering */
//   * {
//     -webkit-print-color-adjust: exact !important;
//     color-adjust: exact !important;
//     box-sizing: border-box;
//   }

//   .page{position:relative;box-sizing:border-box;padding:10mm 18mm 16mm 18mm;overflow:visible;}

//   .frame{position:fixed;inset:6px;border-radius:8px;border:1px solid rgba(13,110,253,0.12);
//     box-shadow:0 3px 12px rgba(13,110,253,0.03),inset 0 1px 0 rgba(255,255,255,0.12);pointer-events:none;z-index:0;}

//   .side-strip{position:fixed;top:0;bottom:0;width:4mm;z-index:0;pointer-events:none; /* Reduced from 6mm to 4mm */
//     filter:drop-shadow(0 2px 8px rgba(13,110,253,0.04));}
//   .side-strip.left{left:0;background:linear-gradient(180deg,rgba(13,110,253,0.15),rgba(13,110,253,0.03));} /* Reduced opacity */
//   .side-strip.right{right:0;background:linear-gradient(180deg,rgba(13,110,253,0.15),rgba(13,110,253,0.03));} /* Reduced opacity */
//   .side-strip svg g{stroke-width:0.4 !important;} /* Reduced from 0.6 to 0.4 */

//   /* corner svgs sit behind header content but above the frame; logos will be placed above them */
//   .corner-svgs{position:fixed;left:0;top:0;width:210mm;height:297mm;z-index:5;pointer-events:none;}
//   /* explicit bottom-right triangle SVG to guarantee visibility (bigger, mirrored) */
//   .corner-br-svg{position:fixed;right:0;bottom:0;width:96px;height:96px;z-index:5;pointer-events:none;}
//   .corner-br-svg svg{width:100%;height:100%;display:block}

//   header{text-align:center;padding-top:12mm;margin-bottom:2mm;position:relative;z-index:5;}
//   .logo{
//     width:56px; /* Reduced from 76px */
//     height:56px; /* Reduced from 76px */
//     object-fit:contain;
//     object-position:center;
//     position:absolute;
//     top:12mm; /* Moved down slightly to maintain balance */
//     z-index:6;
//     image-rendering:high-quality;
//     image-rendering:-webkit-optimize-contrast;
//     image-rendering:crisp-edges;
//     max-width:56px; /* Reduced from 76px */
//     max-height:56px; /* Reduced from 76px */
//   }
//   .logo.left{left:6mm;} /* Moved further left to increase spacing */
//   .logo.right{right:6mm;} /* Moved further right to increase spacing */
//   header h1{margin:6px 0 2px;font-size:20px;font-weight:700;position:relative;z-index:6;}
//   header .sub{color:#6b7280;font-size:11px;margin-bottom:4px;}
//   header .contact{color:#6b7280;font-size:11px;margin-bottom:6px;}
//   .rule{width:78%;height:2px;margin:6px auto 10px;background:linear-gradient(90deg,var(--blue-1),var(--blue-2));border-radius:2px;}

//   .meta{display:flex;justify-content:space-between;font-size:12px;color:#111827;margin:6px 0 8px;}
//   .main .content{font-size:11.6px;line-height:1.48;text-align:justify;color:#111827;}
//   .main .content .para{margin-bottom:8px;}
//   .embedded-pdf-wrapper{margin-top:12px;min-height:220mm;display:flex;flex-direction:column;gap:8px;}
//   .embedded-pdf{width:100%;flex:1 1 auto;min-height:240mm;border:none;}
//   .embedded-pdf-wrapper p{font-size:11px;color:#374151;text-align:center;}

//   /* signature area: control layout for 1/2/3 signatures */
//   .signatures{position:relative;display:flex;justify-content:flex-start;align-items:flex-end;gap:36px;margin-top:18mm;z-index:5}
//   .signatures .sig{width:220px;display:flex;flex-direction:column;align-items:flex-start;text-align:left}
//   .signatures .sig.center{align-items:center;text-align:center}
//   .signatures .sig.right{align-items:flex-end;text-align:right}
//   .signatures .sig-line{width:140px;height:2px;background:var(--blue-1);margin-bottom:6px}
//   .signatures .sig-name{font-weight:800;margin-bottom:4px;font-size:12px}
//   .signatures .sig-role{font-size:11px;margin-bottom:2px;color:#374151}
//   /* layout rules per signature count - following exact requirements */
//   /* 1 signature: bottom right */
//   .signatures.single{justify-content:flex-end}
//   /* 2 signatures: opposite sides of the page */
//   .signatures.two{justify-content:space-between}
//   /* 3 signatures: two at sides and one in middle */
//   .signatures.three{justify-content:space-between}
// </style>
// </head>
// <body>
//   <div class="page" role="document">
//     <div class="frame" aria-hidden="true"></div>

//     <div class="side-strip left" aria-hidden="true">
//       <!-- Left strip SVG unchanged -->
//       <svg width="100%" height="100%" viewBox="0 0 120 842" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
//         <defs><linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
//           <stop offset="0" stop-color="#0d6efd" stop-opacity="0.95"/>
//           <stop offset="1" stop-color="#0dcaf0" stop-opacity="0.6"/>
//         </linearGradient></defs>
//         <rect x="0" y="0" width="120" height="842" fill="url(#g1)" opacity="0.12"/>
//         <g stroke="#ffffff" stroke-opacity="0.22" stroke-width="1.2" fill="none">
//           <path d="M26 40 L26 90 L50 90 L50 150" stroke-linecap="round"/>
//           <circle cx="26" cy="40" r="2.2" fill="#fff"/>
//           <path d="M26 220 L26 300 L70 300" stroke-linecap="round"/>
//           <circle cx="26" cy="220" r="2.2" fill="#fff"/>
//           <path d="M26 420 L26 500 L48 500 L48 620" stroke-linecap="round"/>
//         </g>
//       </svg>
//     </div>

//     <div class="side-strip right" aria-hidden="true">
//       <!-- Right strip SVG unchanged -->
//       <svg width="100%" height="100%" viewBox="0 0 120 842" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
//         <defs><linearGradient id="g2" x1="0" y1="0" x2="0" y2="1">
//           <stop offset="0" stop-color="#4dabf7" stop-opacity="0.95"/>
//           <stop offset="1" stop-color="#0d6efd" stop-opacity="0.6"/>
//         </linearGradient></defs>
//         <rect x="0" y="0" width="120" height="842" fill="url(#g2)" opacity="0.12"/>
//         <g stroke="#ffffff" stroke-opacity="0.22" stroke-width="1.2" fill="none">
//           <path d="M94 60 L66 60 L66 120 L94 120" stroke-linecap="round"/>
//           <circle cx="94" cy="60" r="2.2" fill="#fff"/>
//           <path d="M94 240 L94 320 L40 320" stroke-linecap="round"/>
//           <circle cx="94" cy="240" r="2.2" fill="#fff"/>
//           <path d="M94 440 L94 560 L68 560 L68 680" stroke-linecap="round"/>
//         </g>
//       </svg>
//     </div>

//     <!-- Updated corner triangles -->
//     <div class="corner-svgs" aria-hidden="true">
//       <svg viewBox="0 0 210 297" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg" style="position:absolute;left:0;top:0;width:210mm;height:297mm;">
//         <defs>
//           <linearGradient id="triGrad" x1="0" y1="0" x2="1" y2="1">
//             <stop offset="0" stop-color="#0d6efd"/>
//             <stop offset="1" stop-color="#4dabf7"/>
//           </linearGradient>
//           <filter id="soft" x="-50%" y="-50%" width="200%" height="200%">
//             <feGaussianBlur stdDeviation="8" result="b"/>
//             <feBlend in="SourceGraphic" in2="b" mode="normal"/>
//           </filter>
//         </defs>

//   <!-- Top-left smaller (reduced size and opacity) -->
//   <path d="M0 0 L42 0 L0 42 Z" fill="url(#triGrad)" opacity="0.75" filter="url(#soft)"></path>
//   <g transform="translate(4,6) scale(0.6)" stroke="rgba(255,255,255,0.18)" stroke-width="0.8" fill="none">
//           <path d="M6 12 H36 V24 H48" stroke-linecap="round" stroke-linejoin="round"/>
//           <circle cx="6" cy="12" r="1.4" fill="#fff"/>
//         </g>

//         <!-- Bottom-right mirrored (match top-left size) + circuit details -->
//         <g transform="translate(210,297) rotate(180)">
//           <path d="M0 0 L42 0 L0 42 Z" fill="url(#triGrad)" opacity="0.75" filter="url(#soft)"></path>
//           <g transform="translate(6,8) scale(0.6)" stroke="rgba(255,255,255,0.18)" stroke-width="0.8" fill="none">
//             <path d="M6 12 H36 V24 H48" stroke-linecap="round" stroke-linejoin="round"/>
//             <circle cx="6" cy="12" r="1.4" fill="#fff"/>
//             <path d="M12 30 H32 V40 H44" stroke-linecap="round" stroke-linejoin="round"/>
//             <circle cx="12" cy="30" r="1.4" fill="#fff"/>
//           </g>
//         </g>
//       </svg>
//     </div>

//     <header>
//       <img class="logo left" src="${istData}" alt="IST Logo" />
//       <img class="logo right" src="${pcistData}" alt="pcIST Logo" />
//       <h1>Programming Club of IST (pcIST)</h1>
//       <div class="sub">Institute of Science &amp; Technology — Dhaka</div>
//       ${contactLine ? `<div class="contact">${contactLine}</div>` : ''}
//       <div class="rule"></div>
//     </header>

//     <main class="main">
//       <div class="meta">
//         <div>Date: <strong>${dateStr}</strong></div>
//         <div>SN: <strong>${serial}</strong></div>
//       </div>
//       <section class="content" id="content">
//         ${contentBody}
//       </section>
//   </main>

//     <!-- signature will be injected at the bottom of the last page by a measurement pass -->
//     <!-- fixed bottom-right triangle (explicit SVG) -->
//     <div class="corner-br-svg" aria-hidden="true">
//   <svg viewBox="0 0 96 96" xmlns="http://www.w3.org/2000/svg">
//         <defs>
//           <linearGradient id="triGradBR" x1="0" y1="0" x2="1" y2="1">
//             <stop offset="0" stop-color="#0d6efd"/>
//             <stop offset="1" stop-color="#4dabf7"/>
//           </linearGradient>
//         </defs>
//         <!-- rotated so triangle points inward from bottom-right -->
//         <g transform="translate(96,96) rotate(180)">
//           <path d="M0 0 L96 0 L0 96 Z" fill="url(#triGradBR)" opacity="0.98"/>
//           <g transform="translate(10,12) scale(0.9)" stroke="rgba(255,255,255,0.22)" stroke-width="1" fill="none">
//           <path d="M6 12 H48 V28 H60" stroke-linecap="round" stroke-linejoin="round"/>
//           <circle cx="6" cy="12" r="1.6" fill="#fff"/>
//           </g>
//         </g>
//       </svg>
//     </div>
//   </div>
// </body>
// </html>

//   `;

//   // let puppeteer;
//   // try {
//   //   puppeteer = (await import('puppeteer')).default;
//   // } catch {
//   //   throw new Error('Puppeteer is not installed. Run `npm install puppeteer`.');
//   // }

//   // // Check if running on Heroku or other cloud environments
//   // const isHeroku = process.env.DYNO || process.env.NODE_ENV === 'production';

//   // const launchArgs = [
//   //   '--no-sandbox',
//   //   '--disable-setuid-sandbox',
//   //   '--disable-dev-shm-usage', // Overcome limited resource problems
//   //   '--disable-gpu',
//   //   '--disable-features=VizDisplayCompositor',
//   //   '--run-all-compositor-stages-before-draw',
//   //   '--disable-background-timer-throttling',
//   //   '--disable-renderer-backgrounding',
//   //   '--disable-backgrounding-occluded-windows',
//   //   '--disable-ipc-flooding-protection',
//   //   '--font-render-hinting=none', // Consistent font rendering
//   //   '--force-color-profile=srgb', // Consistent color rendering
//   //   '--disable-font-subpixel-positioning', // More consistent text rendering
//   // ];

//   // // Add Heroku-specific optimizations
//   // if (isHeroku) {
//   //   launchArgs.push(
//   //     '--memory-pressure-off',
//   //     '--max_old_space_size=4096',
//   //     '--single-process' // Sometimes helps with consistency on Heroku
//   //   );
//   // }

//   // const execPath =
//   //   process.env.PUPPETEER_EXECUTABLE_PATH ||
//   //   process.env.GOOGLE_CHROME_BIN ||
//   //   undefined;

//   // const browser = await puppeteer.launch({
//   //   headless: true,
//   //   args: launchArgs,
//   //   executablePath: execPath,
//   //   defaultViewport: null, // Use default viewport
//   //   ignoreDefaultArgs: ['--disable-extensions'], // Allow better rendering
//   // });

//   try {
//     const isHeroku = process.env.DYNO || process.env.NODE_ENV === 'production';
//     const browser = await getPuppeteerInstance();
//     const page = await browser.newPage();

//     // Set viewport for consistent rendering across devices
//     await page.setViewport({
//       width: 794, // A4 width in pixels at 96 DPI
//       height: 1123, // A4 height in pixels at 96 DPI
//       deviceScaleFactor: 1,
//     });

//     // Optimize page for PDF generation
//     await page.emulateMediaType('print');

//     // Set longer timeout for Heroku
//     const timeout = isHeroku ? 30000 : 10000;

//     await page.setContent(html, {
//       waitUntil: 'networkidle0',
//       timeout: timeout
//     });

//     // Add extra wait time for fonts and images to load completely
//     await new Promise(resolve => setTimeout(resolve, isHeroku ? 2000 : 1000));

//     // If there are signatures, do a measurement pass to pin them to the bottom of the last page
//     if (signatureHtml && String(signatureHtml).trim()) {
//       await page.evaluate((sigHtml) => {
//         const pxPerMm = 96 / 25.4;
//         const pageHeightMm = 297;
//         const topMarginMm = 15; // matches @page margin and pdf margin
//         const bottomMarginMm = 20;
//         const printablePx = (pageHeightMm - topMarginMm - bottomMarginMm) * pxPerMm;

//   const pageEl = document.querySelector('.page');
//         if (!pageEl) return;

//         const contentHeight = pageEl.scrollHeight;
//         const pages = Math.max(1, Math.ceil(contentHeight / printablePx));

//         // create a hidden measurement node to get signature height
//         const meas = document.createElement('div');
//         meas.style.position = 'absolute';
//         meas.style.visibility = 'hidden';
//         meas.style.left = '0';
//         meas.innerHTML = sigHtml;
//         pageEl.appendChild(meas);
//         const sigHeight = Math.ceil(meas.getBoundingClientRect().height);
//         pageEl.removeChild(meas);

//   const cs = getComputedStyle(pageEl);
//   const padLeft = parseFloat(cs.paddingLeft || '0');
//   const padRight = parseFloat(cs.paddingRight || '0');
//   const padBottom = parseFloat(cs.paddingBottom || '0');

//   // move signatures left by ~20% - minimal left padding, keep right padding for safety
//   const extraPadMm = 6; // total: 0.5mm left, 5.5mm right - moves signatures significantly left
//   const leftPadMm = 0//0.5;
//   const rightPadMm = 18//5.5;
//   const leftPadPx = Math.round(leftPadMm * pxPerMm);
//   const rightPadPx = Math.round(rightPadMm * pxPerMm);

//   // compute top (px) relative to the top of .page so signature sits at bottom of last printable page
//   const desiredTop = Math.max((pages * printablePx) - sigHeight - padBottom, pageEl.scrollHeight - sigHeight);

//   const container = document.createElement('div');
//   container.id = '__signature_float';
//   container.style.position = 'absolute';
//   container.style.top = desiredTop + 'px';
//   // position container at base left with asymmetric padding favoring left
//   const baseLeft = padLeft + leftPadPx;
//   container.style.left = baseLeft + 'px';
//   container.style.width = Math.max(0, pageEl.clientWidth - padLeft - padRight - leftPadPx - rightPadPx) + 'px';
//   container.style.paddingLeft = leftPadPx + 'px';
//   container.style.paddingRight = rightPadPx + 'px';
//   container.innerHTML = sigHtml;
//   pageEl.appendChild(container);
//       }, signatureHtml);
//       // Allow more time for layout to settle on Heroku
//       const settleTime = isHeroku ? 200 : 50;
//       await page.evaluate((time) => new Promise((r) => setTimeout(r, time)), settleTime);
//     }

//     const buffer = await page.pdf({
//       format: 'A4',
//       printBackground: true,
//       margin: { top: '15mm', bottom: '20mm', left: '12mm', right: '12mm' },
//       preferCSSPageSize: true,
//       displayHeaderFooter: false,
//       scale: 1.0, // Consistent scaling across devices
//       width: '210mm', // Explicit A4 width
//       height: '297mm', // Explicit A4 height
//     });
//     await page.close();
//     //await browser.close();
//     return { buffer, serial, dateStr };
//   } catch (err) {
//     //await browser.close();
//     throw err;
//   }
// };

const generateInvoicePDFWithPuppeteer = async (opts = {}) => {
  const {
    products = [], // [{ description, unitPrice, quantity }]
    authorizerName = "",
    authorizerDesignation = "",
    contactEmail = "",
    contactPhone = "",
    address = "Institute of Science & Technology (IST), Dhaka",
    issueDate = null, // The original issue date (from database or null for new invoice)
  } = opts;

  // Load logos
  const pcistLogoPath = assetPath("assets/logos/pcIST_logo.png");
  const [pcistBuf] = await Promise.all([
    sharp(pcistLogoPath)
      .resize(60, 60, {
        fit: "contain",
        background: { r: 255, g: 255, b: 255, alpha: 0 }, // Transparent background
      })
      .png({
        compressionLevel: 6, // More stable compression
        quality: 90,
        adaptiveFiltering: false, // Consistent filtering
      })
      .toBuffer(),
  ]);
  const pcistData = `data:image/png;base64,${pcistBuf.toString("base64")}`;

  const today = new Date();

  // Issue date: use provided issueDate or current date for new invoices
  const issueDateObj = issueDate ? new Date(issueDate) : today;
  const issueDateStr = issueDateObj.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  // Generated date: always current date
  const generatedDateStr = today.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  // Generate invoice serial number using issue date year
  const currentCount = await Invoice.countDocuments({});
  const nextNumber = currentCount + 1;
  const paddedNumber = nextNumber.toString().padStart(4, "0");
  const serial = `INV-${issueDateObj.getFullYear()}-${paddedNumber}`;

  // Calculate totals for each product and grand total
  let grandTotal = 0;
  const productRows = products
    .map((product, index) => {
      const quantity = product.quantity || 1;
      const unitPrice = parseFloat(product.unitPrice) || 0;
      const total = quantity * unitPrice;
      grandTotal += total;

      return `
      <tr>
        <td class="text-center">${index + 1}</td>
        <td>${product.description || ""}</td>
        <td class="text-center">${quantity}</td>
        <td class="text-right">${unitPrice.toFixed(2)}</td>
        <td class="text-right">${total.toFixed(2)}</td>
      </tr>
    `;
    })
    .join("");

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        body {
          font-family: 'Times New Roman', serif;
          line-height: 1.4;
          color: #333;
          background: white;
        }
        
        .page {
          width: 210mm;
          max-width: 210mm;
          margin: 0 auto;
          padding: 15mm 12mm 20mm 12mm;
          background: white;
          position: relative;
        }
        
        .header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 25px;
          padding-bottom: 15px;
          border-bottom: 2px solid #1e3a8a;
        }
        
        .header-left {
          display: flex;
          align-items: center;
          gap: 15px;
        }
        
        .logo {
          width: 60px;
          height: 60px;
          object-fit: contain;
        }
        
        .org-info h1 {
          font-size: 24px;
          font-weight: bold;
          color: #1e3a8a;
          margin-bottom: 5px;
        }
        
        .org-info p {
          font-size: 12px;
          color: #666;
          margin: 0;
        }
        
        .header-right {
          text-align: right;
        }
        
        .invoice-title {
          font-size: 32px;
          font-weight: bold;
          color: #1e3a8a;
          margin-bottom: 5px;
        }
        
        .invoice-meta {
          font-size: 14px;
          color: #666;
        }
        
        .products-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 30px;
          font-size: 14px;
        }
        
        .products-table th {
          background-color: #1e3a8a;
          color: white;
          padding: 12px 8px;
          text-align: left;
          font-weight: bold;
          border: 1px solid #1e3a8a;
        }
        
        .products-table td {
          padding: 10px 8px;
          border: 1px solid #d1d5db;
          vertical-align: top;
        }
        
        .products-table tr:nth-child(even) {
          background-color: #f9fafb;
        }
        
        .text-center { text-align: center; }
        .text-right { text-align: right; }
        
        .total-section {
          margin-left: auto;
          width: 300px;
          margin-bottom: 30px;
        }
        
        .total-row {
          display: flex;
          justify-content: space-between;
          padding: 8px 0;
          border-bottom: 1px solid #e5e7eb;
        }
        
        .grand-total {
          background-color: #1e3a8a;
          color: white;
          padding: 12px;
          font-weight: bold;
          font-size: 16px;
        }
        
        .signature-section {
          margin-top: 50px;
          display: flex;
          justify-content: flex-end;
        }
        
        .signature-box {
          text-align: center;
          min-width: 200px;
        }
        
        .signature-line {
          border-top: 2px solid #374151;
          margin-bottom: 8px;
          margin-top: 60px;
        }
        
        .signature-name {
          font-weight: bold;
          font-size: 14px;
          margin-bottom: 3px;
        }
        
        .signature-designation {
          font-size: 12px;
          color: #666;
        }
        
        .footer {
          margin-top: 30px;
          text-align: center;
          font-size: 12px;
          color: #666;
          border-top: 1px solid #e5e7eb;
          padding-top: 10px;
        }
        
        @media print {
          .page {
            margin: 0;
            box-shadow: none;
          }
        }
      </style>
    </head>
    <body>
      <div class="page">
        <div class="header">
          <div class="header-left">
            <img src="${pcistData}" alt="pcIST Logo" class="logo">
            <div class="org-info">
              <h1>Programming Club of IST</h1>
              <p>${address}</p>
              ${contactEmail ? `<p>Email: ${contactEmail}</p>` : ""}
              ${contactPhone ? `<p>Phone: ${contactPhone}</p>` : ""}
            </div>
          </div>
          <div class="header-right">
            <div class="invoice-title">INVOICE</div>
            <div class="invoice-meta">
              <div><strong>Invoice #:</strong> ${serial}</div>
              <div><strong>Issue Date:</strong> ${issueDateStr}</div>
            </div>
          </div>
        </div>
        
        <table class="products-table">
          <thead>
            <tr>
              <th style="width: 50px;">S/N</th>
              <th>Description</th>
              <th style="width: 80px;">Qty</th>
              <th style="width: 100px;">Unit Price</th>
              <th style="width: 100px;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${productRows}
          </tbody>
        </table>
        
        <div class="total-section">
          <div class="total-row grand-total">
            <span>Grand Total:</span>
            <span>${grandTotal.toFixed(2)} tk</span>
          </div>
        </div>
        
        ${
          authorizerName
            ? `
        <div class="signature-section">
          <div class="signature-box">
            <div class="signature-line"></div>
            <div class="signature-name">${authorizerName}</div>
            ${
              authorizerDesignation
                ? `<div class="signature-designation">${authorizerDesignation}</div>`
                : ""
            }
          </div>
        </div>
        `
            : ""
        }
        
        <div class="footer">
          <p>This is a computer generated invoice from Programming Club of IST</p>
          <p>Thank you for your business!</p>
        </div>
      </div>
    </body>
    </html>
  `;

  let browser;
  try {
    // Check if running on Heroku or other cloud environments
    const isHeroku = process.env.DYNO || process.env.NODE_ENV === "production";

    const puppeteer = await import("puppeteer");

    const launchArgs = [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--disable-features=VizDisplayCompositor",
      "--run-all-compositor-stages-before-draw",
      "--disable-background-timer-throttling",
      "--disable-renderer-backgrounding",
      "--disable-backgrounding-occluded-windows",
      "--disable-ipc-flooding-protection",
      "--font-render-hinting=none",
      "--force-color-profile=srgb",
      "--disable-font-subpixel-positioning",
    ];

    // Add Heroku-specific optimizations
    if (isHeroku) {
      launchArgs.push(
        "--memory-pressure-off",
        "--max_old_space_size=4096",
        "--single-process"
      );
    }

    browser = await puppeteer.default.launch({
      headless: true,
      args: launchArgs,
      defaultViewport: null,
      ignoreDefaultArgs: ["--disable-extensions"],
    });

    const page = await browser.newPage();

    // Set viewport for consistent rendering across devices
    await page.setViewport({
      width: 794, // A4 width in pixels at 96 DPI
      height: 1123, // A4 height in pixels at 96 DPI
      deviceScaleFactor: 1,
    });

    // Optimize page for PDF generation
    await page.emulateMediaType("print");

    // Set longer timeout for Heroku
    const timeout = isHeroku ? 30000 : 10000;

    // First pass: render without signature and footer to measure content height
    const tempHtml = html.replace(
      /<div class="signature-section">[\s\S]*?<\/div>\s*<div class="footer">[\s\S]*?<\/div>/,
      ""
    );

    await page.setContent(tempHtml, {
      waitUntil: "domcontentloaded",
      timeout: timeout,
    });

    // Add extra wait time for fonts and images to load completely
    await new Promise((resolve) => setTimeout(resolve, isHeroku ? 2000 : 1000));

    // Measure the actual content height
    const measurements = await page.evaluate(() => {
      const pageElement = document.querySelector(".page");
      if (!pageElement) return { contentHeight: 0, pageHeight: 0 };

      // Get the actual content height
      const contentHeight = pageElement.scrollHeight;

      // Calculate available page height (A4 = 297mm - margins)
      const pageHeightMm = 297 - 15 - 15; // Top and bottom margins
      const pageHeightPx = (pageHeightMm * 96) / 25.4; // Convert mm to px

      return { contentHeight, pageHeightPx };
    });

    // Calculate position for signature and footer (ensure they're at the bottom)
    const signatureSpaceNeeded = 90; // Reduced space needed for signature + footer (was 120)
    const minTopPosition = measurements.contentHeight + 30; // Content + some gap
    const maxTopPosition = measurements.pageHeightPx - signatureSpaceNeeded;
    const signatureTopPosition = Math.max(minTopPosition, maxTopPosition);

    // Second pass: create final HTML with positioned signature and footer
    const finalHtml = html.replace(
      /<div class="signature-section">[\s\S]*?<\/div>\s*<div class="footer">[\s\S]*?<\/div>/,
      `<div style="position: absolute; top: ${signatureTopPosition}px; right: 0; width: 100%;">
          <div class="signature-section" style="margin-top: 0; margin-bottom: 10px;">
            <div class="signature-box">
              <div class="signature-line"></div>
              <div class="signature-name">${authorizerName}</div>
              <div class="signature-designation">${authorizerDesignation}</div>
            </div>
          </div>
          <div class="footer" style="margin-top: 0; margin-bottom: 0; text-align: center;">
            This is a computer generated invoice and does not require a physical signature.<br/>
            Invoice ID: ${serial} | Generated on: ${generatedDateStr}
          </div>
        </div>`
    );

    await page.setContent(finalHtml, {
      waitUntil: "domcontentloaded",
      timeout: timeout,
    });

    // Add extra wait time for fonts and images to load completely
    await new Promise((resolve) => setTimeout(resolve, isHeroku ? 2000 : 1000));

    const buffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "15mm", bottom: "25mm", left: "12mm", right: "12mm" },
      preferCSSPageSize: true,
      displayHeaderFooter: false,
      scale: 1.0, // Consistent scaling across devices
      width: "210mm", // Explicit A4 width
      height: "297mm", // Explicit A4 height
    });

    await page.close();
    await browser.close();

    return { buffer, serial, issueDateStr, generatedDateStr, grandTotal };
  } catch (err) {
    if (browser) await browser.close();
    throw err;
  }
};

export { generatePadPDFWithPuppeteer, generateInvoicePDFWithPuppeteer };
