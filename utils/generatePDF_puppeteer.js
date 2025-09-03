import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import PadStatement from '../models/padStatementModel.js';
import Invoice from '../models/invoiceModel.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const assetPath = (relativePath) => path.resolve(__dirname, '..', relativePath);

const generatePadPDFWithPuppeteer = async (opts = {}) => {
  const {
    statement = '',
    authorizers: authorizersParam = [],
    contactEmail = '',
    contactPhone = '',
    address = 'Institute of Science & Technology (IST), Dhaka',
    serial: preGeneratedSerial = null,
    dateStr: preGeneratedDateStr = null,
  } = opts;
  const istLogoPath = assetPath('assets/logos/IST_logo.png');
  const pcistLogoPath = assetPath('assets/logos/pcIST_logo.png');
  
  // Process logos with consistent sizing and compression
  const [istBuf, pcistBuf] = await Promise.all([
    sharp(istLogoPath)
      .resize(76, 76, { 
        fit: 'contain', 
        background: { r: 255, g: 255, b: 255, alpha: 0 } // Transparent background
      })
      .png({ 
        compressionLevel: 6, // More stable compression
        quality: 90,
        adaptiveFiltering: false // Consistent filtering
      })
      .toBuffer(),
    sharp(pcistLogoPath)
      .resize(76, 76, { 
        fit: 'contain', 
        background: { r: 255, g: 255, b: 255, alpha: 0 } // Transparent background
      })
      .png({ 
        compressionLevel: 6, // More stable compression
        quality: 90,
        adaptiveFiltering: false // Consistent filtering
      })
      .toBuffer(),
  ]);
  const istData = `data:image/png;base64,${istBuf.toString('base64')}`;
  const pcistData = `data:image/png;base64,${pcistBuf.toString('base64')}`;

  // Use pre-generated values if provided, otherwise generate them
  let serial, dateStr;
  
  if (preGeneratedSerial && preGeneratedDateStr) {
    serial = preGeneratedSerial;
    dateStr = preGeneratedDateStr;
  } else {
    // Fallback to original generation logic for backward compatibility
    const today = new Date();
    dateStr = today.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
    
    // Get current count from database and generate incremental serial number
    const currentCount = await PadStatement.countDocuments({});
    const nextNumber = currentCount + 1;
    const paddedNumber = nextNumber.toString().padStart(4, '0');
    serial = `pcIST-${today.getFullYear()}-${paddedNumber}`;
  }

  const paragraphs = String(statement)
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p class="para">${p.replace(/\n/g, '<br/>')}</p>`)
    .join('\n');

  const contactLine = [
    contactEmail ? `Email: ${contactEmail}` : null,
    contactPhone ? `Phone: ${contactPhone}` : null,
  ]
    .filter(Boolean)
    .join(' | ');

  // Handle authorizers array
  let authorizers = [];
  if (Array.isArray(authorizersParam) && authorizersParam.length > 0) {
    authorizers = authorizersParam
      .slice(0, 3)
      .map((a) => ({ name: a.name || '', role: a.role || a.title || '' }));
  }
  authorizers = authorizers.slice(0, 3);

  const signatureHtml = (() => {
    if (authorizers.length === 0) return '';
    if (authorizers.length === 1) {
      const a = authorizers[0];
      return `<div class="signatures single"><div class="sig center"><div class="sig-line"></div><div class="sig-name">${a.name || ''}</div><div class="sig-role">${a.role || ''}</div><div>pcIST</div></div></div>`;
    }
    if (authorizers.length === 2) {
      const left = authorizers[0];
      const right = authorizers[1];
      return `<div class="signatures two">
        <div class="sig left">
          <div class="sig-line"></div>
          <div class="sig-name">${left.name || ''}</div>
          <div class="sig-role">${left.role || ''}</div>
          <div>pcIST</div>
        </div>
        <div class="sig right">
          <div class="sig-line"></div>
          <div class="sig-name">${right.name || ''}</div>
          <div class="sig-role">${right.role || ''}</div>
          <div>pcIST</div>
        </div>
      </div>`;
    }
    // three
    const a0 = authorizers[0];
    const a1 = authorizers[1];
    const a2 = authorizers[2];
    return `<div class="signatures three">
      <div class="sig left">
        <div class="sig-line"></div>
        <div class="sig-name">${a0.name || ''}</div>
        <div class="sig-role">${a0.role || ''}</div>
        <div>pcIST</div>
      </div>
      <div class="sig center">
        <div class="sig-line"></div>
        <div class="sig-name">${a1.name || ''}</div>
        <div class="sig-role">${a1.role || ''}</div>
        <div>pcIST</div>
      </div>
      <div class="sig right">
        <div class="sig-line"></div>
        <div class="sig-name">${a2.name || ''}</div>
        <div class="sig-role">${a2.role || ''}</div>
        <div>pcIST</div>
      </div>
    </div>`;
  })();

  const html = `
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>pcIST — High Tech Letter</title>
<style>
  @page { size: A4; margin: 15mm 12mm 20mm 12mm; }
  html,body{height:100%;margin:0;background:#fff;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,"Noto Sans",sans-serif;color:#1f2937;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;text-rendering:optimizeLegibility;}
  :root{
    --blue-1:#0d6efd;
    --blue-2:#4dabf7;
    --cyan:#0dcaf0;
    --accent:linear-gradient(135deg,var(--blue-1),var(--blue-2));
  }

  /* Mobile-optimized styling for consistent PDF rendering */
  * {
    -webkit-print-color-adjust: exact !important;
    color-adjust: exact !important;
    box-sizing: border-box;
  }

  .page{position:relative;box-sizing:border-box;padding:10mm 18mm 16mm 18mm;overflow:visible;}

  .frame{position:fixed;inset:6px;border-radius:8px;border:1px solid rgba(13,110,253,0.12);
    box-shadow:0 3px 12px rgba(13,110,253,0.03),inset 0 1px 0 rgba(255,255,255,0.12);pointer-events:none;z-index:0;}

  .side-strip{position:fixed;top:0;bottom:0;width:6mm;z-index:0;pointer-events:none;
    filter:drop-shadow(0 2px 8px rgba(13,110,253,0.04));}
  .side-strip.left{left:0;background:linear-gradient(180deg,rgba(13,110,253,0.2),rgba(13,110,253,0.05));}
  .side-strip.right{right:0;background:linear-gradient(180deg,rgba(13,110,253,0.2),rgba(13,110,253,0.05));}
  .side-strip svg g{stroke-width:0.6 !important;}

  /* corner svgs sit behind header content but above the frame; logos will be placed above them */
  .corner-svgs{position:fixed;left:0;top:0;width:210mm;height:297mm;z-index:5;pointer-events:none;}
  /* explicit bottom-right triangle SVG to guarantee visibility (bigger, mirrored) */
  .corner-br-svg{position:fixed;right:0;bottom:0;width:96px;height:96px;z-index:5;pointer-events:none;}
  .corner-br-svg svg{width:100%;height:100%;display:block}

  header{text-align:center;padding-top:12mm;margin-bottom:2mm;position:relative;z-index:5;}
  .logo{
    width:76px;
    height:76px;
    object-fit:contain;
    object-position:center;
    position:absolute;
    top:10mm;
    z-index:6;
    image-rendering:high-quality;
    image-rendering:-webkit-optimize-contrast;
    image-rendering:crisp-edges;
    max-width:76px;
    max-height:76px;
  }
  .logo.left{left:8mm;}
  .logo.right{right:8mm;}
  header h1{margin:6px 0 2px;font-size:20px;font-weight:700;position:relative;z-index:6;}
  header .sub{color:#6b7280;font-size:11px;margin-bottom:4px;}
  header .contact{color:#6b7280;font-size:11px;margin-bottom:6px;}
  .rule{width:78%;height:2px;margin:6px auto 10px;background:linear-gradient(90deg,var(--blue-1),var(--blue-2));border-radius:2px;}

  .meta{display:flex;justify-content:space-between;font-size:12px;color:#111827;margin:6px 0 8px;}
  .main .content{font-size:11.6px;line-height:1.48;text-align:justify;color:#111827;}
  .main .content .para{margin-bottom:8px;}

  /* signature area: control layout for 1/2/3 signatures */
  .signatures{position:relative;display:flex;justify-content:flex-start;align-items:flex-end;gap:36px;margin-top:18mm;z-index:5}
  .signatures .sig{width:220px;display:flex;flex-direction:column;align-items:flex-start;text-align:left}
  .signatures .sig.center{align-items:center;text-align:center}
  .signatures .sig.right{align-items:flex-end;text-align:right}
  .signatures .sig-line{width:140px;height:2px;background:var(--blue-1);margin-bottom:6px}
  .signatures .sig-name{font-weight:800;margin-bottom:4px;font-size:12px}
  .signatures .sig-role{font-size:11px;margin-bottom:2px;color:#374151}
  /* layout rules per signature count - following exact requirements */
  /* 1 signature: bottom right */
  .signatures.single{justify-content:flex-end}
  /* 2 signatures: opposite sides of the page */
  .signatures.two{justify-content:space-between}
  /* 3 signatures: two at sides and one in middle */
  .signatures.three{justify-content:space-between}
</style>
</head>
<body>
  <div class="page" role="document">
    <div class="frame" aria-hidden="true"></div>

    <div class="side-strip left" aria-hidden="true">
      <!-- Left strip SVG unchanged -->
      <svg width="100%" height="100%" viewBox="0 0 120 842" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
        <defs><linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#0d6efd" stop-opacity="0.95"/>
          <stop offset="1" stop-color="#0dcaf0" stop-opacity="0.6"/>
        </linearGradient></defs>
        <rect x="0" y="0" width="120" height="842" fill="url(#g1)" opacity="0.12"/>
        <g stroke="#ffffff" stroke-opacity="0.22" stroke-width="1.2" fill="none">
          <path d="M26 40 L26 90 L50 90 L50 150" stroke-linecap="round"/>
          <circle cx="26" cy="40" r="2.2" fill="#fff"/>
          <path d="M26 220 L26 300 L70 300" stroke-linecap="round"/>
          <circle cx="26" cy="220" r="2.2" fill="#fff"/>
          <path d="M26 420 L26 500 L48 500 L48 620" stroke-linecap="round"/>
        </g>
      </svg>
    </div>

    <div class="side-strip right" aria-hidden="true">
      <!-- Right strip SVG unchanged -->
      <svg width="100%" height="100%" viewBox="0 0 120 842" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
        <defs><linearGradient id="g2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#4dabf7" stop-opacity="0.95"/>
          <stop offset="1" stop-color="#0d6efd" stop-opacity="0.6"/>
        </linearGradient></defs>
        <rect x="0" y="0" width="120" height="842" fill="url(#g2)" opacity="0.12"/>
        <g stroke="#ffffff" stroke-opacity="0.22" stroke-width="1.2" fill="none">
          <path d="M94 60 L66 60 L66 120 L94 120" stroke-linecap="round"/>
          <circle cx="94" cy="60" r="2.2" fill="#fff"/>
          <path d="M94 240 L94 320 L40 320" stroke-linecap="round"/>
          <circle cx="94" cy="240" r="2.2" fill="#fff"/>
          <path d="M94 440 L94 560 L68 560 L68 680" stroke-linecap="round"/>
        </g>
      </svg>
    </div>

    <!-- Updated corner triangles -->
    <div class="corner-svgs" aria-hidden="true">
      <svg viewBox="0 0 210 297" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg" style="position:absolute;left:0;top:0;width:210mm;height:297mm;">
        <defs>
          <linearGradient id="triGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#0d6efd"/>
            <stop offset="1" stop-color="#4dabf7"/>
          </linearGradient>
          <filter id="soft" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="8" result="b"/>
            <feBlend in="SourceGraphic" in2="b" mode="normal"/>
          </filter>
        </defs>

  <!-- Top-left smaller -->
  <path d="M0 0 L56 0 L0 56 Z" fill="url(#triGrad)" opacity="0.98" filter="url(#soft)"></path>
  <g transform="translate(6,8) scale(0.75)" stroke="rgba(255,255,255,0.22)" stroke-width="1" fill="none">
          <path d="M6 12 H48 V28 H60" stroke-linecap="round" stroke-linejoin="round"/>
          <circle cx="6" cy="12" r="1.6" fill="#fff"/>
        </g>

        <!-- Bottom-right mirrored (match top-left size) + circuit details -->
        <g transform="translate(210,297) rotate(180)">
          <path d="M0 0 L56 0 L0 56 Z" fill="url(#triGrad)" opacity="0.98" filter="url(#soft)"></path>
          <g transform="translate(8,10) scale(0.75)" stroke="rgba(255,255,255,0.22)" stroke-width="1" fill="none">
            <path d="M6 12 H48 V28 H60" stroke-linecap="round" stroke-linejoin="round"/>
            <circle cx="6" cy="12" r="1.6" fill="#fff"/>
            <path d="M12 36 H40 V48 H54" stroke-linecap="round" stroke-linejoin="round"/>
            <circle cx="12" cy="36" r="1.6" fill="#fff"/>
          </g>
        </g>
      </svg>
    </div>

    

    <header>
      <img class="logo left" src="${istData}" alt="IST Logo" />
      <img class="logo right" src="${pcistData}" alt="pcIST Logo" />
      <h1>Programming Club of IST (pcIST)</h1>
      <div class="sub">Institute of Science &amp; Technology — Dhaka</div>
      ${contactLine ? `<div class="contact">${contactLine}</div>` : ''}
      <div class="rule"></div>
    </header>

    <main class="main">
      <div class="meta">
        <div>Date: <strong>${dateStr}</strong></div>
        <div>SN: <strong>${serial}</strong></div>
      </div>
      <section class="content" id="content">
        ${paragraphs}
      </section>
  </main>

    <!-- signature will be injected at the bottom of the last page by a measurement pass -->
    <!-- fixed bottom-right triangle (explicit SVG) -->
    <div class="corner-br-svg" aria-hidden="true">
  <svg viewBox="0 0 96 96" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="triGradBR" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#0d6efd"/>
            <stop offset="1" stop-color="#4dabf7"/>
          </linearGradient>
        </defs>
        <!-- rotated so triangle points inward from bottom-right -->
        <g transform="translate(96,96) rotate(180)">
          <path d="M0 0 L96 0 L0 96 Z" fill="url(#triGradBR)" opacity="0.98"/>
          <g transform="translate(10,12) scale(0.9)" stroke="rgba(255,255,255,0.22)" stroke-width="1" fill="none">
          <path d="M6 12 H48 V28 H60" stroke-linecap="round" stroke-linejoin="round"/>
          <circle cx="6" cy="12" r="1.6" fill="#fff"/>
          </g>
        </g>
      </svg>
    </div>
  </div>
</body>
</html>


  `;

  let puppeteer;
  try {
    puppeteer = (await import('puppeteer')).default;
  } catch {
    throw new Error('Puppeteer is not installed. Run `npm install puppeteer`.');
  }

  // Check if running on Heroku or other cloud environments
  const isHeroku = process.env.DYNO || process.env.NODE_ENV === 'production';
  
  const launchArgs = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage', // Overcome limited resource problems
    '--disable-gpu',
    '--disable-features=VizDisplayCompositor',
    '--run-all-compositor-stages-before-draw',
    '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',
    '--disable-backgrounding-occluded-windows',
    '--disable-ipc-flooding-protection',
    '--font-render-hinting=none', // Consistent font rendering
    '--force-color-profile=srgb', // Consistent color rendering
    '--disable-font-subpixel-positioning', // More consistent text rendering
  ];
  
  // Add Heroku-specific optimizations
  if (isHeroku) {
    launchArgs.push(
      '--memory-pressure-off',
      '--max_old_space_size=4096',
      '--single-process' // Sometimes helps with consistency on Heroku
    );
  }
  
  const execPath =
    process.env.PUPPETEER_EXECUTABLE_PATH ||
    process.env.GOOGLE_CHROME_BIN ||
    undefined;

  const browser = await puppeteer.launch({
    headless: true,
    args: launchArgs,
    executablePath: execPath,
    defaultViewport: null, // Use default viewport
    ignoreDefaultArgs: ['--disable-extensions'], // Allow better rendering
  });

  try {
    const page = await browser.newPage();
    
    // Set viewport for consistent rendering across devices
    await page.setViewport({
      width: 794, // A4 width in pixels at 96 DPI
      height: 1123, // A4 height in pixels at 96 DPI
      deviceScaleFactor: 1,
    });
    
    // Optimize page for PDF generation
    await page.emulateMediaType('print');
    
    // Set longer timeout for Heroku
    const timeout = isHeroku ? 30000 : 10000;
    
    await page.setContent(html, { 
      waitUntil: 'networkidle0',
      timeout: timeout
    });
    
    // Add extra wait time for fonts and images to load completely
    await new Promise(resolve => setTimeout(resolve, isHeroku ? 2000 : 1000));

    // If there are signatures, do a measurement pass to pin them to the bottom of the last page
    if (signatureHtml && String(signatureHtml).trim()) {
      await page.evaluate((sigHtml) => {
        const pxPerMm = 96 / 25.4;
        const pageHeightMm = 297;
        const topMarginMm = 15; // matches @page margin and pdf margin
        const bottomMarginMm = 20;
        const printablePx = (pageHeightMm - topMarginMm - bottomMarginMm) * pxPerMm;

  const pageEl = document.querySelector('.page');
        if (!pageEl) return;

        const contentHeight = pageEl.scrollHeight;
        const pages = Math.max(1, Math.ceil(contentHeight / printablePx));

        // create a hidden measurement node to get signature height
        const meas = document.createElement('div');
        meas.style.position = 'absolute';
        meas.style.visibility = 'hidden';
        meas.style.left = '0';
        meas.innerHTML = sigHtml;
        pageEl.appendChild(meas);
        const sigHeight = Math.ceil(meas.getBoundingClientRect().height);
        pageEl.removeChild(meas);

  const cs = getComputedStyle(pageEl);
  const padLeft = parseFloat(cs.paddingLeft || '0');
  const padRight = parseFloat(cs.paddingRight || '0');
  const padBottom = parseFloat(cs.paddingBottom || '0');

  // move signatures left by ~20% - minimal left padding, keep right padding for safety
  const extraPadMm = 6; // total: 0.5mm left, 5.5mm right - moves signatures significantly left
  const leftPadMm = 0//0.5;
  const rightPadMm = 18//5.5;
  const leftPadPx = Math.round(leftPadMm * pxPerMm);
  const rightPadPx = Math.round(rightPadMm * pxPerMm);

  // compute top (px) relative to the top of .page so signature sits at bottom of last printable page
  const desiredTop = Math.max((pages * printablePx) - sigHeight - padBottom, pageEl.scrollHeight - sigHeight);

  const container = document.createElement('div');
  container.id = '__signature_float';
  container.style.position = 'absolute';
  container.style.top = desiredTop + 'px';
  // position container at base left with asymmetric padding favoring left
  const baseLeft = padLeft + leftPadPx;
  container.style.left = baseLeft + 'px';
  container.style.width = Math.max(0, pageEl.clientWidth - padLeft - padRight - leftPadPx - rightPadPx) + 'px';
  container.style.paddingLeft = leftPadPx + 'px';
  container.style.paddingRight = rightPadPx + 'px';
  container.innerHTML = sigHtml;
  pageEl.appendChild(container);
      }, signatureHtml);
      // Allow more time for layout to settle on Heroku
      const settleTime = isHeroku ? 200 : 50;
      await page.evaluate((time) => new Promise((r) => setTimeout(r, time)), settleTime);
    }

    const buffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '15mm', bottom: '20mm', left: '12mm', right: '12mm' },
      preferCSSPageSize: true,
      displayHeaderFooter: false,
      scale: 1.0, // Consistent scaling across devices
      width: '210mm', // Explicit A4 width
      height: '297mm', // Explicit A4 height
    });
    await page.close();
    await browser.close();
    return { buffer, serial, dateStr };
  } catch (err) {
    await browser.close();
    throw err;
  }
};

export { generatePadPDFWithPuppeteer, generateInvoicePDFWithPuppeteer };

const generateInvoicePDFWithPuppeteer = async (opts = {}) => {
  const {
    products = [], // [{ description, unitPrice, quantity }]
    authorizerName = '',
    authorizerDesignation = '',
    contactEmail = '',
    contactPhone = '',
    address = 'Institute of Science & Technology (IST), Dhaka',
    issueDate = null, // The original issue date (from database or null for new invoice)
  } = opts;

  // Load logos
  const pcistLogoPath = assetPath('assets/logos/pcIST_logo.png');
  const [pcistBuf] = await Promise.all([
    sharp(pcistLogoPath)
      .resize(60, 60, { 
        fit: 'contain', 
        background: { r: 255, g: 255, b: 255, alpha: 0 } // Transparent background
      })
      .png({ 
        compressionLevel: 6, // More stable compression
        quality: 90,
        adaptiveFiltering: false // Consistent filtering
      })
      .toBuffer(),
  ]);
  const pcistData = `data:image/png;base64,${pcistBuf.toString('base64')}`;

  const today = new Date();
  
  // Issue date: use provided issueDate or current date for new invoices
  const issueDateObj = issueDate ? new Date(issueDate) : today;
  const issueDateStr = issueDateObj.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
  
  // Generated date: always current date
  const generatedDateStr = today.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
  
  // Generate invoice serial number using issue date year
  const currentCount = await Invoice.countDocuments({});
  const nextNumber = currentCount + 1;
  const paddedNumber = nextNumber.toString().padStart(4, '0');
  const serial = `INV-${issueDateObj.getFullYear()}-${paddedNumber}`;

  // Calculate totals for each product and grand total
  let grandTotal = 0;
  const productRows = products.map((product, index) => {
    const quantity = product.quantity || 1;
    const unitPrice = parseFloat(product.unitPrice) || 0;
    const total = quantity * unitPrice;
    grandTotal += total;
    
    return `
      <tr>
        <td class="text-center">${index + 1}</td>
        <td>${product.description || ''}</td>
        <td class="text-center">${quantity}</td>
        <td class="text-right">৳${unitPrice.toFixed(2)}</td>
        <td class="text-right">৳${total.toFixed(2)}</td>
      </tr>
    `;
  }).join('');

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
              ${contactEmail ? `<p>Email: ${contactEmail}</p>` : ''}
              ${contactPhone ? `<p>Phone: ${contactPhone}</p>` : ''}
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
            <span>৳${grandTotal.toFixed(2)}</span>
          </div>
        </div>
        
        ${authorizerName ? `
        <div class="signature-section">
          <div class="signature-box">
            <div class="signature-line"></div>
            <div class="signature-name">${authorizerName}</div>
            ${authorizerDesignation ? `<div class="signature-designation">${authorizerDesignation}</div>` : ''}
          </div>
        </div>
        ` : ''}
        
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
    const isHeroku = process.env.DYNO || process.env.NODE_ENV === 'production';
    
    const puppeteer = await import('puppeteer');
    
    const launchArgs = [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-features=VizDisplayCompositor',
      '--run-all-compositor-stages-before-draw',
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
      '--disable-backgrounding-occluded-windows',
      '--disable-ipc-flooding-protection',
      '--font-render-hinting=none',
      '--force-color-profile=srgb',
      '--disable-font-subpixel-positioning',
    ];
    
    // Add Heroku-specific optimizations
    if (isHeroku) {
      launchArgs.push(
        '--memory-pressure-off',
        '--max_old_space_size=4096',
        '--single-process'
      );
    }
    
    browser = await puppeteer.default.launch({
      headless: true,
      args: launchArgs,
      defaultViewport: null,
      ignoreDefaultArgs: ['--disable-extensions'],
    });
    
    const page = await browser.newPage();
    
    // Set viewport for consistent rendering across devices
    await page.setViewport({
      width: 794, // A4 width in pixels at 96 DPI
      height: 1123, // A4 height in pixels at 96 DPI
      deviceScaleFactor: 1,
    });
    
    // Optimize page for PDF generation
    await page.emulateMediaType('print');
    
    // Set longer timeout for Heroku
    const timeout = isHeroku ? 30000 : 10000;
    
    // First pass: render without signature and footer to measure content height
    const tempHtml = html.replace(
      /<div class="signature-section">[\s\S]*?<\/div>\s*<div class="footer">[\s\S]*?<\/div>/,
      ''
    );
    
    await page.setContent(tempHtml, { 
      waitUntil: 'domcontentloaded',
      timeout: timeout
    });
    
    // Add extra wait time for fonts and images to load completely
    await new Promise(resolve => setTimeout(resolve, isHeroku ? 2000 : 1000));
    
    // Measure the actual content height
    const measurements = await page.evaluate(() => {
      const pageElement = document.querySelector('.page');
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
      waitUntil: 'domcontentloaded',
      timeout: timeout
    });
    
    // Add extra wait time for fonts and images to load completely
    await new Promise(resolve => setTimeout(resolve, isHeroku ? 2000 : 1000));
    
    const buffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '15mm', bottom: '25mm', left: '12mm', right: '12mm' },
      preferCSSPageSize: true,
      displayHeaderFooter: false,
      scale: 1.0, // Consistent scaling across devices
      width: '210mm', // Explicit A4 width
      height: '297mm', // Explicit A4 height
    });
    
    await page.close();
    await browser.close();
    
    return { buffer, serial, issueDateStr, generatedDateStr, grandTotal };
  } catch (err) {
    if (browser) await browser.close();
    throw err;
  }
};
