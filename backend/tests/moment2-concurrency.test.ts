import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { BatchStatus } from '@prisma/client';
import { createApp } from '../src/app';
import { prisma } from '../src/config/db';
import { setupTestEnvironment, getAuthToken, createTestBatch } from './test-helpers';

const app = createApp();

describe('Moment 2: Concurrency-Safe Multi-Officer District Approval', () => {
  beforeAll(async () => {
    await setupTestEnvironment();
  });

  it('handles simultaneous approvals by 2 officers cleanly, moving the batch forward exactly once', async () => {
    const devToken = getAuthToken('dev');
    const meeraToken = getAuthToken('meera');

    // Create a batch in PENDING_DISTRICT with 10 candidates (< 50 threshold)
    const batch = await createTestBatch({
      title: 'Small Batch Concurrency Test',
      candidateCount: 10,
    });

    await prisma.batch.update({
      where: { id: batch.id },
      data: { status: BatchStatus.PENDING_DISTRICT },
    });

    // Fire both approvals concurrently at the exact same millisecond
    const [resDev, resMeera] = await Promise.all([
      request(app)
        .post(`/api/batches/${batch.id}/approve`)
        .set('Authorization', `Bearer ${devToken}`)
        .send({ reason: 'Approved by Dev' }),
      request(app)
        .post(`/api/batches/${batch.id}/approve`)
        .set('Authorization', `Bearer ${meeraToken}`)
        .send({ reason: 'Approved by Meera' }),
    ]);

    expect(resDev.status).toBe(200);
    expect(resMeera.status).toBe(200);

    // Fetch batch from database
    const updatedBatch = await prisma.batch.findUnique({
      where: { id: batch.id },
      include: { approvals: true },
    });

    // Must be PENDING_STATE (since candidateCount < 50)
    expect(updatedBatch?.status).toBe(BatchStatus.PENDING_STATE);

    // Exactly 2 approvals recorded for revision 1
    const rev1Approvals = updatedBatch?.approvals.filter((a) => a.revisionNumber === 1);
    expect(rev1Approvals?.length).toBe(2);

    // Both officers recorded
    const officerIds = rev1Approvals?.map((a) => a.officerId);
    expect(officerIds).toContain('22222222-2222-2222-2222-222222222222'); // Dev
    expect(officerIds).toContain('33333333-3333-3333-3333-333333333333'); // Meera
  });

  it('routes large batches (>= 50 candidates) to PENDING_QUALITY upon 2 district approvals', async () => {
    const devToken = getAuthToken('dev');
    const meeraToken = getAuthToken('meera');

    const largeBatch = await createTestBatch({
      title: 'Large 60-Candidate Cohort',
      candidateCount: 60,
    });

    await prisma.batch.update({
      where: { id: largeBatch.id },
      data: { status: BatchStatus.PENDING_DISTRICT },
    });

    // Dev approves
    const res1 = await request(app)
      .post(`/api/batches/${largeBatch.id}/approve`)
      .set('Authorization', `Bearer ${devToken}`)
      .send({ reason: 'First review clean' });
    expect(res1.status).toBe(200);

    // After 1 approval, still PENDING_DISTRICT
    let check = await prisma.batch.findUnique({ where: { id: largeBatch.id } });
    expect(check?.status).toBe(BatchStatus.PENDING_DISTRICT);

    // Meera approves (2nd approval)
    const res2 = await request(app)
      .post(`/api/batches/${largeBatch.id}/approve`)
      .set('Authorization', `Bearer ${meeraToken}`)
      .send({ reason: 'Second review clean' });
    expect(res2.status).toBe(200);

    // Because candidateCount >= 50, MUST transition to PENDING_QUALITY for Neha
    check = await prisma.batch.findUnique({ where: { id: largeBatch.id } });
    expect(check?.status).toBe(BatchStatus.PENDING_QUALITY);
  });

  it('rejects duplicate approval from the same officer on the same revision with 409 Conflict', async () => {
    const devToken = getAuthToken('dev');

    const batch = await createTestBatch({
      title: 'Duplicate Prevention Test',
      candidateCount: 5,
    });

    await prisma.batch.update({
      where: { id: batch.id },
      data: { status: BatchStatus.PENDING_DISTRICT },
    });

    // First approval
    const firstRes = await request(app)
      .post(`/api/batches/${batch.id}/approve`)
      .set('Authorization', `Bearer ${devToken}`)
      .send({ reason: 'Initial approval' });
    expect(firstRes.status).toBe(200);

    // Second approval by Dev on same revision
    const secondRes = await request(app)
      .post(`/api/batches/${batch.id}/approve`)
      .set('Authorization', `Bearer ${devToken}`)
      .send({ reason: 'Attempted duplicate approval' });

    expect(secondRes.status).toBe(409);
    expect(secondRes.body.error).toContain('already approved');
  });
});
