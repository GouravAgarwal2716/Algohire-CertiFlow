import { User, Batch, AuditLog, AIAuditReport, Certificate, WhatsAppMessage } from './types';

const API_BASE = '/api';
const MOCK_WHATSAPP_URL = 'http://localhost:3001';

function getHeaders(token?: string | null) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export const api = {
  // --- Auth & Users ---
  async getUsers(): Promise<User[]> {
    const res = await fetch(`${API_BASE}/auth/users`);
    if (!res.ok) throw new Error('Failed to fetch users');
    return res.json();
  },

  async demoLogin(userId: string): Promise<{ token: string; user: User }> {
    const res = await fetch(`${API_BASE}/auth/demo-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Demo login failed');
    }
    return res.json();
  },

  // --- Batches ---
  async getBatches(token: string): Promise<Batch[]> {
    const res = await fetch(`${API_BASE}/batches`, {
      headers: getHeaders(token),
    });
    if (!res.ok) throw new Error('Failed to fetch batches');
    return res.json();
  },

  async resetDemoData(): Promise<void> {
    const res = await fetch(`${API_BASE}/batches/demo-reset`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to reset demo data');
  },

  async getBatch(id: string, token: string): Promise<Batch> {
    const res = await fetch(`${API_BASE}/batches/${id}`, {
      headers: getHeaders(token),
    });
    if (!res.ok) throw new Error('Failed to fetch batch');
    return res.json();
  },

  async createBatch(
    data: { title: string; courseName: string; centreId: string; districtId: string },
    token: string
  ): Promise<Batch> {
    const res = await fetch(`${API_BASE}/batches`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to create batch');
    }
    return res.json();
  },

  async uploadCandidatesCsv(batchId: string, file: File, token: string) {
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch(`${API_BASE}/batches/${batchId}/candidates/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    const data = await res.json();
    if (!res.ok) {
      const error: any = new Error(data.error || 'CSV upload failed');
      error.details = data.details;
      throw error;
    }
    return data;
  },

  async submitBatch(batchId: string, token: string): Promise<Batch> {
    const res = await fetch(`${API_BASE}/batches/${batchId}/submit`, {
      method: 'POST',
      headers: getHeaders(token),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to submit batch');
    }
    const data = await res.json();
    return data.batch;
  },

  async approveBatch(batchId: string, reason: string | undefined, token: string) {
    const res = await fetch(`${API_BASE}/batches/${batchId}/approve`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify({ reason }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Approval failed');
    }
    return res.json();
  },

  async requestChanges(batchId: string, reason: string, token: string) {
    const res = await fetch(`${API_BASE}/batches/${batchId}/changes-requested`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify({ reason }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to request changes');
    }
    return res.json();
  },

  async rejectBatch(batchId: string, reason: string, token: string) {
    const res = await fetch(`${API_BASE}/batches/${batchId}/reject`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify({ reason }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to reject batch');
    }
    return res.json();
  },

  async getAuditLogs(batchId: string, token: string): Promise<AuditLog[]> {
    const res = await fetch(`${API_BASE}/batches/${batchId}/audit`, {
      headers: getHeaders(token),
    });
    if (!res.ok) throw new Error('Failed to fetch audit logs');
    return res.json();
  },

  async runAIAudit(batchId: string, token: string): Promise<AIAuditReport> {
    const res = await fetch(`${API_BASE}/batches/${batchId}/ai-audit`, {
      method: 'POST',
      headers: getHeaders(token),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'AI Audit execution failed');
    }
    return res.json();
  },

  // --- Certificates ---
  async getCertificates(token: string): Promise<Certificate[]> {
    const res = await fetch(`${API_BASE}/certificates`, {
      headers: getHeaders(token),
    });
    if (!res.ok) throw new Error('Failed to fetch certificates');
    return res.json();
  },

  async revokeCertificate(certificateId: string, reason: string, token: string) {
    const res = await fetch(`${API_BASE}/certificates/${certificateId}/revoke`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify({ reason }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to revoke certificate');
    }
    return res.json();
  },

  async revokeBatch(batchId: string, reason: string, token: string) {
    const res = await fetch(`${API_BASE}/certificates/batch/${batchId}/revoke`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify({ reason }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to revoke batch certificates');
    }
    return res.json();
  },

  // --- Public Verification ---
  async verifyPublicly(certNumber: string) {
    const res = await fetch(`${API_BASE}/public/verify/${encodeURIComponent(certNumber)}`);
    const data = await res.json();
    return { ok: res.ok, status: res.status, data };
  },

  // --- Mock WhatsApp Service ---
  async getWhatsAppMessages(): Promise<WhatsAppMessage[]> {
    try {
      const res = await fetch(`${MOCK_WHATSAPP_URL}/messages`);
      if (!res.ok) return [];
      const data = await res.json();
      return data.messages || [];
    } catch {
      return [];
    }
  },
};
