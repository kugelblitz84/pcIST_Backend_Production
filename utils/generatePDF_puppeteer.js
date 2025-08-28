import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const assetPath = (relativePath) => path.resolve(__dirname, '..', relativePath);

// Generate PDF using Puppeteer by rendering an HTML template.
// Returns { buffer, serial, dateStr }
const generatePadPDFWithPuppeteer = async ({
  statement = '',
  authorizedBy = '',
  authorizerName = '',
  contactEmail = '',
  contactPhone = '',
  address = 'Institute of Science & Technology (IST), Dhaka',
} = {}) => {
  // Normalize logos to PNG and embed as data URIs
  const istLogoPath = assetPath('assets/logos/IST_logo.png');
  const pcistLogoPath = assetPath('assets/logos/pcIST_logo.png');
  const [istBuf, pcistBuf] = await Promise.all([
    sharp(istLogoPath).png({ compressionLevel: 9 }).toBuffer(),
    sharp(pcistLogoPath).png({ compressionLevel: 9 }).toBuffer(),
  ]);
  const istData = `data:image/png;base64,${istBuf.toString('base64')}`;
  const pcistData = `data:image/png;base64,${pcistBuf.toString('base64')}`;

  const today = new Date();
  const dateStr = today.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
  const serial = `pcIST-${today.getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

  // Build simple, print-ready HTML that mirrors the PDFKit design
  const paragraphs = String(statement)
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p class="para">${p.replace(/\n/g, '<br/>')}</p>`)
    .join('\n');

  const contactLine = [contactEmail ? `Email: ${contactEmail}` : null, contactPhone ? `Phone: ${contactPhone}` : null]
    .filter(Boolean)
    .join(' | ');

  const html = `
  <!doctype html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <style>
      @page { size: A4; margin: 20mm 15mm; }
      body { font-family: Arial, Helvetica, sans-serif; color: #222; margin: 0; }
      .header { text-align: center; position: relative; }
      .logo-left, .logo-right { width: 70px; height: 70px; border-radius: 12px; object-fit: cover; position: absolute; top: -16px; }
      .logo-left { left: 0; }
      .logo-right { right: 0; }
      h1 { margin: 8px 0 2px 0; font-size: 20px; }
      .address { color: #555; font-size: 12px; margin-bottom: 4px; }
      .contact { color: #555; font-size: 11px; margin-bottom: 8px; }
      .rule { height: 4px; background: linear-gradient(90deg, #0b5ed7 0%, #9ec5fe 100%); margin-bottom: 12px; }
      .meta { display: flex; justify-content: space-between; font-size: 12px; color: #333; margin-bottom: 12px; }
      .content { font-size: 12.5px; line-height: 1.6; text-align: justify; }
      .content .para { margin: 0 0 10px 0; }
      .signature { width: 260px; float: right; margin-top: 40px; }
      .sig-line { width: 220px; height: 1px; background: #0b5ed7; margin-bottom: 6px; }
      .sig-name { font-weight: 700; margin-bottom: 6px; }
      .sig-role { margin-bottom: 6px; }
      footer { clear: both; }
      /* Ensure content does not overflow; allow page breaks */
      .page-break { page-break-after: always; }
    </style>
  </head>
  <body>
    <div class="header">
      <img class="logo-left" src="${istData}" alt="IST">
      <img class="logo-right" src="${pcistData}" alt="pcIST">
      <h1>Programming Club of IST (pcIST)</h1>
      <div class="address">${address}</div>
      ${contactLine ? `<div class="contact">${contactLine}</div>` : ''}
    </div>
    <div class="rule"></div>
    <div class="meta">
      <div>Date: ${dateStr}</div>
      <div>SN: ${serial}</div>
    </div>
    <div class="content">
      ${paragraphs}
    </div>
    <div class="signature">
      <div class="sig-line"></div>
      <div class="sig-name">${authorizedBy || ''}</div>
      <div class="sig-role">${authorizerName || 'General Secretary'}</div>
      <div>pcIST</div>
    </div>
  </body>
  </html>
  `;

  // Launch puppeteer lazily to avoid hard dependency at module load
  let puppeteer;
  try {
    puppeteer = (await import('puppeteer')).default;
  } catch (err) {
    // If puppeteer is not installed, surface clear error
    throw new Error('Puppeteer is not installed. Install puppeteer to use the Puppeteer PDF generator.');
  }

  const launchArgs = ['--no-sandbox', '--disable-setuid-sandbox'];
  const execPath = process.env.PUPPETEER_EXECUTABLE_PATH || process.env.GOOGLE_CHROME_BIN || undefined;

  const browser = await puppeteer.launch({ headless: true, args: launchArgs, executablePath: execPath });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const buffer = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' } });
    await page.close();
    await browser.close();
    return { buffer, serial, dateStr };
  } catch (err) {
    await browser.close();
    throw err;
  }
};

export { generatePadPDFWithPuppeteer };
