import crypto from 'crypto';
import { config } from '../config/env';

/**
 * Generates an HMAC-SHA256 signature for a certificate download request.
 */
export function generateSignedDownloadUrl(certificateId: string, expiresInSeconds: number = 86400): { url: string; token: string; expires: number } {
  const expires = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const payload = `${certificateId}:${expires}`;
  const token = crypto.createHmac('sha256', config.hmacSecret).update(payload).digest('hex');
  const url = `${config.apiUrl}/api/certificates/${certificateId}/download?token=${token}&expires=${expires}`;
  return { url, token, expires };
}

/**
 * Verifies the validity and expiration of a signed download URL token.
 */
export function verifySignedDownloadToken(certificateId: string, token: string, expiresStr: string): boolean {
  if (!token || !expiresStr) return false;

  const expires = parseInt(expiresStr, 10);
  if (isNaN(expires)) return false;

  // Check expiration
  const currentTimestamp = Math.floor(Date.now() / 1000);
  if (currentTimestamp > expires) {
    return false;
  }

  // Check cryptographic signature
  const payload = `${certificateId}:${expires}`;
  const expectedToken = crypto.createHmac('sha256', config.hmacSecret).update(payload).digest('hex');

  // Constant-time comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(Buffer.from(token, 'hex'), Buffer.from(expectedToken, 'hex'));
  } catch {
    return false;
  }
}
