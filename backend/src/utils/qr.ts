import QRCode from 'qrcode';
import { config } from '../config/env';

/**
 * Generates a PNG Buffer of the QR code pointing to the public verification URL
 */
export async function generateVerificationQRCode(certNumber: string): Promise<Buffer> {
  const verifyUrl = `${config.publicAppUrl}/verify/${certNumber}`;
  return QRCode.toBuffer(verifyUrl, {
    errorCorrectionLevel: 'H',
    type: 'png',
    margin: 1,
    width: 140,
    color: {
      dark: '#1e293b',
      light: '#ffffff',
    },
  });
}
