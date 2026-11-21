import { Queue } from 'bullmq';
import { config } from '../config/env';

export const QUEUE_NAMES = {
  CERTIFICATE_ISSUANCE: 'certificate-issuance',
  SLA_WATCHDOG: 'sla-watchdog',
};

const connectionOptions = {
  url: config.redisUrl,
  maxRetriesPerRequest: null,
};

export const certificateIssuanceQueue = new Queue(QUEUE_NAMES.CERTIFICATE_ISSUANCE, {
  connection: connectionOptions,
  defaultJobOptions: {
    attempts: 8,
    backoff: {
      type: 'exponential',
      delay: 1000, // 1s, 2s, 4s, 8s, 16s...
    },
    removeOnComplete: 1000,
    removeOnFail: 5000,
  },
});

export const slaWatchdogQueue = new Queue(QUEUE_NAMES.SLA_WATCHDOG, {
  connection: connectionOptions,
  defaultJobOptions: {
    attempts: 3,
    removeOnComplete: true,
    removeOnFail: false,
  },
});

export async function enqueueCertificateIssuance(batchId: string, candidateId: string, correlationId?: string) {
  const jobId = `cert-${batchId}-${candidateId}`;
  return certificateIssuanceQueue.add(
    'issue-certificate',
    { batchId, candidateId, correlationId },
    { jobId } // Deterministic Job ID guarantees exactly-once enqueueing!
  );
}

export async function enqueueSlaWatchdog(batchId: string, revisionNumber: number, status: string, delayMs: number = config.slaTimeoutMs) {
  const jobId = `sla-${batchId}-rev${revisionNumber}-${status}`;
  return slaWatchdogQueue.add(
    'check-sla',
    { batchId, revisionNumber, status },
    {
      jobId,
      delay: delayMs,
    }
  );
}

export async function cancelSlaWatchdog(batchId: string, revisionNumber: number, status: string) {
  const jobId = `sla-${batchId}-rev${revisionNumber}-${status}`;
  try {
    const job = await slaWatchdogQueue.getJob(jobId);
    if (job) {
      await job.remove();
    }
  } catch (err) {
    console.warn(`[Queue] Failed to remove SLA job ${jobId}:`, err);
  }
}
