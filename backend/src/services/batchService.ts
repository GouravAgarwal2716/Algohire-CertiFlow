import { BatchStatus, Role } from '@prisma/client';
import { prisma } from '../config/db';
import { AppError } from '../middleware/errorHandler';
import { CSVService } from './csvService';
import { AuditService } from './auditService';
import { sseService } from './sseService';
import { enqueueSlaWatchdog } from '../queues/queue';

export class BatchService {
  /**
   * Creates a new draft batch
   */
  public static async createBatch(params: {
    title: string;
    courseName: string;
    centreId: string;
    districtId: string;
    userId: string;
    userRole: Role;
    correlationId?: string;
  }) {
    const batch = await prisma.batch.create({
      data: {
        title: params.title,
        courseName: params.courseName,
        centreId: params.centreId,
        districtId: params.districtId,
        status: BatchStatus.DRAFT,
        revisionNumber: 1,
        candidateCount: 0,
      },
    });

    await AuditService.record({
      correlationId: params.correlationId,
      actorId: params.userId,
      actorRole: params.userRole,
      action: 'BATCH_CREATED',
      entityType: 'Batch',
      entityId: batch.id,
      newState: BatchStatus.DRAFT,
      metadata: { title: batch.title, courseName: batch.courseName },
    });

    await sseService.publishEvent('BATCH_CREATED', batch);
    return batch;
  }

  /**
   * Moment 1: Atomic candidate CSV upload
   * In-memory validation; writes NOTHING to Postgres if any error occurs.
   */
  public static async uploadCandidates(params: {
    batchId: string;
    csvContent: string;
    userId: string;
    userRole: Role;
    userCentreId?: string | null;
    correlationId?: string;
  }) {
    const batch = await prisma.batch.findUnique({
      where: { id: params.batchId },
    });

    if (!batch) {
      throw new AppError(404, 'Batch not found');
    }

    // Role check: Only training centre can upload, and only for their own centre
    if (params.userRole === Role.TRAINING_CENTRE && params.userCentreId && batch.centreId !== params.userCentreId) {
      throw new AppError(403, 'Forbidden: you can only upload candidates for your own training centre');
    }

    // Status check: can only upload if DRAFT or CHANGES_REQUESTED
    if (batch.status !== BatchStatus.DRAFT && batch.status !== BatchStatus.CHANGES_REQUESTED) {
      throw new AppError(400, `Cannot modify candidates while batch is in status '${batch.status}'`);
    }

    // 1. In-memory validation
    const validation = CSVService.parseAndValidate(params.csvContent);
    if (!validation.isValid) {
      throw new AppError(400, 'CSV validation failed with row errors', validation.errors);
    }

    // 2. Atomic Database Transaction
    const updatedBatch = await prisma.$transaction(async (tx) => {
      // Delete existing candidates if any
      await tx.candidate.deleteMany({
        where: { batchId: batch.id },
      });

      // Insert new candidates in bulk
      await tx.candidate.createMany({
        data: validation.candidates.map((c) => ({
          batchId: batch.id,
          fullName: c.fullName,
          phone: c.phone,
          email: c.email || null,
          rollNumber: c.rollNumber,
          score: c.score,
        })),
      });

      // Update candidateCount
      const b = await tx.batch.update({
        where: { id: batch.id },
        data: {
          candidateCount: validation.candidates.length,
        },
        include: {
          candidates: true,
        },
      });

      await AuditService.record(
        {
          correlationId: params.correlationId,
          actorId: params.userId,
          actorRole: params.userRole,
          action: 'CANDIDATES_UPLOADED',
          entityType: 'Batch',
          entityId: batch.id,
          metadata: { candidateCount: validation.candidates.length },
        },
        tx
      );

      return b;
    });

    await sseService.publishEvent('BATCH_UPDATED', updatedBatch);
    return updatedBatch;
  }

