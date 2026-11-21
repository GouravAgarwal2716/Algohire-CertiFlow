import fs from 'fs';
import { CertificateStatus, Role } from '@prisma/client';
import { prisma } from '../config/db';
import { redis } from '../config/redis';
import { AppError } from '../middleware/errorHandler';
import { AuditService } from './auditService';
import { sseService } from './sseService';
import { verifySignedDownloadToken } from '../utils/hmac';

export interface PublicVerificationResponse {
  certificateNumber: string;
  candidateName: string;
  courseName: string;
  centreName: string;
  district: string;
  issuedAt: string;
  status: CertificateStatus;
  revokedAt?: string | null;
  revocationReason?: string | null;
}

export class CertificateService {
  /**
   * Moment 4: Public Verification with Redis Caching and PII Redaction
   */
  public static async verifyPublicly(certNumber: string): Promise<PublicVerificationResponse | null> {
    const cacheKey = `verify:${certNumber.trim().toUpperCase()}`;

    // 1. Check Redis cache first
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (err) {
      // Redis failover: log and continue to database
      console.warn('[Cache Warning] Redis get failed, falling back to DB:', err);
    }

    // 2. Query Postgres
    const cert = await prisma.certificate.findUnique({
      where: { certificateNumber: certNumber.trim().toUpperCase() },
      include: {
        candidate: {
          select: { fullName: true }, // REDACT phone, email, rollNumber
        },
        batch: {
          select: { courseName: true, centreId: true, districtId: true },
        },
      },
    });

    if (!cert) {
      return null;
    }

    // 3. Format response (NO PII, NO PDF URL)
    const verificationData: PublicVerificationResponse = {
      certificateNumber: cert.certificateNumber,
      candidateName: cert.candidate.fullName,
      courseName: cert.batch.courseName,
      centreName: cert.batch.centreId,
      district: cert.batch.districtId,
      issuedAt: cert.issuedAt.toISOString(),
      status: cert.status,
      revokedAt: cert.revokedAt ? cert.revokedAt.toISOString() : null,
      revocationReason: cert.revocationReason || null,
    };

    // 4. Cache in Redis for 5 minutes (300 seconds)
    try {
      await redis.setex(cacheKey, 300, JSON.stringify(verificationData));
    } catch (err) {
      console.warn('[Cache Warning] Redis set failed:', err);
    }

    return verificationData;
  }

  /**
   * Moment 4: Revocation by State Office with Instant Cache Invalidation
   */
  public static async revokeCertificate(params: {
    certificateId: string;
    reason: string;
    userId: string;
    userRole: Role;
    correlationId?: string;
  }) {
    if (params.userRole !== Role.STATE_OFFICE) {
      throw new AppError(403, 'Forbidden: only State Office can revoke issued certificates');
    }

    if (!params.reason || !params.reason.trim()) {
      throw new AppError(400, 'A revocation reason is required');
    }

    const cert = await prisma.certificate.findUnique({
      where: { id: params.certificateId },
      include: { candidate: true, batch: true },
    });

    if (!cert) {
      throw new AppError(404, 'Certificate not found');
    }

    if (cert.status === CertificateStatus.REVOKED) {
      throw new AppError(409, 'Certificate has already been revoked');
    }

    const updatedCert = await prisma.$transaction(async (tx) => {
      const c = await tx.certificate.update({
        where: { id: cert.id },
        data: {
          status: CertificateStatus.REVOKED,
          revokedAt: new Date(),
          revocationReason: params.reason,
          revokedById: params.userId,
        },
      });

      await AuditService.record(
        {
          correlationId: params.correlationId,
          actorId: params.userId,
          actorRole: params.userRole,
          action: 'CERTIFICATE_REVOKED',
          entityType: 'Certificate',
          entityId: cert.id,
          previousState: CertificateStatus.VALID,
          newState: CertificateStatus.REVOKED,
          metadata: {
            certificateNumber: cert.certificateNumber,
            candidateName: cert.candidate.fullName,
            reason: params.reason,
          },
        },
        tx
      );

      return c;
    });

    // CRITICAL: Synchronously purge Redis cache so the next public check immediately returns REVOKED!
    const cacheKey = `verify:${cert.certificateNumber}`;
    try {
      await redis.del(cacheKey);
    } catch (err) {
      console.warn('[Cache Warning] Failed to delete Redis cache key:', err);
    }

    await sseService.publishEvent('CERTIFICATE_REVOKED', {
      certificateId: cert.id,
      certificateNumber: cert.certificateNumber,
      candidateName: cert.candidate.fullName,
      status: CertificateStatus.REVOKED,
      reason: params.reason,
    });

    return updatedCert;
  }

