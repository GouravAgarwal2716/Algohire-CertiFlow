import { BatchStatus, Role, ApprovalDecision } from '@prisma/client';
import { prisma } from '../config/db';
import { AppError } from '../middleware/errorHandler';
import { AuditService } from './auditService';
import { sseService } from './sseService';
import { cancelSlaWatchdog, enqueueSlaWatchdog, enqueueCertificateIssuance } from '../queues/queue';

export class ApprovalService {
  /**
   * Moment 2: Concurrency-Safe Approval with Row-Level Locking
   */
  public static async approveBatch(params: {
    batchId: string;
    userId: string;
    userRole: Role;
    userDistrictId?: string | null;
    reason?: string;
    correlationId?: string;
  }) {
    return prisma.$transaction(async (tx) => {
      // 1. Acquire PostgreSQL Row-Level Lock on the Batch
      // This forces any concurrent approval requests to wait sequentially!
      await tx.$executeRaw`SELECT id FROM "Batch" WHERE id = ${params.batchId} FOR UPDATE`;

      const batch = await tx.batch.findUnique({
        where: { id: params.batchId },
        include: {
          candidates: true,
          approvals: {
            where: { revisionNumber: { equals: undefined } }, // placeholder, will fetch by current revision below
          },
        },
      });

      if (!batch) {
        throw new AppError(404, 'Batch not found');
      }

      // Fetch approvals for the current revision
      const currentRevisionApprovals = await tx.batchApproval.findMany({
        where: {
          batchId: batch.id,
          revisionNumber: batch.revisionNumber,
        },
      });

      const previousStatus = batch.status;
      let nextStatus = batch.status;
      let shouldEnqueueIssuance = false;

      // 2. State & Role Validation
      if (batch.status === BatchStatus.PENDING_DISTRICT) {
        // Must be DISTRICT_OFFICER
        if (params.userRole !== Role.DISTRICT_OFFICER) {
          throw new AppError(403, `Forbidden: only District Officers can approve batches in PENDING_DISTRICT stage`);
        }

        // Cross-district isolation check
        if (params.userDistrictId && params.userDistrictId !== batch.districtId) {
          throw new AppError(403, `Forbidden: you can only approve batches from your assigned district (${params.userDistrictId})`);
        }

        // Check if this officer already approved this revision
        const alreadyApproved = currentRevisionApprovals.some(
          (a) => a.officerId === params.userId && a.decision === ApprovalDecision.APPROVED
        );
        if (alreadyApproved) {
          throw new AppError(409, 'Officer has already approved this batch revision');
        }

        // Record the approval
        await tx.batchApproval.create({
          data: {
            batchId: batch.id,
            officerId: params.userId,
            role: params.userRole,
            revisionNumber: batch.revisionNumber,
            decision: ApprovalDecision.APPROVED,
            reason: params.reason || null,
          },
        });

        // Check distinct district approvals for this revision (including the one just added)
        const totalDistrictApprovals =
          currentRevisionApprovals.filter(
            (a) => a.role === Role.DISTRICT_OFFICER && a.decision === ApprovalDecision.APPROVED
          ).length + 1;

        // Quorum rule: Requires 2 distinct district officers
        if (totalDistrictApprovals >= 2) {
          // If >= 50 candidates, route to QUALITY_TEAM; else directly to STATE_OFFICE
          if (batch.candidateCount >= 50) {
            nextStatus = BatchStatus.PENDING_QUALITY;
          } else {
            nextStatus = BatchStatus.PENDING_STATE;
          }
        }
      } else if (batch.status === BatchStatus.PENDING_QUALITY) {
        // Must be QUALITY_TEAM
        if (params.userRole !== Role.QUALITY_TEAM) {
          throw new AppError(403, `Forbidden: only Quality Team members can approve batches in PENDING_QUALITY stage`);
        }

        await tx.batchApproval.create({
          data: {
            batchId: batch.id,
            officerId: params.userId,
            role: params.userRole,
            revisionNumber: batch.revisionNumber,
            decision: ApprovalDecision.APPROVED,
            reason: params.reason || null,
          },
        });

        nextStatus = BatchStatus.PENDING_STATE;
      } else if (batch.status === BatchStatus.PENDING_STATE) {
        // Must be STATE_OFFICE
        if (params.userRole !== Role.STATE_OFFICE) {
          throw new AppError(403, `Forbidden: only State Office can give final batch approval`);
        }

        await tx.batchApproval.create({
          data: {
            batchId: batch.id,
            officerId: params.userId,
            role: params.userRole,
            revisionNumber: batch.revisionNumber,
            decision: ApprovalDecision.APPROVED,
            reason: params.reason || null,
          },
        });

        // Final approval -> ISSUING
        nextStatus = BatchStatus.ISSUING;
        shouldEnqueueIssuance = true;
      } else {
        throw new AppError(409, `Batch is not awaiting approval (current status: '${batch.status}')`);
      }

      // Update batch status if transitioned
      let updatedBatch = batch;
      if (nextStatus !== previousStatus) {
        updatedBatch = await tx.batch.update({
          where: { id: batch.id },
          data: {
            status: nextStatus,
            isEscalated: false,
            escalatedAt: null,
          },
          include: { candidates: true, approvals: true },
        });

        // Cancel previous SLA job
        await cancelSlaWatchdog(batch.id, batch.revisionNumber, previousStatus);

        // Enqueue SLA watchdog for new status (if not terminal/issuing)
        if (nextStatus !== BatchStatus.ISSUING && nextStatus !== BatchStatus.COMPLETED) {
          await enqueueSlaWatchdog(batch.id, batch.revisionNumber, nextStatus);
        }
      }

      // Record Audit Log
      await AuditService.record(
        {
          correlationId: params.correlationId,
          actorId: params.userId,
          actorRole: params.userRole,
          action: 'BATCH_APPROVED',
          entityType: 'Batch',
          entityId: batch.id,
          previousState: previousStatus,
          newState: nextStatus,
          metadata: {
            reason: params.reason,
            revisionNumber: batch.revisionNumber,
            transitioned: nextStatus !== previousStatus,
          },
        },
        tx
      );

      // If moved to ISSUING, enqueue BullMQ jobs for all candidates
      if (shouldEnqueueIssuance) {
        for (const candidate of batch.candidates) {
          await enqueueCertificateIssuance(batch.id, candidate.id, params.correlationId);
        }
      }

      await sseService.publishEvent('BATCH_STATUS_CHANGED', {
        batchId: batch.id,
        status: nextStatus,
        previousStatus,
        approvalsCount: currentRevisionApprovals.length + 1,
      });

      return updatedBatch;
    });
  }

