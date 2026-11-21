import { Worker, Job } from 'bullmq';
import crypto from 'crypto';
import { CertificateStatus, WhatsAppStatus, BatchStatus } from '@prisma/client';
import { prisma } from './config/db';
import { config } from './config/env';
import { logger } from './config/logger';
import { QUEUE_NAMES } from './queues/queue';
import { generateCertificatePDF } from './utils/pdf';
import { generateSignedDownloadUrl } from './utils/hmac';
import { AuditService } from './services/auditService';
import { sseService } from './services/sseService';

const redisConnection = {
  url: config.redisUrl,
  maxRetriesPerRequest: null,
};

logger.info('[Worker] Initializing BullMQ background workers...');

/**
 * Worker 1: Certificate Issuance & WhatsApp Delivery
 * Implements Moment 3: Exactly-Once Issuance with Resilient WhatsApp Delivery
 */
export const certificateWorker = new Worker(
  QUEUE_NAMES.CERTIFICATE_ISSUANCE,
  async (job: Job) => {
    const { batchId, candidateId, correlationId } = job.data;
    logger.info({ jobId: job.id, batchId, candidateId }, '[Worker] Processing certificate issuance job');

    // 1. Fetch Candidate and Batch
    const candidate = await prisma.candidate.findUnique({
      where: { id: candidateId },
      include: {
        batch: true,
        certificate: true,
      },
    });

    if (!candidate) {
      logger.error({ candidateId }, '[Worker] Candidate not found, skipping job');
      return;
    }

    const batch = candidate.batch;

    // 2. Idempotent Certificate Record Creation
    let cert = candidate.certificate;
    if (!cert) {
      const districtCode = (batch.districtId || 'HYD').substring(0, 3).toUpperCase();
      const randomSuffix = crypto.randomBytes(3).toString('hex').toUpperCase();
      const certificateNumber = `PSM-2026-${districtCode}${randomSuffix}`;
      const verificationCode = crypto.randomBytes(8).toString('hex');

      try {
        cert = await prisma.certificate.create({
          data: {
            certificateNumber,
            verificationCode,
            batchId: batch.id,
            candidateId: candidate.id,
            status: CertificateStatus.VALID,
            whatsappStatus: WhatsAppStatus.PENDING,
          },
        });
      } catch (err: any) {
        // Handle concurrent insert race gracefully
        cert = await prisma.certificate.findUnique({
          where: { candidateId: candidate.id },
        });
        if (!cert) throw err;
      }
    }

    // 3. Idempotent PDF Generation
    if (!cert.pdfPath) {
      const generatedPdfPath = await generateCertificatePDF({
        certificateNumber: cert.certificateNumber,
        verificationCode: cert.verificationCode,
        candidateName: candidate.fullName,
        courseName: batch.courseName,
        centreName: batch.centreId,
        district: batch.districtId,
        issueDate: cert.issuedAt,
        score: candidate.score,
      });

      cert = await prisma.certificate.update({
        where: { id: cert.id },
        data: { pdfPath: generatedPdfPath },
      });
    }

    // 4. Resilient WhatsApp Delivery with Idempotency Key
    if (cert.whatsappStatus !== WhatsAppStatus.SENT) {
      const signedDownload = generateSignedDownloadUrl(cert.id, 86400 * 30); // 30 days valid

      const whatsappPayload = {
        to: candidate.phone,
        certificateNumber: cert.certificateNumber,
        downloadUrl: signedDownload.url,
        message: `Dear ${candidate.fullName}, congratulations! Your official government certificate for '${batch.courseName}' from Pragati Skills Mission has been approved and issued. Download your verified certificate here: ${signedDownload.url}`,
      };

      // Call Mock-WhatsApp service
      const response = await fetch(`${config.mockWhatsappUrl}/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': cert.id, // Deterministic key
        },
        body: JSON.stringify(whatsappPayload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.warn({ status: response.status, errorText, candidateId }, '[Worker] WhatsApp dispatch failed; BullMQ will retry');
        throw new Error(`WhatsApp API responded with status ${response.status}: ${errorText}`);
      }

      const responseData = (await response.json()) as any;

      cert = await prisma.certificate.update({
        where: { id: cert.id },
        data: {
          whatsappStatus: WhatsAppStatus.SENT,
          whatsappMessageId: responseData.messageId || 'wamid.unknown',
        },
      });

      await AuditService.record({
        correlationId,
        action: 'CERTIFICATE_DELIVERED',
        entityType: 'Certificate',
        entityId: cert.id,
        metadata: {
          certificateNumber: cert.certificateNumber,
          phone: candidate.phone,
          messageId: responseData.messageId,
        },
      });

      await sseService.publishEvent('CERTIFICATE_DELIVERED', {
        batchId: batch.id,
        candidateId: candidate.id,
        certificateNumber: cert.certificateNumber,
        candidateName: candidate.fullName,
      });
    }

    // 5. Batch Completion Check: If all candidates in this batch have SENT certificates, mark batch COMPLETED
    const remainingUnsent = await prisma.certificate.count({
      where: {
        batchId: batch.id,
        whatsappStatus: { not: WhatsAppStatus.SENT },
      },
    });

    const totalCandidatesInBatch = await prisma.candidate.count({
      where: { batchId: batch.id },
    });

    const totalIssuedInBatch = await prisma.certificate.count({
      where: { batchId: batch.id, whatsappStatus: WhatsAppStatus.SENT },
    });

    if (totalCandidatesInBatch > 0 && remainingUnsent === 0 && totalIssuedInBatch === totalCandidatesInBatch) {
      await prisma.batch.updateMany({
        where: { id: batch.id, status: { not: BatchStatus.COMPLETED } },
        data: { status: BatchStatus.COMPLETED },
      });

      await AuditService.record({
        correlationId,
        action: 'BATCH_COMPLETED',
        entityType: 'Batch',
        entityId: batch.id,
        previousState: BatchStatus.ISSUING,
        newState: BatchStatus.COMPLETED,
        metadata: { totalCertificatesIssued: totalIssuedInBatch },
      });

      await sseService.publishEvent('BATCH_STATUS_CHANGED', {
        batchId: batch.id,
        status: BatchStatus.COMPLETED,
        totalIssued: totalIssuedInBatch,
      });

      logger.info({ batchId: batch.id }, '[Worker] All certificates delivered! Batch marked as COMPLETED.');
    }
  },
  {
    connection: redisConnection,
    concurrency: 10,
  }
);

/**
 * Worker 2: SLA Escalation Watchdog
 * Implements Moment 5: Automatic SLA Escalation for untouched batches
 */
export const slaWorker = new Worker(
  QUEUE_NAMES.SLA_WATCHDOG,
  async (job: Job) => {
    const { batchId, revisionNumber, status } = job.data;
    logger.info({ batchId, revisionNumber, status }, '[Worker] Checking SLA timeout status');

    const batch = await prisma.batch.findUnique({
      where: { id: batchId },
    });

    if (!batch) return;

    // Check if batch is STILL untouched in that exact status and revision
    if (batch.status === status && batch.revisionNumber === revisionNumber && !batch.isEscalated) {
      logger.warn({ batchId, status }, '[Worker] SLA Breach detected! Escalating batch to State Office.');

      const updatedBatch = await prisma.batch.update({
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
          status,
          revisionNumber,
          escalatedAt: updatedBatch.escalatedAt,
        },
      });

      await sseService.publishEvent('BATCH_ESCALATED', {
        batchId: batch.id,
        title: batch.title,
        status: batch.status,
        escalatedAt: updatedBatch.escalatedAt,
      });
    }
  },
  {
    connection: redisConnection,
    concurrency: 5,
  }
);

certificateWorker.on('completed', (job) => {
  logger.info({ jobId: job.id }, '[Worker] Certificate issuance job completed');
});

certificateWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, attempts: job?.attemptsMade, err: err.message }, '[Worker] Certificate issuance job failed');
});

slaWorker.on('completed', (job) => {
  logger.info({ jobId: job.id }, '[Worker] SLA Watchdog job evaluated');
});

logger.info('[Worker] Workers listening for BullMQ jobs...');