  /**
   * Moment 6: Submit or Resubmit Batch
   */
  public static async submitBatch(params: {
    batchId: string;
    userId: string;
    userRole: Role;
    userCentreId?: string | null;
    correlationId?: string;
  }) {
    const batch = await prisma.batch.findUnique({
      where: { id: params.batchId },
      include: { candidates: true },
    });

    if (!batch) {
      throw new AppError(404, 'Batch not found');
    }

    if (params.userRole === Role.TRAINING_CENTRE && params.userCentreId && batch.centreId !== params.userCentreId) {
      throw new AppError(403, 'Forbidden: you cannot submit batches belonging to another training centre');
    }

    if (batch.candidates.length === 0) {
      throw new AppError(400, 'Cannot submit an empty batch. Upload candidate roster first.');
    }

    if (batch.status !== BatchStatus.DRAFT && batch.status !== BatchStatus.CHANGES_REQUESTED) {
      throw new AppError(400, `Batch cannot be submitted from status '${batch.status}'`);
    }

    const previousState = batch.status;
    const isResubmission = batch.status === BatchStatus.CHANGES_REQUESTED;
    const newRevisionNumber = isResubmission ? batch.revisionNumber + 1 : batch.revisionNumber;

    const updatedBatch = await prisma.$transaction(async (tx) => {
      const b = await tx.batch.update({
        where: { id: batch.id },
        data: {
          status: BatchStatus.PENDING_DISTRICT,
          revisionNumber: newRevisionNumber,
          isEscalated: false,
          escalatedAt: null,
        },
      });

      await AuditService.record(
        {
          correlationId: params.correlationId,
          actorId: params.userId,
          actorRole: params.userRole,
          action: isResubmission ? 'BATCH_RESUBMITTED' : 'BATCH_SUBMITTED',
          entityType: 'Batch',
          entityId: batch.id,
          previousState,
          newState: BatchStatus.PENDING_DISTRICT,
          metadata: {
            revisionNumber: newRevisionNumber,
            isResubmission,
            invalidatedPreviousApprovals: isResubmission,
          },
        },
        tx
      );

      return b;
    });

    // Enqueue SLA watchdog timer for this revision & status
    await enqueueSlaWatchdog(updatedBatch.id, updatedBatch.revisionNumber, BatchStatus.PENDING_DISTRICT);

    await sseService.publishEvent('BATCH_STATUS_CHANGED', updatedBatch);
    return updatedBatch;
  }

  /**
   * Retrieves batches filtered by user role and jurisdiction
   */
  public static async getBatches(user: { id: string; role: Role; districtId: string | null; centreId: string | null }) {
    const whereClause: any = {};

    if (user.role === Role.TRAINING_CENTRE) {
      if (user.centreId) {
        whereClause.centreId = user.centreId;
      }
    } else if (user.role === Role.DISTRICT_OFFICER) {
      if (user.districtId) {
        whereClause.districtId = user.districtId;
      }
    }
    // QUALITY_TEAM and STATE_OFFICE see all batches across districts

    return prisma.batch.findMany({
      where: whereClause,
      include: {
        approvals: {
          include: {
            officer: { select: { id: true, name: true, email: true, role: true } },
          },
        },
        certificates: {
          select: { id: true, status: true, revokedAt: true, revocationReason: true },
        },
        _count: {
          select: { candidates: true, certificates: true },
        },
      },
      orderBy: [{ isEscalated: 'desc' }, { updatedAt: 'desc' }],
    });
  }

  /**
   * Retrieves full batch detail by ID
   */
  public static async getBatchById(batchId: string) {
    const batch = await prisma.batch.findUnique({
      where: { id: batchId },
      include: {
        candidates: {
          include: {
            certificate: true,
          },
        },
        approvals: {
          include: {
            officer: { select: { id: true, name: true, email: true, role: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!batch) {
      throw new AppError(404, 'Batch not found');
    }

    return batch;
  }
}
