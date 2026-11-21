import { Router, Request, Response, NextFunction } from 'express';
import { CertificateService } from '../services/certService';

const router = Router();

// Moment 4: Public certificate verification endpoint (Zero auth, PII redacted)
router.get('/verify/:certNumber', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { certNumber } = req.params;
    const cert = await CertificateService.verifyPublicly(certNumber);

    if (!cert) {
      res.status(404).json({
        valid: false,
        error: 'Certificate not found. The certificate number provided does not exist in the official state registry.',
      });
      return;
    }

    res.json({
      valid: cert.status === 'VALID',
      certificate: cert,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
