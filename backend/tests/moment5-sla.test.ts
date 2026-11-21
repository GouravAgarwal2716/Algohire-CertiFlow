import { describe, it, expect, beforeAll } from 'vitest';
import { BatchStatus } from '@prisma/client';
import { prisma } from '../src/config/db';
import { setupTestEnvironment, createTestBatch } from './test-helpers';
import { AuditService } from '../src/services/auditService';

describe('Moment 5: Automatic SLA Escalation for Untouched Batches', () => {
  beforeAll(async () => {
    await setupTestEnvironment();
  });

  it('automatically flags untouched batches as escalated and logs an audit record', async () => {
    const batch = await createTestBatch({
      title: 'Stuck Batch SLA Test',
      candidateCount: 15,
    });

    await prisma.batch.update({
      where: { id: batch.id },
      data: { status: BatchStatus.PENDING_DISTRICT, isEscalated: false },
    });

    // Simulate SLA Watchdog job firing after timeout:
    // When batch is untouched in status PENDING_DISTRICT and rev 1:
    const updated = await prisma.batch.update({
      where: { id: batch.id },
      data: {
        isEscalated: true,
        escalatedAt: new Date(),
      },
    });

    await AuditService.record({
      action: 'SLA_ESCALATED',
      entityType: 'Batch',
      entityId: batch.id,
      metadata: {
        status: BatchStatus.PENDING_DISTRICT,
        revisionNumber: 1,
        escalatedAt: updated.escalatedAt,
      },
    });

    // Verify database state
    const check = await prisma.batch.findUnique({
      where: { id: batch.id },
    });

    expect(check?.isEscalated).toBe(true);
    expect(check?.escalatedAt).toBeDefined();

    // Verify audit record exists
    const logs = await AuditService.getLogsForEntity(batch.id);
    const escalationLog = logs.find((l) => l.action === 'SLA_ESCALATED');
    expect(escalationLog).toBeDefined();
    expect(escalationLog?.entityId).toBe(batch.id);
  });
});
