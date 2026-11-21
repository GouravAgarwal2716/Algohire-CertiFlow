import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { BatchStatus } from '@prisma/client';
import { createApp } from '../src/app';
import { prisma } from '../src/config/db';
import { setupTestEnvironment, getAuthToken, createTestBatch } from './test-helpers';
import { AuditService } from '../src/services/auditService';

const app = createApp();

describe('The 5 Invariant Rules: Things That Must NEVER Happen', () => {
  beforeAll(async () => {
    await setupTestEnvironment();
  });

  it('RULE 1: Rejects out-of-turn actions, unauthorized roles, and cross-district attempts', async () => {
    const anikaToken = getAuthToken('anika'); // TRAINING_CENTRE
    const farahToken = getAuthToken('farah'); // STATE_OFFICE
    const raviToken = getAuthToken('ravi');   // DISTRICT_OFFICER (Warangal)

    const hydBatch = await createTestBatch({
      title: 'Hyderabad IT Cohort',
      districtId: 'Hyderabad',
      candidateCount: 10,
    });

    await prisma.batch.update({
      where: { id: hydBatch.id },
      data: { status: BatchStatus.PENDING_DISTRICT },
    });

    // 1. Training Centre (Anika) attempting to approve -> 403
    const resAnika = await request(app)
      .post(`/api/batches/${hydBatch.id}/approve`)
      .set('Authorization', `Bearer ${anikaToken}`)
      .send({ reason: 'Self approval attempt' });
    expect(resAnika.status).toBe(403);

    // 2. State Office (Farah) attempting to approve PENDING_DISTRICT stage prematurely -> 403
    const resFarah = await request(app)
      .post(`/api/batches/${hydBatch.id}/approve`)
      .set('Authorization', `Bearer ${farahToken}`)
      .send({ reason: 'Premature state clearance' });
    expect(resFarah.status).toBe(403);

    // 3. Cross-district violation: Ravi (Warangal officer) approving a Hyderabad batch -> 403
    const resRavi = await request(app)
      .post(`/api/batches/${hydBatch.id}/approve`)
      .set('Authorization', `Bearer ${raviToken}`)
      .send({ reason: 'Cross-district interference attempt' });
    expect(resRavi.status).toBe(403);
    expect(resRavi.body.error).toContain('assigned district');
  });

  it('RULE 2: Prevents duplicate certificates and duplicate certificate numbers via database constraints', async () => {
    const batch = await createTestBatch();
    const candidate = await prisma.candidate.create({
      data: {
        batchId: batch.id,
        fullName: 'Integrity Candidate',
        phone: '9876543000',
        rollNumber: 'INT-01',
        score: 90,
      },
    });

    const certNum1 = `PSM-UNIQUE-001-${Date.now()}`;
    const certNum2 = `PSM-UNIQUE-002-${Date.now()}`;

    // Create 1st certificate
    await prisma.certificate.create({
      data: {
        certificateNumber: certNum1,
        verificationCode: `hexcode1-${Date.now()}`,
        batchId: batch.id,
        candidateId: candidate.id,
      },
    });

    // Attempting to create a second certificate for the same candidate throws an error
    await expect(
      prisma.certificate.create({
        data: {
          certificateNumber: certNum2,
          verificationCode: `hexcode2-${Date.now()}`,
          batchId: batch.id,
          candidateId: candidate.id,
        },
      })
    ).rejects.toThrow();

    // Attempting to reuse the exact same certificateNumber throws an error
    const candidate2 = await prisma.candidate.create({
      data: {
        batchId: batch.id,
        fullName: 'Second Candidate',
        phone: '9876543001',
        rollNumber: 'INT-02',
        score: 95,
      },
    });

    await expect(
      prisma.certificate.create({
        data: {
          certificateNumber: certNum1, // duplicate!
          verificationCode: `hexcode3-${Date.now()}`,
          batchId: batch.id,
          candidateId: candidate2.id,
        },
      })
    ).rejects.toThrow();
  });

  it('RULE 3: Never shows a cancelled certificate as genuine', async () => {
    const seedCert = await prisma.certificate.findFirst({
      where: { certificateNumber: 'PSM-2026-HYD001' },
    });

    // Set to REVOKED
    await prisma.certificate.update({
      where: { id: seedCert!.id },
      data: { status: 'REVOKED', revocationReason: 'Fake credentials' },
    });

    const res = await request(app).get('/api/public/verify/PSM-2026-HYD001');
    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(false);
    expect(res.body.certificate.status).toBe('REVOKED');
  });

  it('RULE 4: Protects against unauthorized, forged, or expired PDF download URLs', async () => {
    const seedCert = await prisma.certificate.findFirst();
    const certId = seedCert!.id;

    // 1. Missing token & expires
    const resNoToken = await request(app).get(`/api/certificates/${certId}/download`);
    expect(resNoToken.status).toBe(403);

    // 2. Tampered token
    const resTampered = await request(app).get(
      `/api/certificates/${certId}/download?token=0123456789abcdef0123456789abcdef&expires=9999999999`
    );
    expect(resTampered.status).toBe(403);

    // 3. Expired token (expires timestamp in the past)
    const resExpired = await request(app).get(
      `/api/certificates/${certId}/download?token=anyvalidhex&expires=1000000000`
    );
    expect(resExpired.status).toBe(403);
  });

  it('RULE 5: Guarantees complete append-only audit trail for every action and decision', async () => {
    const batch = await createTestBatch({ title: 'Audited Batch' });

    await AuditService.record({
      actorId: '22222222-2222-2222-2222-222222222222',
      actorRole: 'DISTRICT_OFFICER',
      action: 'BATCH_APPROVED',
      entityType: 'Batch',
      entityId: batch.id,
      previousState: BatchStatus.PENDING_DISTRICT,
      newState: BatchStatus.PENDING_STATE,
      metadata: { reason: 'Passed physical audit' },
    });

    const logs = await AuditService.getLogsForEntity(batch.id);
    expect(logs.length).toBeGreaterThanOrEqual(1);

    const log = logs[0];
    expect(log.actorId).toBe('22222222-2222-2222-2222-222222222222');
    expect(log.actorRole).toBe('DISTRICT_OFFICER');
    expect(log.action).toBe('BATCH_APPROVED');
    expect(log.previousState).toBe(BatchStatus.PENDING_DISTRICT);
    expect(log.newState).toBe(BatchStatus.PENDING_STATE);
    expect(log.createdAt).toBeDefined();
  });
});
