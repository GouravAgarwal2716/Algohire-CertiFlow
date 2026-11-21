import { Router, Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import { authMiddleware } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { AppError } from '../middleware/errorHandler';
import { CertificateService } from '../services/certService';

const router = Router();

// 1. Signed PDF Download (Publicly accessible with valid cryptographic HMAC signature + expiry)
router.get('/:id/download', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token, expires } = req.query;
    if (!token || !expires) {
      throw new AppError(403, 'Forbidden: missing download signature or expiry token');
    }

    const filePath = await CertificateService.getSignedPdfPath(
      req.params.id,
      token as string,
      expires as string
    );

    res.download(filePath);
  } catch (err) {
    next(err);
  }
});

// All routes below require authentication
router.use(authMiddleware);

// 2. List all issued certificates (State Office dashboard)
router.get('/', requireRole([Role.STATE_OFFICE]), async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const certs = await CertificateService.listCertificates();
    res.json(certs);
  } catch (err) {
    next(err);
  }
});

// 3. Moment 4: Revoke a certificate (State Office only)
router.post('/:id/revoke', requireRole([Role.STATE_OFFICE]), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { reason } = req.body;
    const cert = await CertificateService.revokeCertificate({
      certificateId: req.params.id,
      reason,
      userId: req.user!.id,
      userRole: req.user!.role,
      correlationId: req.correlationId,
    });

    res.json({
      message: 'Certificate successfully revoked',
      certificate: cert,
    });
  } catch (err) {
    next(err);
  }
});

// 4. Moment 4: Revoke all certificates in a cohort batch (State Office only)
router.post('/batch/:batchId/revoke', requireRole([Role.STATE_OFFICE]), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { reason } = req.body;
    const certs = await CertificateService.revokeBatchCertificates({
      batchId: req.params.batchId,
      reason,
      userId: req.user!.id,
      userRole: req.user!.role,
      correlationId: req.correlationId,
    });

    res.json({
      message: `${certs.length} certificates successfully revoked`,
      revokedCount: certs.length,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
