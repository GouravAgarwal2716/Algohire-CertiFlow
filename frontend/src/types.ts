export type Role = 'TRAINING_CENTRE' | 'DISTRICT_OFFICER' | 'QUALITY_TEAM' | 'STATE_OFFICE';

export type BatchStatus =
  | 'DRAFT'
  | 'PENDING_DISTRICT'
  | 'PENDING_QUALITY'
  | 'PENDING_STATE'
  | 'APPROVED'
  | 'ISSUING'
  | 'COMPLETED'
  | 'CHANGES_REQUESTED'
  | 'REJECTED';

export type ApprovalDecision = 'APPROVED' | 'REJECTED' | 'CHANGES_REQUESTED';
export type CertificateStatus = 'VALID' | 'REVOKED';
export type WhatsAppStatus = 'PENDING' | 'SENT' | 'FAILED';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  districtId: string | null;
  centreId: string | null;
}

export interface Candidate {
  id: string;
  batchId: string;
  fullName: string;
  phone: string;
  email?: string | null;
  rollNumber: string;
  score: number;
  createdAt: string;
  certificate?: Certificate | null;
}

export interface BatchApproval {
  id: string;
  batchId: string;
  officerId: string;
  role: Role;
  revisionNumber: number;
  decision: ApprovalDecision;
  reason?: string | null;
  createdAt: string;
  officer?: {
    id: string;
    name: string;
    email: string;
    role: Role;
  };
}

export interface Certificate {
  id: string;
  certificateNumber: string;
  verificationCode: string;
  batchId: string;
  candidateId: string;
  status: CertificateStatus;
  pdfPath?: string | null;
  whatsappStatus: WhatsAppStatus;
  whatsappMessageId?: string | null;
  issuedAt: string;
  revokedAt?: string | null;
  revocationReason?: string | null;
  candidate?: Candidate;
  batch?: Batch;
}

export interface Batch {
  id: string;
  title: string;
  courseName: string;
  centreId: string;
  districtId: string;
  status: BatchStatus;
  revisionNumber: number;
  candidateCount: number;
  isEscalated: boolean;
  escalatedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  candidates?: Candidate[];
  approvals?: BatchApproval[];
  certificates?: { id: string; status: CertificateStatus; revokedAt?: string | null; revocationReason?: string | null }[];
  _count?: {
    candidates: number;
    certificates: number;
  };
}

export interface AuditLog {
  id: string;
  correlationId?: string | null;
  actorId?: string | null;
  actorRole?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  previousState?: string | null;
  newState?: string | null;
  metadata?: any;
  createdAt: string;
}

export interface AIAuditReport {
  batchId: string;
  batchTitle: string;
  analyzedAt: string;
  candidateCount: number;
  statistics: {
    meanScore: number;
    medianScore: number;
    stdDev: number;
    minScore: number;
    maxScore: number;
    passRate: number;
  };
  riskScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  findings: {
    code: string;
    severity: 'INFO' | 'WARNING' | 'CRITICAL';
    title: string;
    description: string;
    affectedCandidates?: string[];
  }[];
  recommendation: {
    action: 'FAST_TRACK_APPROVAL' | 'MANUAL_REVIEW_RECOMMENDED' | 'ESCALATE_TO_STATE_VIGILANCE';
    summary: string;
    rationale: string;
  };
}

export interface WhatsAppMessage {
  id: string;
  to: string;
  message: string;
  downloadUrl?: string;
  certificateNumber?: string;
  timestamp: string;
  idempotencyKey?: string;
}
