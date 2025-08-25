import { writeFile } from 'fs/promises';
import { generatePadPDF } from './generatePDF.js';

const sentences = [
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer in nulla ac nibh varius volutpat.',
  'Innovation thrives where curiosity meets persistence and collaboration.',
  'Clear communication creates clarity, trust, and momentum for teams.',
  'Practice and perseverance are the bedrock of mastery in any discipline.',
  'Small consistent steps compound into meaningful, lasting progress.'
];

const paragraph = Array.from({ length: 6 }, () => sentences[Math.floor(Math.random() * sentences.length)]).join(' ');

(async () => {
  const { buffer, serial, dateStr } = await generatePadPDF({
    statement: paragraph,
    authorizedBy: 'Test Signatory',
    authorizerName: 'General Secretary',
    contactEmail: 'pcist@example.com',
    contactPhone: '+8801XXXXXXXXX',
    address: 'Institute of Science & Technology (IST), Dhaka'
  });
  const out = `./_sample_random_${serial}.pdf`;
  await writeFile(out, buffer);
  console.log('Wrote', out, 'Date:', dateStr, 'Size:', buffer.length);
})();
