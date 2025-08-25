import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const assetToDataUri = async (relativePath) => {
	const absPath = path.resolve(__dirname, '..', relativePath);
	const ext = path.extname(absPath).slice(1).toLowerCase();
	const mime = ext === 'png' ? 'image/png' : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : `image/${ext}`;
	const file = await fs.readFile(absPath);
	const b64 = file.toString('base64');
	return `data:${mime};base64,${b64}`;
};

// Generate a professional multi-page PDF for pcIST statements
const generatePadPDF = async ({
	statement = '',
	authorizedBy = '',
	authorizerName = '',
	contactEmail = '',
	contactPhone = '',
	address = 'Institute of Science & Technology (IST), Dhaka',
}) => {
	// Prepare assets as data URIs for portability
	const istLogo = await assetToDataUri('assets/logos/IST_logo.png');
	const pcistLogo = await assetToDataUri('assets/logos/pcIST_logo.png');

	const today = new Date();
	const dateStr = today.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
	const serial = `pcIST-${today.getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

	// Normalize statement paragraphs
	const paragraphs = String(statement)
		.split(/\n\n+/)
		.map(p => p.trim())
		.filter(Boolean);

	const html = `
	<!doctype html>
	<html>
		<head>
			<meta charset="utf-8" />
			<title>pcIST Statement</title>
			<style>
				@page { size: A4; margin: 20mm 15mm; }
				body { font-family: Arial, Helvetica, sans-serif; color: #222; }
				.header { display: flex; align-items: center; justify-content: space-between; }
				.logo { width: 70px; height: 70px; object-fit: contain; border-radius: 12px; }
				.brand { text-align: center; flex: 1; }
				.brand h1 { margin: 0; font-size: 20px; letter-spacing: 0.5px; }
				.brand p { margin: 2px 0 0 0; font-size: 12px; color: #555; }
				.brand .contact-line { margin: 2px 0 0 0; font-size: 11px; color: #555; }
				.rule { margin: 12px 0 14px; height: 2px; background: linear-gradient(90deg, #0b5ed7, #9ec5fe); border: none; }
				.meta { display: flex; justify-content: space-between; font-size: 12px; color: #333; margin-bottom: 12px; }
				.content { font-size: 14px; line-height: 1.6; text-align: justify; }
				.content p { margin: 0 0 12px; }
				.footer { position: fixed; bottom: 20mm; left: 15mm; right: 15mm; }
				.signature { width: 260px; margin-left: auto; text-align: left; }
				.sig-line { border-top: 1px solid #0b5ed7; margin: 24px 0 6px; width: 220px; }
				.sig-name { font-weight: 600; }
				.page-break { page-break-after: always; }
			</style>
		</head>
		<body>
			<div class="header">
				<img class="logo" src="${istLogo}" alt="IST Logo" />
				<div class="brand">
					<h1>Programming Club of IST (pcIST)</h1>
					<p>${address}</p>
					<p class="contact-line">
						${contactEmail ? `Email: ${contactEmail}` : ''}
						${contactEmail && contactPhone ? ' | ' : ''}
						${contactPhone ? `Phone: ${contactPhone}` : ''}
					</p>
				</div>
				<img class="logo" src="${pcistLogo}" alt="pcIST Logo" />
			</div>
			<div class="rule"></div>
			<div class="meta">
				<div>Date: ${dateStr}</div>
				<div>SN: ${serial}</div>
			</div>

			<div class="content">
				${paragraphs.map(p => `<p>${p.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`).join('')}
			</div>

			<div class="footer">
				<div class="signature">
					<div class="sig-line"></div>
					<div class="sig-name">${authorizedBy || ''}</div>
					<div>${authorizerName || 'General Secretary'}</div>
					<div>pcIST</div>
				</div>
			</div>
		</body>
	</html>
	`;

	const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || process.env.CHROME_BIN || process.env.GOOGLE_CHROME_BIN;
	const launchOptions = {
		headless: 'new',
		args: [
			'--no-sandbox',
			'--disable-setuid-sandbox',
			'--disable-dev-shm-usage',
			'--disable-gpu',
			'--no-zygote',
			'--no-first-run'
		],
		...(executablePath ? { executablePath } : {})
	};
	const browser = await puppeteer.launch(launchOptions);
	try {
		const page = await browser.newPage();
		await page.setContent(html, { waitUntil: 'networkidle0' });
		const buffer = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' } });
		return { buffer, serial, dateStr };
	} finally {
		await browser.close();
	}
};

export { generatePadPDF };
