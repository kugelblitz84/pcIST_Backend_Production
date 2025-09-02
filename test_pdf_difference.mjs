import { generatePadPDFWithPuppeteer } from './utils/generatePDF_puppeteer.js';
import fs from 'fs';

const testParams = {
  statement: "Test statement for comparing PDF generation",
  authorizers: [
    { name: "Test User 1", role: "Tester" }
  ],
  contactEmail: "test@pcist.org",
  contactPhone: "+8801234567890",
  address: "Test Institute, Dhaka"
};

console.log("🧪 Testing PDF generation differences...");

try {
  // Generate first PDF (simulating download)
  console.log("📄 Generating PDF 1 (download simulation)...");
  const result1 = await generatePadPDFWithPuppeteer(testParams);
  fs.writeFileSync('./test-pdf-1.pdf', result1.buffer);
  console.log(`✅ PDF 1: Serial=${result1.serial}, Date=${result1.dateStr}`);

  // Generate second PDF immediately (simulating email)
  console.log("📄 Generating PDF 2 (email simulation)...");
  const result2 = await generatePadPDFWithPuppeteer(testParams);
  fs.writeFileSync('./test-pdf-2.pdf', result2.buffer);
  console.log(`✅ PDF 2: Serial=${result2.serial}, Date=${result2.dateStr}`);

  if (result1.serial !== result2.serial) {
    console.log("⚠️  FOUND THE ISSUE: PDFs have different serial numbers!");
    console.log(`   PDF 1 serial: ${result1.serial}`);
    console.log(`   PDF 2 serial: ${result2.serial}`);
  } else {
    console.log("✅ Both PDFs have the same serial number");
  }

} catch (error) {
  console.error("❌ Error:", error.message);
}
