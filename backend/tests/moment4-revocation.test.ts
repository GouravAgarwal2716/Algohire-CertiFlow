import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/config/db';
import { redis } from '../src/config/redis';
import { setupTestEnvironment, getAuthToken } from './test-helpers';
import { CertificateStatus } from '@prisma/client';

const app = createApp();

describe('Moment 4: Instant Certificate Revocation & Public Verification', () => {
  const certNumber = 'PSM-2026-HYD001'; // From seed
  let certId: string;

  beforeAll(async () => {
    await setupTestEnvironment();
    // Ensure certificate is in VALID status for this test
    await prisma.certificate.updateMany({
      where: { certificateNumber: certNumber },
      data: { status: CertificateStatus.VALID, revokedAt: null, revocationReason: null },
    });
    const cert = await prisma.certificate.findUnique({
      where: { certificateNumber: certNumber },
    });
    certId = cert!.id;
    // Clear redis cache before test
    await redis.del(`verify:${certNumber}`);
  });

  it('allows public verification without authentication and redacts sensitive PII', async () => {
    const res = await request(app).get(`/api/public/verify/${certNumber}`);

    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(true);
    expect(res.body.certificate).toBeDefined();
    expect(res.body.certificate.certificateNumber).toBe(certNumber);
    expect(res.body.certificate.status).toBe('VALID');
    expect(res.body.certificate.candidateName).toBeDefined();
    expect(res.body.certificate.courseName).toBeDefined();

    // STRICT SECURITY: Prove that sensitive personal data is NOT exposed
    expect(res.body.certificate.phone).toBeUndefined();
    expect(res.body.certificate.email).toBeUndefined();
    expect(res.body.certificate.rollNumber).toBeUndefined();
    expect(res.body.certificate.pdfPath).toBeUndefined();

    // Verify it is cached in Redis
    const cached = await redis.get(`verify:${certNumber}`);
    expect(cached).not.toBeNull();
    const parsedCache = JSON.parse(cached!);
    expect(parsedCache.certificateNumber).toBe(certNumber);
  });

  it('instantly invalidates cache upon revocation, and public check returns REVOKED immediately', async () => {
    const farahToken = getAuthToken('farah');

    // 1. Farah revokes the certificate
    const revokeRes = await request(app)
      .post(`/api/certificates/${certId}/revoke`)
      .set('Authorization', `Bearer ${farahToken}`)
      .send({ reason: 'Forged assessment practical exam logs' });

    expect(revokeRes.status).toBe(200);
    expect(revokeRes.body.certificate.status).toBe(CertificateStatus.REVOKED);
    expect(revokeRes.body.certificate.revocationReason).toBe('Forged assessment practical exam logs');

    // 2. CRITICAL: Check public verification immediately (simulating an employer checking 1 second later)
    const employerCheck = await request(app).get(`/api/public/verify/${certNumber}`);

    expect(employerCheck.status).toBe(200);
    expect(employerCheck.body.valid).toBe(false);
    expect(employerCheck.body.certificate.status).toBe('REVOKED');
    expect(employerCheck.body.certificate.revocationReason).toBe('Forged assessment practical exam logs');
    expect(employerCheck.body.certificate.revokedAt).toBeDefined();
  });
});
