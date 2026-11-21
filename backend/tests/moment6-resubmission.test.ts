import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { BatchStatus, ApprovalDecision } from '@prisma/client';
import { createApp } from '../src/app';
import { prisma } from '../src/config/db';
import { setupTestEnvironment, getAuthToken, createTestBatch } from './test-helpers';

const app = createApp();

describe('Moment 6: Send-Back & Resubmission Policy', () => {
  beforeAll(async () => {
    await setupTestEnvironment();
  });

  it('preserves previous approvals in history while requiring fresh approvals for new revisions', async () => {
    const anikaToken = getAuthToken('anika');
    const devToken = getAuthToken('dev');
    const meeraToken = getAuthToken('meera');

    // 1. Create a batch and submit it (Revision 1)
    const batch = await createTestBatch({
      title: 'Resubmission Cycle Test Batch',
      candidateCount: 10,
    });

    // Add candidates
    await prisma.candidate.create({
      data: {
        batchId: batch.id,
        fullName: 'Original Student',
        phone: '9876543299',
        rollNumber: 'RESUB-01',
        score: 75,
      },
    });

    await prisma.batch.update({
      where: { id: batch.id },
      data: { status: BatchStatus.PENDING_DISTRICT, candidateCount: 1, revisionNumber: 1 },
    });

    // Dev approves revision 1
    const app1 = await request(app)
      .post(`/api/batches/${batch.id}/approve`)
      .set('Authorization', `Bearer ${devToken}`)
      .send({ reason: 'Looks acceptable on initial pass' });
    expect(app1.status).toBe(200);

    // 2. Meera finds an issue and sends it back (CHANGES_REQUESTED)
    const sendBackRes = await request(app)
      .post(`/api/batches/${batch.id}/changes-requested`)
      .set('Authorization', `Bearer ${meeraToken}`)
      .send({ reason: 'Aadhaar linkage incomplete for student' });
    expect(sendBackRes.status).toBe(200);

    let check = await prisma.batch.findUnique({ where: { id: batch.id } });
    expect(check?.status).toBe(BatchStatus.CHANGES_REQUESTED);

    // 3. Anika edits and resubmits
    const resubmitRes = await request(app)
      .post(`/api/batches/${batch.id}/submit`)
      .set('Authorization', `Bearer ${anikaToken}`)
      .send({});
    expect(resubmitRes.status).toBe(200);

    check = await prisma.batch.findUnique({ where: { id: batch.id } });
    // Must be back in PENDING_DISTRICT
    expect(check?.status).toBe(BatchStatus.PENDING_DISTRICT);
    // Revision number MUST have incremented to 2!
    expect(check?.revisionNumber).toBe(2);

    // 4. Verify that Dev's old approval was for revision 1, so revision 2 currently has 0 approvals!
    const rev2Approvals = await prisma.batchApproval.findMany({
      where: { batchId: batch.id, revisionNumber: 2 },
    });
    expect(rev2Approvals.length).toBe(0);

    // But history of revision 1 approvals is permanently intact!
    const allApprovals = await prisma.batchApproval.findMany({
      where: { batchId: batch.id },
      orderBy: { createdAt: 'asc' },
    });
    expect(allApprovals.length).toBe(2); // Dev's APPROVED + Meera's CHANGES_REQUESTED
    expect(allApprovals[0].revisionNumber).toBe(1);
    expect(allApprovals[0].decision).toBe(ApprovalDecision.APPROVED);
    expect(allApprovals[1].revisionNumber).toBe(1);
    expect(allApprovals[1].decision).toBe(ApprovalDecision.CHANGES_REQUESTED);

    // 5. Dev can now approve the new revision 2 cleanly
    const freshApp = await request(app)
      .post(`/api/batches/${batch.id}/approve`)
      .set('Authorization', `Bearer ${devToken}`)
      .send({ reason: 'Re-reviewed revision 2; Aadhaar issue resolved' });
    expect(freshApp.status).toBe(200);

    const rev2Check = await prisma.batchApproval.findMany({
      where: { batchId: batch.id, revisionNumber: 2 },
    });
    expect(rev2Check.length).toBe(1);
  });
});
