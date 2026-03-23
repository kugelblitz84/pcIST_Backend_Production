import path from "path";
import { fileURLToPath } from "url";
import { promises as fs } from "fs";
import os from "os";
import { execFile } from "child_process";
import { promisify } from "util";
import { randomUUID } from "crypto";
import sharp from "sharp";
import { getPuppeteerInstance } from "./puppeteerInstance.js";
import PadStatement from "../models/padStatementModel.js";
import Invoice from "../models/invoiceModel.js";

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const assetPath = (relativePath) => path.resolve(__dirname, "..", relativePath);

async function loadLogoBase64(filePath, size = 48) {
  const buf = await sharp(filePath)
    .resize(size, size, { fit: "contain" })
    .png()
    .toBuffer();
  return buf.toString("base64");
}

async function toImageDataUri(input, options = {}) {
  if (!input) return "";

  const {
    width = null,
    height = null,
    fit = "contain",
  } = options;

  let imageBuffer;

  if (Buffer.isBuffer(input)) {
    imageBuffer = input;
  } else if (typeof input === "string") {
    imageBuffer = await fs.readFile(input);
  } else if (input?.buffer && Buffer.isBuffer(input.buffer)) {
    imageBuffer = input.buffer;
  } else {
    throw new Error("Invalid image input. Expected file path or Buffer.");
  }

  let pipeline = sharp(imageBuffer);

  if (width || height) {
    pipeline = pipeline.resize(width, height, {
      fit,
      withoutEnlargement: true,
      background: { r: 255, g: 255, b: 255, alpha: 0 },
    });
  }

  const pngBuffer = await pipeline.png().toBuffer();
  return `data:image/png;base64,${pngBuffer.toString("base64")}`;
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatCertificateTitle(certificateType = "participation") {
  const normalized = String(certificateType).toLowerCase().trim();

  if (normalized === "achievement") return "CERTIFICATE OF ACHIEVEMENT";
  if (normalized === "appreciation") return "CERTIFICATE OF APPRECIATION";
  return "CERTIFICATE OF PARTICIPATION";
}

function buildAchievementLine({
  certificateType = "participation",
  placement = "",
}) {
  const normalized = String(certificateType).toLowerCase().trim();

  if (normalized === "achievement" && placement) {
    return `for achieving <strong>${escapeHtml(placement)}</strong>`;
  }

  return "for active participation";
}

async function buildCertificateSignatures(signatures = []) {
  const items = await Promise.all(
    (signatures || []).slice(0, 3).map(async (sig) => {
      const imageUri = sig?.image
        ? await toImageDataUri(sig.image, { width: 180, height: 70, fit: "contain" })
        : "";

      return {
        name: escapeHtml(sig?.name || ""),
        role: escapeHtml(sig?.role || sig?.designation || ""),
        org: escapeHtml(sig?.org || ""),
        imageUri,
      };
    })
  );

  const filtered = items.filter((item) => item.name || item.role || item.imageUri);
  if (!filtered.length) return "";

  return `
    <div class="signature-grid cols-${filtered.length}">
      ${filtered
        .map(
          (item) => `
            <div class="signature-item">
              <div class="signature-image-wrap">
                ${
                  item.imageUri
                    ? `<img src="${item.imageUri}" alt="${item.name}" class="signature-image" />`
                    : `<div class="signature-spacer"></div>`
                }
              </div>
              <div class="signature-line"></div>
              <div class="signature-name">${item.name}</div>
              <div class="signature-role">${item.role}</div>
              ${item.org ? `<div class="signature-org">${item.org}</div>` : ""}
            </div>
          `
        )
        .join("")}
    </div>
  `;
}

const runPdftohtml = async (pdfBuffer) => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "pdftohtml-"));
  const pdfPath = path.join(tmpDir, `${randomUUID()}.pdf`);
  try {
    await fs.writeFile(pdfPath, pdfBuffer);
    const { stdout } = await execFileAsync(
      "pdftohtml",
      ["-s", "-i", "-noframes", "-nomerge", "-stdout", pdfPath],
      { maxBuffer: 50 * 1024 * 1024 }
    );
    return stdout;
  } catch (err) {
    const hint =
      "pdftohtml (Poppler) is required. Install Poppler and ensure `pdftohtml` is on PATH.";
    const message = err && err.message ? `${err.message} (${hint})` : hint;
    throw new Error(message);
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
};

