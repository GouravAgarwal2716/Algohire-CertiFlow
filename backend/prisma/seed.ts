import { PrismaClient, Role, BatchStatus, CertificateStatus, WhatsAppStatus } from '@prisma/client';

const prisma = new PrismaClient();

export const DEMO_USERS = {
  anika: {
    id: '11111111-1111-1111-1111-111111111111',
    name: 'Anika Sharma',
    email: 'anika@pragati.gov.in',
    role: Role.TRAINING_CENTRE,
    districtId: 'Hyderabad',
    centreId: 'Pragati Tech Centre',
  },
  dev: {
    id: '22222222-2222-2222-2222-222222222222',
    name: 'Dev Rao',
    email: 'dev@pragati.gov.in',
    role: Role.DISTRICT_OFFICER,
    districtId: 'Hyderabad',
    centreId: null,
  },
  meera: {
    id: '33333333-3333-3333-3333-333333333333',
    name: 'Meera Patel',
    email: 'meera@pragati.gov.in',
    role: Role.DISTRICT_OFFICER,
    districtId: 'Hyderabad',
    centreId: null,
  },
  kabir: {
    id: '44444444-4444-4444-4444-444444444444',
    name: 'Kabir Verma',
    email: 'kabir@pragati.gov.in',
    role: Role.DISTRICT_OFFICER,
    districtId: 'Hyderabad',
    centreId: null,
  },
  ravi: {
    id: '55555555-5555-5555-5555-555555555555',
    name: 'Ravi Reddy',
    email: 'ravi@pragati.gov.in',
    role: Role.DISTRICT_OFFICER,
    districtId: 'Warangal',
    centreId: null,
  },
  neha: {
    id: '66666666-6666-6666-6666-666666666666',
    name: 'Neha Joshi',
    email: 'neha@pragati.gov.in',
    role: Role.QUALITY_TEAM,
    districtId: null,
    centreId: null,
  },
  farah: {
    id: '77777777-7777-7777-7777-777777777777',
    name: 'Farah Khan',
    email: 'farah@pragati.gov.in',
    role: Role.STATE_OFFICE,
    districtId: null,
    centreId: null,
  },
};

export async function seed() {
  console.log('[Seed] Seeding users idempotently...');
  for (const user of Object.values(DEMO_USERS)) {
    await prisma.user.upsert({
      where: { id: user.id },
      update: {
        name: user.name,
        email: user.email,
        role: user.role,
        districtId: user.districtId,
        centreId: user.centreId,
      },
      create: user,
    });
  }

  console.log('[Seed] Seeding sample batches...');
  // 1. Small Batch in PENDING_DISTRICT
  const pendingBatchId = '88888888-8888-8888-8888-888888888888';
  await prisma.batch.upsert({
    where: { id: pendingBatchId },
    update: {},
    create: {
      id: pendingBatchId,
      title: 'Solar PV Technician - Batch 101',
      courseName: 'Solar PV Installation & Maintenance',
      centreId: 'Pragati Tech Centre',
      districtId: 'Hyderabad',
      status: BatchStatus.PENDING_DISTRICT,
      revisionNumber: 1,
      candidateCount: 5,
      candidates: {
        create: [
          { fullName: 'Aarav Kumar', phone: '9876543210', email: 'aarav@example.com', rollNumber: 'SOL-101-01', score: 88.5 },
          { fullName: 'Diya Sharma', phone: '9876543211', email: 'diya@example.com', rollNumber: 'SOL-101-02', score: 92.0 },
          { fullName: 'Rohan Gupta', phone: '9876543212', email: 'rohan@example.com', rollNumber: 'SOL-101-03', score: 79.5 },
          { fullName: 'Sneha Reddy', phone: '9876543213', email: 'sneha@example.com', rollNumber: 'SOL-101-04', score: 85.0 },
          { fullName: 'Vikram Singh', phone: '9876543214', email: 'vikram@example.com', rollNumber: 'SOL-101-05', score: 94.0 },
        ],
      },
    },
  });

  // 2. Completed Batch with issued certificates for instant Public Verification & QR scanning
  const completedBatchId = '99999999-9999-9999-9999-999999999999';
  const existingCompleted = await prisma.batch.findUnique({ where: { id: completedBatchId } });
  if (!existingCompleted) {
    const compBatch = await prisma.batch.create({
      data: {
        id: completedBatchId,
        title: 'Healthcare Assistant - Batch 88',
        courseName: 'General Duty Healthcare Assistant',
        centreId: 'Pragati Tech Centre',
        districtId: 'Hyderabad',
        status: BatchStatus.COMPLETED,
        revisionNumber: 1,
        candidateCount: 3,
        candidates: {
          create: [
            { id: 'c1111111-1111-1111-1111-111111111111', fullName: 'Pooja Verma', phone: '9876500001', email: 'pooja@example.com', rollNumber: 'GDA-88-01', score: 95.0 },
            { id: 'c2222222-2222-2222-2222-222222222222', fullName: 'Arjun Das', phone: '9876500002', email: 'arjun@example.com', rollNumber: 'GDA-88-02', score: 89.0 },
            { id: 'c3333333-3333-3333-3333-333333333333', fullName: 'Kavita Nair', phone: '9876500003', email: 'kavita@example.com', rollNumber: 'GDA-88-03', score: 91.5 },
          ],
        },
      },
    });

    // Seed Certificates
    await prisma.certificate.createMany({
      data: [
        {
          id: 'cert-88-01',
          certificateNumber: 'PSM-2026-HYD001',
          verificationCode: 'a1b2c3d4e5f60001',
          batchId: compBatch.id,
          candidateId: 'c1111111-1111-1111-1111-111111111111',
          status: CertificateStatus.VALID,
          whatsappStatus: WhatsAppStatus.SENT,
          whatsappMessageId: 'wamid.seed.001',
        },
        {
          id: 'cert-88-02',
          certificateNumber: 'PSM-2026-HYD002',
          verificationCode: 'a1b2c3d4e5f60002',
          batchId: compBatch.id,
          candidateId: 'c2222222-2222-2222-2222-222222222222',
          status: CertificateStatus.VALID,
          whatsappStatus: WhatsAppStatus.SENT,
          whatsappMessageId: 'wamid.seed.002',
        },
        {
          id: 'cert-88-03',
          certificateNumber: 'PSM-2026-HYD003',
          verificationCode: 'a1b2c3d4e5f60003',
          batchId: compBatch.id,
          candidateId: 'c3333333-3333-3333-3333-333333333333',
          status: CertificateStatus.VALID,
          whatsappStatus: WhatsAppStatus.SENT,
          whatsappMessageId: 'wamid.seed.003',
        },
      ],
    });
  }

  console.log('[Seed] Database seed completed successfully.');
}

if (require.main === module) {
  seed()
    .catch((e) => {
      console.error('[Seed Error]', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