  /**
   * Moment 4: Revoke all certificates in a batch by State Office
   */
  public static async revokeBatchCertificates(params: {
    batchId: string;
    reason: string;
    userId: string;
    userRole: Role;
    correlationId?: string;
  }) {
    if (params.userRole !== Role.STATE_OFFICE) {
      throw new AppError(403, 'Forbidden: only State Office can revoke issued certificates');
    }

    if (!params.reason || !params.reason.trim()) {
      throw new AppError(400, 'A revocation reason is required');
    }

    const certs = await prisma.certificate.findMany({
      where: { batchId: params.batchId, status: CertificateStatus.VALID },
      include: { candidate: true, batch: true },
    });

    if (certs.length === 0) {
      throw new AppError(404, 'No valid certificates found for this cohort batch');
    }

    const revokedCerts = await prisma.$transaction(async (tx) => {
      const updated = [];
      for (const cert of certs) {
        const c = await tx.certificate.update({
          where: { id: cert.id },
          data: {
            status: CertificateStatus.REVOKED,
            revokedAt: new Date(),
            revocationReason: params.reason,
            revokedById: params.userId,
          },
        });

        await AuditService.record(
          {
            correlationId: params.correlationId,
            actorId: params.userId,
            actorRole: params.userRole,
            action: 'CERTIFICATE_REVOKED',
            entityType: 'Certificate',
            entityId: cert.id,
            previousState: CertificateStatus.VALID,
            newState: CertificateStatus.REVOKED,
            metadata: {
              certificateNumber: cert.certificateNumber,
              candidateName: cert.candidate.fullName,
              batchId: params.batchId,
              reason: params.reason,
            },
          },
          tx
        );
        updated.push(c);
      }
      return updated;
    });

    // Invalidate Redis caches immediately for every revoked certificate
    for (const cert of certs) {
      try {
        await redis.del(`verify:${cert.certificateNumber}`);
      } catch (err) {
        console.warn('[Cache Warning] Failed to delete Redis key:', err);
      }
      await sseService.publishEvent('CERTIFICATE_REVOKED', {
        certificateId: cert.id,
        certificateNumber: cert.certificateNumber,
        candidateName: cert.candidate.fullName,
        status: CertificateStatus.REVOKED,
        reason: params.reason,
      });
    }

    return revokedCerts;
  }

  /**
   * Tamper-Proof Signed PDF Download
   */
  public static async getSignedPdfPath(certificateId: string, token: string, expires: string): Promise<string> {
    const isValidSignature = verifySignedDownloadToken(certificateId, token, expires);
    if (!isValidSignature) {
      throw new AppError(403, 'Forbidden: invalid, expired, or tampered download signature');
    }

    const cert = await prisma.certificate.findUnique({
      where: { id: certificateId },
    });

    if (!cert || !cert.pdfPath) {
      throw new AppError(404, 'Certificate PDF file not found or not yet generated');
    }

    if (!fs.existsSync(cert.pdfPath)) {
      throw new AppError(404, 'Physical certificate file missing from storage volume');
    }

    return cert.pdfPath;
  }

  /**
   * Lists certificates with pagination for State Office
   */
  public static async listCertificates(limit = 100) {
    return prisma.certificate.findMany({
      take: limit,
      include: {
        candidate: true,
        batch: { select: { title: true, courseName: true, centreId: true, districtId: true } },
        revokedBy: { select: { name: true, email: true } },
      },
      orderBy: { issuedAt: 'desc' },
    });
  }
}