const extractHtmlParts = (htmlString) => {
  if (!htmlString || typeof htmlString !== "string") {
    return { styles: "", body: "" };
  }
  const styleMatch = htmlString.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
  const styles = styleMatch ? styleMatch[1] : "";
  const bodyMatch = htmlString.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const body = bodyMatch ? bodyMatch[1] : htmlString;
  const sanitizedBody = body.replace(/<script[\s\S]*?<\/script>/gi, "");
  return { styles, body: sanitizedBody };
};

const buildSignatureSection = (authorizers = []) => {
  const entries = (authorizers || [])
    .slice(0, 3)
    .map((a) => ({ name: a?.name || "", role: a?.role || a?.title || "" }))
    .filter((a) => a.name || a.role);

  if (!entries.length) return "";

  const columns = entries.length;
  const items = entries
    .map(
      (a) => `
        <div class="sig">
          <div class="sig-line"></div>
          <div class="sig-name">${a.name}</div>
          <div class="sig-role">${a.role}</div>
          <div class="sig-org">pcIST</div>
        </div>
      `
    )
    .join("\n");

  return `
    <section class="signature-area cols-${columns}" aria-label="Authorizers">
      ${items}
    </section>
  `;
};

const generatePadPDFWithPuppeteer = async (opts = {}) => {
  const {
    uploadedPdfBuffer = null,
    authorizers: authorizersParam = [],
    contactEmail = "",
    contactPhone = "",
    address = "Institute of Science & Technology (IST), Dhaka",
    serial: preGeneratedSerial = null,
    dateStr: preGeneratedDateStr = null,
  } = opts;

  if (!Buffer.isBuffer(uploadedPdfBuffer) || uploadedPdfBuffer.length === 0) {
    throw new Error("You must provide uploadedPdfBuffer as a non-empty Buffer");
  }

  const istLogoPath = assetPath("assets/logos/IST_logo.png");
  const [istLogoBase64] = await Promise.all([
    loadLogoBase64(istLogoPath, 48),
  ]);

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

  const contactLine = [
    contactEmail ? `Email: ${contactEmail}` : null,
    contactPhone ? `Phone: ${contactPhone}` : null,
  ]
    .filter(Boolean)
    .join(" | ");

  const pdftohtmlOutput = await runPdftohtml(uploadedPdfBuffer);
  const { styles: extractedStyles, body: extractedBody } = extractHtmlParts(pdftohtmlOutput);
  const contentHtml = extractedBody && extractedBody.trim().length
    ? extractedBody
    : "<p>No content extracted from the uploaded PDF.</p>";

  const signatureHtml = buildSignatureSection(authorizersParam);

  const html = `
    <!doctype html>
    <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <style>
        @page { size: A4; margin: 16mm 14mm 22mm 14mm; }
        * { box-sizing: border-box; }
        body { margin: 0; font-family: 'Arial', 'Helvetica', sans-serif; color: #0f172a; }
        .page { width: 210mm; max-width: 210mm; margin: 0 auto; }
        header { display: flex; align-items: center; justify-content: space-between; gap: 12px; border-bottom: 2px solid #0d6efd; padding-bottom: 10px; margin-bottom: 14px; }
        .header-left { display: flex; align-items: center; gap: 12px; }
        .logo { width: 54px; height: 54px; object-fit: contain; }
        .org { display: flex; flex-direction: column; gap: 2px; }
        .org h1 { margin: 0; font-size: 18px; line-height: 1.2; font-weight: 800; }
        .org .sub { font-size: 12px; color: #475569; }
        .org .contact { font-size: 11px; color: #475569; }
        .meta { text-align: right; font-size: 11px; color: #1f2937; line-height: 1.35; }
        .content { font-size: 12px; line-height: 1.48; color: #0f172a; }
        .extracted-html { width: 100%; }
        .extracted-html * { max-width: 100%; }
        .extracted-html table { border-collapse: collapse; width: 100%; }
        .extracted-html td, .extracted-html th { border: 1px solid #e2e8f0; padding: 6px 8px; }
        .extracted-html p { margin: 0 0 6px 0; }
        .extracted-html div { page-break-inside: avoid; }
        .signature-area { margin-top: 22mm; display: grid; gap: 22px; page-break-inside: avoid; }
        .signature-area.cols-1 { grid-template-columns: 1fr; }
        .signature-area.cols-2 { grid-template-columns: repeat(2, 1fr); }
        .signature-area.cols-3 { grid-template-columns: repeat(3, 1fr); }
        .sig { text-align: center; }
        .sig-line { border-bottom: 1.5px solid #0d6efd; width: 70%; margin: 0 auto 8px auto; height: 14px; }
        .sig-name { font-weight: 700; font-size: 12px; }
        .sig-role { font-size: 11px; color: #475569; }
        .sig-org { font-size: 10px; color: #94a3b8; }
        ${extractedStyles}
      </style>
    </head>
    <body>
      <div class="page">
        <header>
          <div class="header-left">
            <img src="data:image/png;base64,${istLogoBase64}" alt="IST Logo" class="logo" />
            <div class="org">
              <h1>Programming Club of IST (pcIST)</h1>
              <div class="sub">${address}</div>
              ${contactLine ? `<div class="contact">${contactLine}</div>` : ""}
            </div>
          </div>
          <div class="meta">
            <div><strong>Date:</strong> ${dateStr}</div>
            <div><strong>SN:</strong> ${serial}</div>
          </div>
        </header>

        <main class="content">
          <div class="extracted-html">${contentHtml}</div>
          ${signatureHtml}
        </main>
      </div>
    </body>
    </html>
  `;

  const browser = await getPuppeteerInstance();
  const page = await browser.newPage();
  await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: "networkidle0", timeout: 30000 });
  const buffer = await page.pdf({
    format: "A4",
    printBackground: true,
    preferCSSPageSize: true,
    margin: { top: "16mm", bottom: "22mm", left: "14mm", right: "14mm" },
  });
  await page.close();
  await browser.close();

  return { buffer, serial, dateStr };
};