  /**
   * Moment 6: Officer requests changes (Send Back)
   */
  public static async requestChanges(params: {
    batchId: string;
    userId: string;
    userRole: Role;
    reason: string;
    correlationId?: string;
  }) {
    if (!params.reason || !params.reason.trim()) {
      throw new AppError(400, 'A specific reason is mandatory when requesting changes');
    }

    const batch = await prisma.batch.findUnique({
      where: { id: params.batchId },
    });

    if (!batch) {
      throw new AppError(404, 'Batch not found');
    }

    const reviewableStatuses: BatchStatus[] = [BatchStatus.PENDING_DISTRICT, BatchStatus.PENDING_QUALITY, BatchStatus.PENDING_STATE];
    if (!reviewableStatuses.includes(batch.status)) {
      throw new AppError(409, `Cannot send back a batch with status '${batch.status}'`);
    }

    const previousStatus = batch.status;

    const updatedBatch = await prisma.$transaction(async (tx) => {
      // Record the changes requested decision
      await tx.batchApproval.create({
        data: {
          batchId: batch.id,
          officerId: params.userId,
          role: params.userRole,
          revisionNumber: batch.revisionNumber,
          decision: ApprovalDecision.CHANGES_REQUESTED,
          reason: params.reason,
        },
      });

      const b = await tx.batch.update({
        where: { id: batch.id },
        data: {
          status: BatchStatus.CHANGES_REQUESTED,
          isEscalated: false,
          escalatedAt: null,
        },
      });

      await cancelSlaWatchdog(batch.id, batch.revisionNumber, previousStatus);

      await AuditService.record(
        {
          correlationId: params.correlationId,
          actorId: params.userId,
          actorRole: params.userRole,
          action: 'CHANGES_REQUESTED',
          entityType: 'Batch',
          entityId: batch.id,
          previousState: previousStatus,
          newState: BatchStatus.CHANGES_REQUESTED,
          metadata: { reason: params.reason, revisionNumber: batch.revisionNumber },
        },
        tx
      );

      return b;
    });

    await sseService.publishEvent('BATCH_STATUS_CHANGED', updatedBatch);
    return updatedBatch;
  }

  /**
   * Rejects a batch completely
   */
  public static async rejectBatch(params: {
    batchId: string;
    userId: string;
    userRole: Role;
    reason: string;
    correlationId?: string;
  }) {
    if (!params.reason || !params.reason.trim()) {
      throw new AppError(400, 'A specific reason is mandatory when rejecting a batch');
    }

    const batch = await prisma.batch.findUnique({
      where: { id: params.batchId },
    });

    if (!batch) {
      throw new AppError(404, 'Batch not found');
    }

    const previousStatus = batch.status;

    const updatedBatch = await prisma.$transaction(async (tx) => {
      await tx.batchApproval.create({
        data: {
          batchId: batch.id,
          officerId: params.userId,
          role: params.userRole,
          revisionNumber: batch.revisionNumber,
          decision: ApprovalDecision.REJECTED,
          reason: params.reason,
        },
      });

      const b = await tx.batch.update({
        where: { id: batch.id },
        data: {
          status: BatchStatus.REJECTED,
          isEscalated: false,
          escalatedAt: null,
        },
      });

      await cancelSlaWatchdog(batch.id, batch.revisionNumber, previousStatus);

      await AuditService.record(
        {
          correlationId: params.correlationId,
          actorId: params.userId,
          actorRole: params.userRole,
          action: 'BATCH_REJECTED',
          entityType: 'Batch',
          entityId: batch.id,
          previousState: previousStatus,
          newState: BatchStatus.REJECTED,
          metadata: { reason: params.reason, revisionNumber: batch.revisionNumber },
        },
        tx
      );

      return b;
    });

    await sseService.publishEvent('BATCH_STATUS_CHANGED', updatedBatch);
    return updatedBatch;
  }
}
