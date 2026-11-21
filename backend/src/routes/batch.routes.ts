import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../config/db';
import multer from 'multer';
import { z } from 'zod';
import { Role } from '@prisma/client';
import { authMiddleware } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { AppError } from '../middleware/errorHandler';
import { BatchService } from '../services/batchService';
import { ApprovalService } from '../services/approvalService';
import { AuditService } from '../services/auditService';
import { AIAgentService } from '../services/aiAgentService';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB limit

const createBatchSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  courseName: z.string().min(2, 'Course name is required'),
  centreId: z.string().min(2, 'Centre ID is required'),
  districtId: z.string().min(2, 'District ID is required'),
});

// Demo Reset: wipes test clutter and reseeds clean demo batches
router.post('/demo-reset', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.batchApproval.deleteMany({});
    await prisma.certificate.deleteMany({});
    await prisma.candidate.deleteMany({});
    await prisma.batch.deleteMany({});
    await prisma.auditLog.deleteMany({});

    // Import and run seed
    const { seed } = await import('../../prisma/seed');
    await seed();

    res.json({ message: 'Demo environment reset to pristine initial state' });
  } catch (err) {
    next(err);
  }
});

// All batch routes require authentication
router.use(authMiddleware);

// 1. Create a draft batch (Training Centre only)
router.post('/', requireRole([Role.TRAINING_CENTRE]), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = createBatchSchema.parse(req.body);
    const user = req.user!;

    const batch = await BatchService.createBatch({
      ...data,
      centreId: user.centreId || data.centreId,
      districtId: user.districtId || data.districtId,
      userId: user.id,
      userRole: user.role,
      correlationId: req.correlationId,
    });

    res.status(201).json(batch);
  } catch (err) {
    next(err);
  }
});

// 2. List batches (filtered by user's role and jurisdiction)
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const batches = await BatchService.getBatches(req.user!);
    res.json(batches);
  } catch (err) {
    next(err);
  }
});

// 3. Get single batch details with candidates and approvals
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const batch = await BatchService.getBatchById(req.params.id);
    res.json(batch);
  } catch (err) {
    next(err);
  }
});

// 4. Moment 1: Atomic candidate CSV upload
router.post(
  '/:id/candidates/upload',
  requireRole([Role.TRAINING_CENTRE]),
  upload.single('file'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      let csvContent = '';

      if (req.file) {
        csvContent = req.file.buffer.toString('utf-8');
      } else if (typeof req.body.csv === 'string') {
        csvContent = req.body.csv;
      } else if (typeof req.body === 'string') {
        csvContent = req.body;
      } else {
        throw new AppError(400, 'Please upload a CSV file or provide CSV string content in the request body');
      }

      const updatedBatch = await BatchService.uploadCandidates({
        batchId: req.params.id,
        csvContent,
        userId: req.user!.id,
        userRole: req.user!.role,
        userCentreId: req.user!.centreId,
        correlationId: req.correlationId,
      });

      res.json({
        message: 'Candidates uploaded successfully',
        candidateCount: updatedBatch.candidateCount,
        batch: updatedBatch,
      });
    } catch (err) {
      next(err);
    }
  }
);

// 5. Submit / Resubmit batch (Training Centre only)
router.post('/:id/submit', requireRole([Role.TRAINING_CENTRE]), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const batch = await BatchService.submitBatch({
      batchId: req.params.id,
      userId: req.user!.id,
      userRole: req.user!.role,
      userCentreId: req.user!.centreId,
      correlationId: req.correlationId,
    });

    res.json({
      message: 'Batch submitted successfully',
      batch,
    });
  } catch (err) {
    next(err);
  }
});

// 6. Moment 2: Concurrency-Safe Batch Approval
router.post(
  '/:id/approve',
  requireRole([Role.DISTRICT_OFFICER, Role.QUALITY_TEAM, Role.STATE_OFFICE]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { reason } = req.body;
      const user = req.user!;

      const updatedBatch = await ApprovalService.approveBatch({
        batchId: req.params.id,
        userId: user.id,
        userRole: user.role,
        userDistrictId: user.districtId,
        reason,
        correlationId: req.correlationId,
      });

      res.json({
        message: 'Approval recorded successfully',
        batch: updatedBatch,
      });
    } catch (err) {
      next(err);
    }
  }
);

// 7. Moment 6: Request Changes (Send back with reason)
router.post(
  '/:id/changes-requested',
  requireRole([Role.DISTRICT_OFFICER, Role.QUALITY_TEAM, Role.STATE_OFFICE]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { reason } = req.body;
      const user = req.user!;

      const updatedBatch = await ApprovalService.requestChanges({
        batchId: req.params.id,
        userId: user.id,
        userRole: user.role,
        reason,
        correlationId: req.correlationId,
      });

      res.json({
        message: 'Batch sent back for modifications',
        batch: updatedBatch,
      });
    } catch (err) {
      next(err);
    }
  }
);

// 8. Reject batch
router.post(
  '/:id/reject',
  requireRole([Role.DISTRICT_OFFICER, Role.QUALITY_TEAM, Role.STATE_OFFICE]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { reason } = req.body;
      const user = req.user!;

      const updatedBatch = await ApprovalService.rejectBatch({
        batchId: req.params.id,
        userId: user.id,
        userRole: user.role,
        reason,
        correlationId: req.correlationId,
      });

      res.json({
        message: 'Batch rejected',
        batch: updatedBatch,
      });
    } catch (err) {
      next(err);
    }
  }
);

// 9. Batch Audit Trail
router.get('/:id/audit', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const logs = await AuditService.getLogsForEntity(req.params.id);
    res.json(logs);
  } catch (err) {
    next(err);
  }
});

// 10. WOW Feature: AI Autonomous Forensic & Quality Audit Pipeline
router.post('/:id/ai-audit', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const report = await AIAgentService.runBatchAudit(
      req.params.id,
      req.user?.id,
      req.user?.role,
      req.correlationId
    );
    res.json(report);
  } catch (err) {
    next(err);
  }
});

export default router;