const generateInvoicePDFWithPuppeteer = async (opts = {}) => {
  const {
    products = [],
    authorizerName = "",
    authorizerDesignation = "",
    contactEmail = "",
    contactPhone = "",
    address = "Institute of Science & Technology (IST), Dhaka",
    issueDate = null,
  } = opts;

  const pcistLogoPath = assetPath("assets/logos/pcIST_logo.png");
  const [pcistBuf] = await Promise.all([
    sharp(pcistLogoPath)
      .resize(60, 60, {
        fit: "contain",
        background: { r: 255, g: 255, b: 255, alpha: 0 },
      })
      .png({
        compressionLevel: 6,
        quality: 90,
        adaptiveFiltering: false,
      })
      .toBuffer(),
  ]);
  const pcistData = `data:image/png;base64,${pcistBuf.toString("base64")}`;

  const today = new Date();

  const issueDateObj = issueDate ? new Date(issueDate) : today;
  const issueDateStr = issueDateObj.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const generatedDateStr = today.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const currentCount = await Invoice.countDocuments({});
  const nextNumber = currentCount + 1;
  const paddedNumber = nextNumber.toString().padStart(4, "0");
  const serial = `INV-${issueDateObj.getFullYear()}-${paddedNumber}`;

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
    await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 1 });
    await page.emulateMediaType("print");

    const timeout = isHeroku ? 30000 : 10000;

    const tempHtml = html.replace(
      /<div class="signature-section">[\s\S]*?<\/div>\s*<div class="footer">[\s\S]*?<\/div>/,
      ""
    );

    await page.setContent(tempHtml, {
      waitUntil: "domcontentloaded",
      timeout,
    });

    await new Promise((resolve) => setTimeout(resolve, isHeroku ? 2000 : 1000));

    const measurements = await page.evaluate(() => {
      const pageElement = document.querySelector(".page");
      if (!pageElement) return { contentHeight: 0, pageHeight: 0 };

      const contentHeight = pageElement.scrollHeight;
      const pageHeightMm = 297 - 15 - 15;
      const pageHeightPx = (pageHeightMm * 96) / 25.4;

      return { contentHeight, pageHeightPx };
    });

    const signatureSpaceNeeded = 90;
    const minTopPosition = measurements.contentHeight + 30;
    const maxTopPosition = measurements.pageHeightPx - signatureSpaceNeeded;
    const signatureTopPosition = Math.max(minTopPosition, maxTopPosition);

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
      timeout,
    });

    await new Promise((resolve) => setTimeout(resolve, isHeroku ? 2000 : 1000));

    const buffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "15mm", bottom: "25mm", left: "12mm", right: "12mm" },
      preferCSSPageSize: true,
      displayHeaderFooter: false,
      scale: 1.0,
      width: "210mm",
      height: "297mm",
    });

    await page.close();
    await browser.close();

    return { buffer, serial, issueDateStr, generatedDateStr, grandTotal };
  } catch (err) {
    if (browser) await browser.close();
    throw err;
  }
};

