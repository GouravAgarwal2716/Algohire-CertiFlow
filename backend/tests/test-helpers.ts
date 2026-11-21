import { prisma } from '../src/config/db';
import { signUserToken } from '../src/middleware/auth';
import { DEMO_USERS, seed } from '../prisma/seed';
import { Role } from '@prisma/client';

export async function setupTestEnvironment() {
  // Ensure seed users exist
  await seed();
}

export function getAuthToken(userKey: keyof typeof DEMO_USERS) {
  const user = DEMO_USERS[userKey];
  return signUserToken({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    districtId: user.districtId,
    centreId: user.centreId,
  });
}

export async function createTestBatch(params?: {
  title?: string;
  courseName?: string;
  candidateCount?: number;
  districtId?: string;
  centreId?: string;
}) {
  const batch = await prisma.batch.create({
    data: {
      title: params?.title || 'Test Electrician Batch',
      courseName: params?.courseName || 'Industrial Electrician',
      districtId: params?.districtId || 'Hyderabad',
      centreId: params?.centreId || 'Pragati Tech Centre',
      candidateCount: params?.candidateCount || 0,
    },
  });
  return batch;
}
