-- CreateEnum
CREATE TYPE "Role" AS ENUM ('TRAINING_CENTRE', 'DISTRICT_OFFICER', 'QUALITY_TEAM', 'STATE_OFFICE');

-- CreateEnum
CREATE TYPE "BatchStatus" AS ENUM ('DRAFT', 'PENDING_DISTRICT', 'PENDING_QUALITY', 'PENDING_STATE', 'APPROVED', 'ISSUING', 'COMPLETED', 'CHANGES_REQUESTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ApprovalDecision" AS ENUM ('APPROVED', 'REJECTED', 'CHANGES_REQUESTED');

-- CreateEnum
CREATE TYPE "CertificateStatus" AS ENUM ('VALID', 'REVOKED');

-- CreateEnum
CREATE TYPE "WhatsAppStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "districtId" TEXT,
    "centreId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Batch" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "courseName" TEXT NOT NULL,
    "centreId" TEXT NOT NULL,
    "districtId" TEXT NOT NULL,
    "status" "BatchStatus" NOT NULL DEFAULT 'DRAFT',
    "revisionNumber" INTEGER NOT NULL DEFAULT 1,
    "candidateCount" INTEGER NOT NULL DEFAULT 0,
    "isEscalated" BOOLEAN NOT NULL DEFAULT false,
    "escalatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Batch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Candidate" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "rollNumber" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Candidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BatchApproval" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "officerId" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "revisionNumber" INTEGER NOT NULL,
    "decision" "ApprovalDecision" NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BatchApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Certificate" (
    "id" TEXT NOT NULL,
    "certificateNumber" TEXT NOT NULL,
    "verificationCode" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "status" "CertificateStatus" NOT NULL DEFAULT 'VALID',
    "pdfPath" TEXT,
    "whatsappStatus" "WhatsAppStatus" NOT NULL DEFAULT 'PENDING',
    "whatsappMessageId" TEXT,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "revocationReason" TEXT,
    "revokedById" TEXT,
    CONSTRAINT "Certificate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "correlationId" TEXT,
    "actorId" TEXT,
    "actorRole" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "previousState" TEXT,
    "newState" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "Batch_status_idx" ON "Batch"("status");
CREATE INDEX "Batch_districtId_idx" ON "Batch"("districtId");
CREATE INDEX "Batch_centreId_idx" ON "Batch"("centreId");
CREATE UNIQUE INDEX "Candidate_batchId_rollNumber_key" ON "Candidate"("batchId", "rollNumber");
CREATE UNIQUE INDEX "Candidate_batchId_phone_key" ON "Candidate"("batchId", "phone");
CREATE INDEX "Candidate_batchId_idx" ON "Candidate"("batchId");
CREATE UNIQUE INDEX "BatchApproval_batchId_officerId_revisionNumber_key" ON "BatchApproval"("batchId", "officerId", "revisionNumber");
CREATE INDEX "BatchApproval_batchId_revisionNumber_idx" ON "BatchApproval"("batchId", "revisionNumber");
CREATE UNIQUE INDEX "Certificate_certificateNumber_key" ON "Certificate"("certificateNumber");
CREATE UNIQUE INDEX "Certificate_verificationCode_key" ON "Certificate"("verificationCode");
CREATE UNIQUE INDEX "Certificate_candidateId_key" ON "Certificate"("candidateId");
CREATE UNIQUE INDEX "Certificate_batchId_candidateId_key" ON "Certificate"("batchId", "candidateId");
CREATE INDEX "Certificate_certificateNumber_idx" ON "Certificate"("certificateNumber");
CREATE INDEX "Certificate_verificationCode_idx" ON "Certificate"("verificationCode");
CREATE INDEX "Certificate_status_idx" ON "Certificate"("status");
CREATE INDEX "AuditLog_entityId_idx" ON "AuditLog"("entityId");
CREATE INDEX "AuditLog_correlationId_idx" ON "AuditLog"("correlationId");
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "Candidate" ADD CONSTRAINT "Candidate_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BatchApproval" ADD CONSTRAINT "BatchApproval_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BatchApproval" ADD CONSTRAINT "BatchApproval_officerId_fkey" FOREIGN KEY ("officerId") REFERENCES "User"("id") ON UPDATE CASCADE;
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON UPDATE CASCADE;
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_revokedById_fkey" FOREIGN KEY ("revokedById") REFERENCES "User"("id") ON UPDATE CASCADE;