const generateCertificatePDFWithPuppeteer = async (opts = {}) => {
  const {
    recipientName = "",
    certificateType = "participation", // participation | achievement
    placement = "", // e.g. 1st Place / Runner Up / Honorable Mention
    eventName = "ICPC Asia Dhaka Regional Contest",
    eventYear = new Date().getFullYear(),
    issueDate = null,
    organizationName = "Programming Club of IST (pcIST)",
    subtitle = "",
    description = "",
    leftLogo = assetPath("assets/logos/IST_logo.png"),
    rightLogo = assetPath("assets/logos/pcIST_logo.png"),
    borderColor = "#2f2a85",
    accentColor = "#7c3aed",
    textColor = "#1f2937",
    signatures = [], // [{ name, role, org, image: <png path or buffer> }]
    serialPrefix = "CERT",
    serialNumber = null,
  } = opts;

  if (!recipientName) {
    throw new Error("recipientName is required");
  }

  const issuedAt = issueDate ? new Date(issueDate) : new Date();
  const issueDateStr = issuedAt.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const generatedSerial =
    serialNumber ||
    `${serialPrefix}-${issuedAt.getFullYear()}-${String(Date.now()).slice(-6)}`;

  const [leftLogoUri, rightLogoUri, signatureHtml] = await Promise.all([
    leftLogo ? toImageDataUri(leftLogo, { width: 90, height: 90, fit: "contain" }) : "",
    rightLogo ? toImageDataUri(rightLogo, { width: 90, height: 90, fit: "contain" }) : "",
    buildCertificateSignatures(signatures),
  ]);

  const safeRecipientName = escapeHtml(recipientName);
  const safeEventName = escapeHtml(eventName);
  const safeOrganizationName = escapeHtml(organizationName);
  const safeSubtitle = escapeHtml(subtitle);
  const safeDescription = escapeHtml(description);
  const certificateTitle = formatCertificateTitle(certificateType);
  const achievementLine = buildAchievementLine({ certificateType, placement });

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <style>
        @page {
          size: A4 landscape;
          margin: 10mm;
        }

        * {
          box-sizing: border-box;
        }

        html, body {
          margin: 0;
          padding: 0;
          background: #ffffff;
          font-family: "Times New Roman", serif;
          color: ${textColor};
        }

        .page {
          width: 277mm;
          height: 190mm;
          margin: 0 auto;
          position: relative;
          background:
            linear-gradient(rgba(255,255,255,0.94), rgba(255,255,255,0.94)),
            radial-gradient(circle at center, rgba(124,58,237,0.05), transparent 42%);
          overflow: hidden;
        }

        .outer-border {
          position: absolute;
          inset: 4mm;
          border: 2.5px solid ${borderColor};
        }

        .inner-border {
          position: absolute;
          inset: 8mm;
          border: 1px solid ${borderColor};
        }

        .corner {
          position: absolute;
          width: 16mm;
          height: 16mm;
          border-color: ${borderColor};
          opacity: 0.95;
        }

        .corner.tl {
          top: 6mm;
          left: 6mm;
          border-top: 2px solid ${borderColor};
          border-left: 2px solid ${borderColor};
        }

        .corner.tr {
          top: 6mm;
          right: 6mm;
          border-top: 2px solid ${borderColor};
          border-right: 2px solid ${borderColor};
        }

        .corner.bl {
          bottom: 6mm;
          left: 6mm;
          border-bottom: 2px solid ${borderColor};
          border-left: 2px solid ${borderColor};
        }

        .corner.br {
          bottom: 6mm;
          right: 6mm;
          border-bottom: 2px solid ${borderColor};
          border-right: 2px solid ${borderColor};
        }

        .content {
          position: absolute;
          inset: 14mm;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }

        .top-row {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          min-height: 30mm;
        }

        .logo-box {
          width: 28mm;
          height: 28mm;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .logo-box img {
          max-width: 100%;
          max-height: 100%;
          object-fit: contain;
        }

        .top-center {
          flex: 1;
          text-align: center;
          padding: 0 10mm;
        }

        .org-name {
          font-size: 13px;
          letter-spacing: 1.6px;
          text-transform: uppercase;
          font-weight: 600;
          margin-top: 2mm;
        }

        .certificate-title {
          margin-top: 5mm;
          font-size: 28px;
          font-weight: 700;
          letter-spacing: 0.8px;
          text-transform: uppercase;
        }

        .subtitle {
          margin-top: 2mm;
          font-size: 13px;
          color: #4b5563;
          min-height: 16px;
        }

        .body {
          text-align: center;
          margin-top: 2mm;
          padding: 0 12mm;
        }

        .presented-to {
          font-size: 15px;
          letter-spacing: 1px;
          text-transform: uppercase;
          color: #6b7280;
          margin-bottom: 3mm;
        }

        .recipient-name {
          font-size: 30px;
          font-weight: 700;
          color: ${accentColor};
          margin-bottom: 4mm;
        }

        .recipient-line {
          width: 120mm;
          height: 1px;
          background: ${borderColor};
          margin: 0 auto 5mm auto;
          opacity: 0.7;
        }

        .main-text {
          font-size: 17px;
          line-height: 1.7;
          max-width: 210mm;
          margin: 0 auto;
        }

        .event-name {
          font-weight: 700;
        }

        .description {
          margin-top: 4mm;
          font-size: 13px;
          color: #4b5563;
          min-height: 14px;
        }

        .bottom {
          display: flex;
          flex-direction: column;
          gap: 8mm;
        }

        .meta-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 12px;
          padding: 0 8mm;
        }

        .meta-item strong {
          color: ${borderColor};
        }

        .signature-grid {
          display: grid;
          gap: 14mm;
          align-items: end;
          padding: 0 8mm;
        }

        .signature-grid.cols-1 { grid-template-columns: 1fr; }
        .signature-grid.cols-2 { grid-template-columns: repeat(2, 1fr); }
        .signature-grid.cols-3 { grid-template-columns: repeat(3, 1fr); }

        .signature-item {
          text-align: center;
        }

        .signature-image-wrap {
          height: 24mm;
          display: flex;
          align-items: flex-end;
          justify-content: center;
          margin-bottom: 2mm;
        }

        .signature-image {
          max-width: 48mm;
          max-height: 20mm;
          object-fit: contain;
        }

        .signature-spacer {
          height: 20mm;
        }

        .signature-line {
          width: 55mm;
          margin: 0 auto 2mm auto;
          border-top: 1.5px solid ${borderColor};
        }

        .signature-name {
          font-size: 13px;
          font-weight: 700;
        }

        .signature-role {
          font-size: 11px;
          color: #4b5563;
          margin-top: 1mm;
        }

        .signature-org {
          font-size: 10px;
          color: #6b7280;
          margin-top: 1mm;
        }

        .watermark {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 64px;
          color: rgba(124,58,237,0.035);
          font-weight: 700;
          pointer-events: none;
          transform: rotate(-18deg);
          text-transform: uppercase;
          letter-spacing: 3px;
        }
      </style>
    </head>
    <body>
      <div class="page">
        <div class="outer-border"></div>
        <div class="inner-border"></div>
        <div class="corner tl"></div>
        <div class="corner tr"></div>
        <div class="corner bl"></div>
        <div class="corner br"></div>
        <div class="watermark">${escapeHtml(certificateType)}</div>

        <div class="content">
          <div>
            <div class="top-row">
              <div class="logo-box">
                ${leftLogoUri ? `<img src="${leftLogoUri}" alt="Left Logo" />` : ""}
              </div>

              <div class="top-center">
                <div class="org-name">${safeOrganizationName}</div>
                <div class="certificate-title">${certificateTitle}</div>
                <div class="subtitle">${safeSubtitle}</div>
              </div>

              <div class="logo-box">
                ${rightLogoUri ? `<img src="${rightLogoUri}" alt="Right Logo" />` : ""}
              </div>
            </div>

            <div class="body">
              <div class="presented-to">This certificate is proudly presented to</div>
              <div class="recipient-name">${safeRecipientName}</div>
              <div class="recipient-line"></div>

              <div class="main-text">
                in recognition of outstanding performance ${achievementLine}
                in <span class="event-name">${safeEventName} ${escapeHtml(eventYear)}</span>.
              </div>

              ${
                safeDescription
                  ? `<div class="description">${safeDescription}</div>`
                  : ""
              }
            </div>
          </div>

          <div class="bottom">
            <div class="meta-row">
              <div class="meta-item"><strong>Date:</strong> ${issueDateStr}</div>
              <div class="meta-item"><strong>Certificate No:</strong> ${generatedSerial}</div>
            </div>

            ${signatureHtml}
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  const browser = await getPuppeteerInstance();
  const page = await browser.newPage();

  await page.setViewport({
    width: 1400,
    height: 1000,
    deviceScaleFactor: 1,
  });

  await page.emulateMediaType("print");
  await page.setContent(html, {
    waitUntil: "networkidle0",
    timeout: 30000,
  });

  const buffer = await page.pdf({
    landscape: true,
    format: "A4",
    printBackground: true,
    preferCSSPageSize: true,
    margin: {
      top: "10mm",
      bottom: "10mm",
      left: "10mm",
      right: "10mm",
    },
  });

  await page.close();
  await browser.close();

  return {
    buffer,
    serial: generatedSerial,
    issueDateStr,
  };
};

export {
  generatePadPDFWithPuppeteer,
  generateInvoicePDFWithPuppeteer,
  generateCertificatePDFWithPuppeteer,
};