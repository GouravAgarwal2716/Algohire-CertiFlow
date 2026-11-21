import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/config/db';
import { setupTestEnvironment, getAuthToken, createTestBatch } from './test-helpers';

const app = createApp();

describe('Moment 1: Atomic Candidate CSV Upload & Strict In-Memory Validation', () => {
  beforeAll(async () => {
    await setupTestEnvironment();
  });

  it('rejects a CSV with bad rows, returns 400 with detailed errors, and persists 0 candidates to Postgres', async () => {
    const anikaToken = getAuthToken('anika');
    const batch = await createTestBatch({ title: 'Moment 1 Failure Test Batch' });

    // CSV with multiple intentional errors:
    // Row 2: valid
    // Row 3: bad phone (9 digits)
    // Row 4: score > 100
    // Row 5: duplicate roll number
    const badCsv = `fullName,phone,email,rollNumber,score
Valid Candidate,9876543210,valid@example.com,R-01,85.0
Bad Phone Guy,987654321,bad@example.com,R-02,75.0
Score Too High,9876543212,high@example.com,R-03,110.0
Duplicate Roll,9876543213,dup@example.com,R-01,90.0`;

    const res = await request(app)
      .post(`/api/batches/${batch.id}/candidates/upload`)
      .set('Authorization', `Bearer ${anikaToken}`)
      .attach('file', Buffer.from(badCsv), 'bad_candidates.csv');

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('CSV validation failed');
    expect(res.body.details).toBeDefined();
    expect(res.body.details.length).toBeGreaterThanOrEqual(3);

    // Verify row-by-row error details are present
    const errorFields = res.body.details.map((d: any) => d.field);
    expect(errorFields).toContain('phone');
    expect(errorFields).toContain('score');
    expect(errorFields).toContain('rollNumber');

    // CRITICAL: Prove that NOTHING was half-saved to Postgres!
    const candidateCount = await prisma.candidate.count({
      where: { batchId: batch.id },
    });
    expect(candidateCount).toBe(0);

    const refetchedBatch = await prisma.batch.findUnique({
      where: { id: batch.id },
    });
    expect(refetchedBatch?.candidateCount).toBe(0);
  });

  it('atomically saves all candidates and updates candidateCount when CSV is 100% valid', async () => {
    const anikaToken = getAuthToken('anika');
    const batch = await createTestBatch({ title: 'Moment 1 Clean Success Batch' });

    const cleanCsv = `fullName,phone,email,rollNumber,score
Aarav Kumar,9876543210,aarav@example.com,SOL-101-01,88.5
Diya Sharma,9876543211,diya@example.com,SOL-101-02,92.0
Rohan Gupta,9876543212,rohan@example.com,SOL-101-03,79.5
Sneha Reddy,9876543213,sneha@example.com,SOL-101-04,85.0
Vikram Singh,9876543214,vikram@example.com,SOL-101-05,94.0`;

    const res = await request(app)
      .post(`/api/batches/${batch.id}/candidates/upload`)
      .set('Authorization', `Bearer ${anikaToken}`)
      .attach('file', Buffer.from(cleanCsv), 'clean_candidates.csv');

    expect(res.status).toBe(200);
    expect(res.body.candidateCount).toBe(5);

    // Verify all 5 are in Postgres
    const savedCandidates = await prisma.candidate.findMany({
      where: { batchId: batch.id },
      orderBy: { rollNumber: 'asc' },
    });

    expect(savedCandidates.length).toBe(5);
    expect(savedCandidates[0].fullName).toBe('Aarav Kumar');
    expect(savedCandidates[0].phone).toBe('9876543210');
    expect(savedCandidates[0].score).toBe(88.5);

    const refetchedBatch = await prisma.batch.findUnique({
      where: { id: batch.id },
    });
    expect(refetchedBatch?.candidateCount).toBe(5);
  });
});
