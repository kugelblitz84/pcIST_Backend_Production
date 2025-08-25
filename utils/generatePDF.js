import path from 'path';
import { fileURLToPath } from 'url';
import PDFDocument from 'pdfkit';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helpers
const mm = (n) => (n * 72) / 25.4; // convert millimeters to PDF points
const assetPath = (relativePath) => path.resolve(__dirname, '..', relativePath);

// Generate a professional multi-page PDF for pcIST statements
const generatePadPDF = async ({
	statement = '',
	authorizedBy = '',
	authorizerName = '',
	contactEmail = '',
	contactPhone = '',
	address = 'Institute of Science & Technology (IST), Dhaka',
}) => {
	// Resolve and normalize logos to standard PNG buffers (PDFKit-friendly)
	const istLogoPath = assetPath('assets/logos/IST_logo.png');
	const pcistLogoPath = assetPath('assets/logos/pcIST_logo.png');
	const [istLogo, pcistLogo] = await Promise.all([
		sharp(istLogoPath).png({ compressionLevel: 9 }).toBuffer(),
		sharp(pcistLogoPath).png({ compressionLevel: 9 }).toBuffer(),
	]);

	const today = new Date();
	const dateStr = today.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
	const serial = `pcIST-${today.getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

	// Normalize statement paragraphs
	const paragraphs = String(statement)
		.split(/\n\n+/)
		.map((p) => p.trim())
		.filter(Boolean);

	// Create PDF in-memory
	const buffer = await new Promise((resolve, reject) => {
		const doc = new PDFDocument({
			size: 'A4',
			margins: { top: mm(20), bottom: mm(20), left: mm(15), right: mm(15) },
			info: { Title: 'pcIST Statement' },
		});
		const chunks = [];
		doc.on('data', (d) => chunks.push(d));
		doc.on('error', reject);
		doc.on('end', () => resolve(Buffer.concat(chunks)));

		const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
		const xLeft = doc.page.margins.left;
		let y = doc.page.margins.top;
		const logoYOffset = -16; // move logos further upward

		// Header
	const logoSize = 70; // points
	const corner = 12;
	// Left logo with rounded clip (slightly higher)
	doc.save();
	doc.roundedRect(xLeft, y + logoYOffset, logoSize, logoSize, corner).clip();
	doc.image(istLogo, xLeft, y + logoYOffset, { width: logoSize, height: logoSize });
	doc.restore();
	// Right logo with rounded clip
	const rightLogoX = doc.page.width - doc.page.margins.right - logoSize;
	doc.save();
	doc.roundedRect(rightLogoX, y + logoYOffset, logoSize, logoSize, corner).clip();
	doc.image(pcistLogo, rightLogoX, y + logoYOffset, { width: logoSize, height: logoSize });
	doc.restore();

		// Brand title centered
		doc.font('Helvetica-Bold').fontSize(20).fillColor('#000')
			.text('Programming Club of IST (pcIST)', xLeft, y + 8, { width: pageWidth, align: 'center' });
		// Address
		doc.font('Helvetica').fontSize(12).fillColor('#555')
			.text(address, xLeft, doc.y + 2, { width: pageWidth, align: 'center' });
		// Contact line
		const contactLine = [
			contactEmail ? `Email: ${contactEmail}` : null,
			contactPhone ? `Phone: ${contactPhone}` : null,
		].filter(Boolean).join(' | ');
		if (contactLine) {
			doc.fontSize(11).fillColor('#555').text(contactLine, xLeft, doc.y, { width: pageWidth, align: 'center' });
		}

		// Gradient rule
		const ruleY = doc.y + 8;
		const grad = doc.linearGradient(xLeft, ruleY, xLeft + pageWidth, ruleY);
		grad.stop(0, '#0b5ed7').stop(1, '#9ec5fe');
		doc.save();
		doc.rect(xLeft, ruleY, pageWidth, 2).fill(grad);
		doc.restore();

		// Meta line
		const metaY = ruleY + 12;
		doc.font('Helvetica').fontSize(12).fillColor('#333');
		doc.text(`Date: ${dateStr}`, xLeft, metaY, { width: pageWidth / 2, align: 'left' });
		doc.text(`SN: ${serial}`, xLeft + pageWidth / 2, metaY, { width: pageWidth / 2, align: 'right' });

		// Content
		const contentY = metaY + 16;
		doc.font('Helvetica').fontSize(12.5).fillColor('#222');
		doc.moveTo(xLeft, contentY);
		doc.y = contentY;
		const textOptions = { align: 'justify', lineGap: 5, width: pageWidth };
		paragraphs.forEach((p, idx) => {
			doc.text(p, xLeft, doc.y, textOptions);
			if (idx !== paragraphs.length - 1) doc.moveDown(0.6);
		});

		// Footer (signature) on each page
		const drawFooter = () => {
			const sigWidth = 260;
			const sigLineWidth = 220;
			const xSig = doc.page.width - doc.page.margins.right - sigWidth;
			// Place signature safely within content area near bottom (prevents page spill)
			const ySig = doc.page.height - doc.page.margins.bottom - 56;
			doc.save();
			doc.font('Helvetica').fontSize(12).fillColor('#000');
			// Signature line
			doc.moveTo(xSig, ySig).lineTo(xSig + sigLineWidth, ySig).lineWidth(1).stroke('#0b5ed7');
			// Texts
			doc.font('Helvetica-Bold').text(authorizedBy || '', xSig, ySig + 6, { width: sigWidth, align: 'left' });
			doc.font('Helvetica').text(authorizerName || 'General Secretary', xSig, ySig + 22, { width: sigWidth, align: 'left' });
			doc.text('pcIST', xSig, ySig + 38, { width: sigWidth, align: 'left' });
			doc.restore();
		};

		drawFooter();
		doc.on('pageAdded', drawFooter);

		doc.end();
	});

	return { buffer, serial, dateStr };
};

export { generatePadPDF };
