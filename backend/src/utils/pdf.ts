import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { generateVerificationQRCode } from './qr';
import { config } from '../config/env';

export interface CertificatePdfData {
  certificateNumber: string;
  verificationCode: string;
  candidateName: string;
  courseName: string;
  centreName: string;
  district: string;
  issueDate: Date;
  score?: number;
}

export async function generateCertificatePDF(data: CertificatePdfData): Promise<string> {
  // Ensure certificate storage directory exists
  if (!fs.existsSync(config.certStoragePath)) {
    fs.mkdirSync(config.certStoragePath, { recursive: true });
  }

  const filePath = path.join(config.certStoragePath, `${data.certificateNumber}.pdf`);

  // Generate QR code buffer
  const qrBuffer = await generateVerificationQRCode(data.certificateNumber);

  return new Promise((resolve, reject) => {
    // Landscape A4 certificate
    const doc = new PDFDocument({
      layout: 'landscape',
      size: 'A4',
      margins: { top: 30, bottom: 30, left: 30, right: 30 },
    });

    const writeStream = fs.createWriteStream(filePath);
    doc.pipe(writeStream);

    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;

    // Draw ornate double border
    doc
      .rect(20, 20, pageWidth - 40, pageHeight - 40)
      .lineWidth(4)
      .strokeColor('#0f172a') // Slate 900
      .stroke();

    doc
      .rect(26, 26, pageWidth - 52, pageHeight - 52)
      .lineWidth(1)
      .strokeColor('#3b82f6') // Blue 500
      .stroke();

    // Top Header Banner
    doc
      .fontSize(22)
      .font('Helvetica-Bold')
      .fillColor('#1e3a8a')
      .text('PRAGATI SKILLS MISSION', 0, 45, { align: 'center' });

    doc
      .fontSize(11)
      .font('Helvetica')
      .fillColor('#64748b')
      .text('STATE COUNCIL FOR VOCATIONAL EDUCATION & TRAINING', 0, 72, { align: 'center' });

    doc
      .moveDown(0.5)
      .fontSize(18)
      .font('Helvetica-Bold')
      .fillColor('#0f172a')
      .text('CERTIFICATE OF VOCATIONAL PROFICIENCY', 0, 100, { align: 'center' });

    // Decorative line
    doc
      .moveTo(pageWidth / 2 - 150, 126)
      .lineTo(pageWidth / 2 + 150, 126)
      .lineWidth(2)
      .strokeColor('#2563eb')
      .stroke();

    // Body Text
    doc
      .fontSize(13)
      .font('Helvetica')
      .fillColor('#475569')
      .text('This is to certify that', 0, 142, { align: 'center' });

    doc
      .fontSize(26)
      .font('Helvetica-Bold')
      .fillColor('#1d4ed8')
      .text(data.candidateName.toUpperCase(), 0, 165, { align: 'center' });

    doc
      .fontSize(13)
      .font('Helvetica')
      .fillColor('#475569')
      .text('has successfully completed the government-approved assessment in', 0, 202, { align: 'center' });

    doc
      .fontSize(20)
      .font('Helvetica-Bold')
      .fillColor('#0f172a')
      .text(data.courseName, 0, 222, { align: 'center' });

    doc
      .fontSize(12)
      .font('Helvetica')
      .fillColor('#334155')
      .text(
        `Conducted at ${data.centreName} (${data.district} District) with an evaluation score of ${data.score !== undefined ? data.score.toFixed(1) + '%' : 'PASSED'}.`,
        0,
        254,
        { align: 'center' }
      );

    // Verification Section & Details (Bottom Left & Right)
    const formattedDate = data.issueDate.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    // Left Column: Metadata & Security
    const metaX = 50;
    const metaY = 320;
    doc
      .fontSize(10)
      .font('Helvetica-Bold')
      .fillColor('#1e293b')
      .text(`Certificate No:`, metaX, metaY)
      .font('Helvetica')
      .fillColor('#2563eb')
      .text(data.certificateNumber, metaX + 85, metaY);

    doc
      .fontSize(10)
      .font('Helvetica-Bold')
      .fillColor('#1e293b')
      .text(`Verification Key:`, metaX, metaY + 18)
      .font('Helvetica')
      .fillColor('#475569')
      .text(data.verificationCode, metaX + 85, metaY + 18);

    doc
      .fontSize(10)
      .font('Helvetica-Bold')
      .fillColor('#1e293b')
      .text(`Issued On:`, metaX, metaY + 36)
      .font('Helvetica')
      .fillColor('#475569')
      .text(formattedDate, metaX + 85, metaY + 36);

    doc
      .fontSize(10)
      .font('Helvetica-Bold')
      .fillColor('#1e293b')
      .text(`Status:`, metaX, metaY + 54)
      .font('Helvetica-Bold')
      .fillColor('#16a34a')
      .text('OFFICIALLY VALID & VERIFIED', metaX + 85, metaY + 54);

    // Center-Right: QR Code
    const qrX = pageWidth - 210;
    const qrY = 300;
    doc.image(qrBuffer, qrX, qrY, { width: 100, height: 100 });
    doc
      .fontSize(8)
      .font('Helvetica-Bold')
      .fillColor('#475569')
      .text('Scan with any camera', qrX - 10, qrY + 105, { width: 120, align: 'center' })
      .font('Helvetica')
      .text('to instantly verify', qrX - 10, qrY + 115, { width: 120, align: 'center' });

    // Official State Digital Seal / Authority Signature
    const sigX = pageWidth / 2 - 60;
    const sigY = 330;
    doc
      .fontSize(11)
      .font('Helvetica-Bold')
      .fillColor('#0f172a')
      .text('Farah Khan, IAS', sigX, sigY, { width: 140, align: 'center' })
      .fontSize(9)
      .font('Helvetica')
      .fillColor('#64748b')
      .text('Director of State Certifications\nPragati Skills Mission', sigX, sigY + 15, { width: 140, align: 'center' });

    // Finalize PDF
    doc.end();

    writeStream.on('finish', () => {
      resolve(filePath);
    });

    writeStream.on('error', (err) => {
      reject(err);
    });
  });
}
