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
  // legacy single authorizer fields
  authorizedBy = '',
  authorizerName = '',
  // optional second authorizer legacy fields
  authorizedBy2 = '',
  authorizerName2 = '',
  // new preferred array form: [{ name, role }]
  authorizers: authorizersParam = undefined,
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

  // Build authorizers array (support legacy single/two fields and new array shape)
  let authorizers = [];
  if (Array.isArray(authorizersParam) && authorizersParam.length > 0) {
    authorizers = authorizersParam.slice(0, 2).map((a) => ({ name: a.name || '', role: a.role || a.title || '' }));
  } else {
    if (authorizedBy || authorizerName) {
      authorizers.push({ name: authorizedBy || '', role: authorizerName || '' });
    }
    if (authorizedBy2 || authorizerName2) {
      authorizers.push({ name: authorizedBy2 || '', role: authorizerName2 || '' });
    }
  }
  // Ensure at most 2
  authorizers = authorizers.slice(0, 2);

  // Signature HTML for up to two authorizers
  const signatureHtml = (() => {
    if (authorizers.length === 0) return '';
    if (authorizers.length === 1) {
      const a = authorizers[0];
      return `<div class="signatures"><div class="sig single"><div class="sig-line"></div><div class="sig-name">${a.name || ''}</div><div class="sig-role">${a.role || ''}</div><div>pcIST</div></div></div>`;
    }
    // two
    const left = authorizers[0];
    const right = authorizers[1];
    return `<div class="signatures"><div class="sig left"><div class="sig-line"></div><div class="sig-name">${left.name || ''}</div><div class="sig-role">${left.role || ''}</div><div>pcIST</div></div><div class="sig right"><div class="sig-line"></div><div class="sig-name">${right.name || ''}</div><div class="sig-role">${right.role || ''}</div><div>pcIST</div></div></div>`;
  })();

  const html = `
  <!doctype html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <style>
  /* reserve extra bottom space so an absolute-positioned signature won't force a new page */
  @page { size: A4; margin: 20mm 15mm 30mm 15mm; }
  body { font-family: Arial, Helvetica, sans-serif; color: #222; margin: 0; }
  .header { text-align: center; position: relative; padding-top: 6mm; }
  /* logos slightly inset and fully visible */
  .logo-left, .logo-right { width: 70px; height: 70px; border-radius: 12px; object-fit: cover; position: absolute; top: 0.5mm; }
  .logo-left { left: 4mm; }
  .logo-right { right: 4mm; }
  h1 { margin: 8px 0 2px 0; font-size: 20px; }
  .address { color: #555; font-size: 12px; margin-bottom: 4px; }
  .contact { color: #555; font-size: 11px; margin-bottom: 8px; }
  .rule { height: 4px; background: linear-gradient(90deg, #0b5ed7 0%, #9ec5fe 100%); margin-bottom: 12px; }
  .meta { display: flex; justify-content: space-between; font-size: 12px; color: #333; margin-bottom: 12px; }
  .content { font-size: 12.5px; line-height: 1.6; text-align: justify; }
  .content .para { margin: 0 0 10px 0; }

  /* signatures area (supports 1 or 2 signatories) */
  .signatures { position: absolute; left: 15mm; right: 15mm; bottom: 12mm; display: flex; justify-content: space-between; align-items: flex-end; }
  .sig { width: 260px; }
  .sig.single { margin-left: auto; margin-right: auto; text-align: center; }
  .sig.left { text-align: left; }
  .sig.right { text-align: right; }
  .sig-line { width: 220px; height: 1px; background: #0b5ed7; margin-bottom: 6px; display: block; }
  .sig-name { font-weight: 700; margin-bottom: 6px; }
  .sig-role { margin-bottom: 6px; }

  /* corner decorative triangles */
  .corner { position: fixed; width: 0; height: 0; border-style: solid; z-index: 10; }
  .corner.tl { left: 0; top: 0; border-width: 0 0 48px 48px; border-color: transparent transparent #0b5ed7 transparent; }
  .corner.br { right: 0; bottom: 0; border-width: 48px 48px 0 0; border-color: #0b5ed7 transparent transparent transparent; }

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
  ${signatureHtml}
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
