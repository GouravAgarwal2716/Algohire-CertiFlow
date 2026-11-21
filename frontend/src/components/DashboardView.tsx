import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Batch, Candidate, AuditLog, AIAuditReport } from '../types';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { useSSE } from '../context/SSEContext';
import { StatusBadge, LoadingSpinner, ErrorAlert, SuccessAlert, Modal } from './ui';
import { AuditTimeline } from './AuditPanel';
import {
  Upload, Plus, Send, CheckCircle2,
  RotateCcw, Eye, Users, AlertTriangle,
  Sparkles, Shield, Search, Check, AlertCircle, RefreshCw
} from 'lucide-react';

interface DashboardViewProps {
  onBatchesLoaded?: (batches: Batch[]) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onBatchesLoaded }) => {
  const { user, token } = useAuth();
  const { isConnected } = useSSE();

  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null);
  const [activeTab, setActiveTab] = useState<'queue' | 'all' | 'issued'>('queue');
  const [searchQuery, setSearchQuery] = useState('');

  // Creation modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    title: '',
    courseName: 'Solar PV Technician',
    districtId: user?.districtId || 'Hyderabad',
    centreId: user?.centreId || 'Pragati Tech Centre',
  });
  const [submittingCreate, setSubmittingCreate] = useState(false);

  useEffect(() => {
    if (user) {
      setCreateForm((prev) => ({
        ...prev,
        districtId: user.districtId || 'Hyderabad',
        centreId: user.centreId || 'Pragati Tech Centre',
      }));
    }
  }, [user]);

  // Upload modal state
  const [uploadBatch, setUploadBatch] = useState<Batch | null>(null);
  const [uploadErrors, setUploadErrors] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Action state (Approve / Request Changes / Revoke)
  const [actionLoading, setActionLoading] = useState(false);
  const [returnReason, setReturnReason] = useState('');
  const [showReturnModal, setShowReturnModal] = useState<Batch | null>(null);
  const [showRevokeModal, setShowRevokeModal] = useState<Batch | null>(null);
  const [revokeReason, setRevokeReason] = useState('Forged trainee attendance records discovered during physical audit.');

  // AI analysis state in modal
  const [aiReport, setAiReport] = useState<AIAuditReport | null>(null);
  const [aiAnalyzing, setAiAnalyzing] = useState(false);

  // Detail Modal Tab
  const [detailTab, setDetailTab] = useState<'overview' | 'candidates' | 'ai' | 'audit'>('overview');
  const [batchAuditLogs, setBatchAuditLogs] = useState<AuditLog[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);

  const fetchBatches = useCallback(async () => {
    if (!token) return;
    try {
      const data = await api.getBatches(token);
      setBatches(data);
      onBatchesLoaded?.(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [token, onBatchesLoaded]);

  useEffect(() => {
    fetchBatches();
  }, [fetchBatches]);

  // Load audit logs when modal opens
  const inspectBatch = async (batch: Batch) => {
    setSelectedBatch(batch);
    setDetailTab('overview');
    setAiReport(null);
    if (!token) return;
    setLoadingAudit(true);
    try {
      const [fullBatch, logs] = await Promise.all([
        api.getBatch(batch.id, token),
        api.getAuditLogs(batch.id, token),
      ]);
      setSelectedBatch(fullBatch);
      setBatchAuditLogs(logs);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoadingAudit(false);
    }
  };

  // Filter batches based on active tab and search
  const filteredBatches = batches.filter((b) => {
    const matchesSearch =
      b.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.courseName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.id.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;

    if (activeTab === 'issued') {
      return b.status === 'COMPLETED' || b.status === 'APPROVED' || b.status === 'ISSUING';
    }
    if (activeTab === 'queue') {
      if (user?.role === 'TRAINING_CENTRE') {
        return b.status === 'DRAFT' || b.status === 'CHANGES_REQUESTED' || b.status === 'REJECTED';
      }
      if (user?.role === 'DISTRICT_OFFICER') {
        return b.status === 'PENDING_DISTRICT';
      }
      if (user?.role === 'QUALITY_TEAM') {
        return b.status === 'PENDING_QUALITY';
      }
      if (user?.role === 'STATE_OFFICE') {
        return b.status === 'PENDING_STATE';
      }
    }
    return true; // 'all'
  });

  // KPI counts
  const pendingCount = batches.filter((b) => {
    if (user?.role === 'TRAINING_CENTRE') return b.status === 'DRAFT' || b.status === 'CHANGES_REQUESTED';
    if (user?.role === 'DISTRICT_OFFICER') return b.status === 'PENDING_DISTRICT';
    if (user?.role === 'QUALITY_TEAM') return b.status === 'PENDING_QUALITY';
    if (user?.role === 'STATE_OFFICE') return b.status === 'PENDING_STATE';
    return false;
  }).length;

  const issuedCount = batches.filter((b) => b.status === 'COMPLETED' || b.status === 'APPROVED').length;
  const inProgressCount = batches.filter(
    (b) => ['PENDING_DISTRICT', 'PENDING_QUALITY', 'PENDING_STATE'].includes(b.status)
  ).length;

  // Handlers
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.title.trim()) {
      setError('Cohort title is required.');
      return;
    }
    setSubmittingCreate(true);
    setError('');
    try {
      const payload = {
        title: createForm.title.trim(),
        courseName: createForm.courseName,
        districtId: user?.districtId || createForm.districtId || 'Hyderabad',
        centreId: user?.centreId || createForm.centreId || 'Pragati Tech Centre',
      };
      await api.createBatch(payload, token!);
      setShowCreateModal(false);
      setCreateForm((prev) => ({ ...prev, title: '' }));
      setSuccess('Batch cohort created in Draft status.');
      fetchBatches();
      setTimeout(() => setSuccess(''), 4000);
    } catch (err: any) {
      setError(err.message || 'Failed to create cohort');
    } finally {
      setSubmittingCreate(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadBatch) return;
    setUploadErrors([]);
    setError('');
    setUploading(true);
    try {
      const res = await api.uploadCandidatesCsv(uploadBatch.id, file, token!);
      setSuccess(`Uploaded ${res.candidateCount} candidates successfully!`);
      setUploadBatch(null);
      fetchBatches();
      setTimeout(() => setSuccess(''), 4000);
    } catch (err: any) {
      if (err.details && Array.isArray(err.details)) {
        setUploadErrors(err.details);
      } else {
        setError(err.message || 'CSV upload failed');
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSubmitBatch = async (batchId: string) => {
    setActionLoading(true);
    setError('');
    try {
      await api.submitBatch(batchId, token!);
      setSuccess('Cohort submitted for District Quorum review!');
      fetchBatches();
      setTimeout(() => setSuccess(''), 4000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleApprove = async (batchId: string) => {
    setActionLoading(true);
    setError('');
    try {
      const res = await api.approveBatch(batchId, undefined, token!);
      setSuccess(res.message || 'Approval recorded successfully!');
      fetchBatches();
      if (selectedBatch?.id === batchId) {
        const updated = await api.getBatch(batchId, token!);
        setSelectedBatch(updated);
      }
      setTimeout(() => setSuccess(''), 4000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRequestChanges = async (batchId: string) => {
    if (!returnReason.trim()) {
      setError('A specific reason for requesting changes is required.');
      return;
    }
    setActionLoading(true);
    setError('');
    try {
      await api.requestChanges(batchId, returnReason, token!);
      setShowReturnModal(null);
      setReturnReason('');
      setSuccess('Batch returned to Training Centre with documented feedback.');
      fetchBatches();
      setTimeout(() => setSuccess(''), 4000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRevokeFirstCert = async (batch: Batch) => {
    setActionLoading(true);
    setError('');
    try {
      const res = await api.revokeBatch(batch.id, revokeReason, token!);
      setShowRevokeModal(null);
      setSuccess(`✓ ${res.message || 'Certificates revoked successfully from public registry.'}`);
      fetchBatches();
      if (selectedBatch?.id === batch.id) {
        const updated = await api.getBatch(batch.id, token!);
        setSelectedBatch(updated);
      }
      setTimeout(() => setSuccess(''), 4000);
    } catch (err: any) {
      setError(err.message || 'Revocation failed');
    } finally {
      setActionLoading(false);
    }
  };

  const runAIForensics = async (batchId: string) => {
    setAiAnalyzing(true);
    try {
      const result = await api.runAIAudit(batchId, token!);
      setAiReport(result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAiAnalyzing(false);
    }
  };

  const downloadSample = (kind: 'valid' | 'invalid' | 'large') => {
    let filename = 'valid_batch_small.csv';
    if (kind === 'invalid') filename = 'invalid_batch_with_errors.csv';
    if (kind === 'large') filename = 'valid_batch_large_60.csv';
    const link = document.createElement('a');
    link.href = `/samples/${filename}`;
    link.download = filename;
    link.click();
  };

  const getStageIndicator = (batch: Batch) => {
    const isRevoked = Boolean(
      batch.certificates &&
      batch.certificates.length > 0 &&
      batch.certificates.every((c) => c.status === 'REVOKED')
    );

    const stages = [
      { key: 'DRAFT', label: 'Draft' },
      { key: 'PENDING_DISTRICT', label: 'District' },
      { key: 'PENDING_QUALITY', label: 'Quality' },
      { key: 'PENDING_STATE', label: 'State' },
      { key: 'COMPLETED', label: isRevoked ? 'Revoked' : 'Issued' },
    ];

    const getStageState = (stageKey: string) => {
      if (isRevoked && stageKey === 'COMPLETED') return 'revoked';
      const order = ['DRAFT', 'PENDING_DISTRICT', 'PENDING_QUALITY', 'PENDING_STATE', 'APPROVED', 'ISSUING', 'COMPLETED'];
      const currentIndex = order.indexOf(batch.status);
      const stageIndex = order.indexOf(stageKey);

      if (batch.status === 'CHANGES_REQUESTED' || batch.status === 'REJECTED') {
        if (stageKey === 'DRAFT') return 'current';
        return 'upcoming';
      }
      if (stageIndex < currentIndex) return 'completed';
      if (stageIndex === currentIndex) return 'current';
      return 'upcoming';
    };

    return (
      <div className="flex items-center gap-1.5">
        {stages.map((st, idx) => {
          const state = getStageState(st.key);
          return (
            <React.Fragment key={st.key}>
              <div
                className={`flex items-center justify-center text-[10px] font-semibold px-2 py-0.5 rounded-md transition-all ${
                  state === 'revoked'
                    ? 'bg-rose-50 text-rose-700 border border-rose-200 font-bold'
                    : state === 'completed'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : state === 'current'
                    ? 'bg-blue-50 text-blue-700 border border-blue-200 font-bold ring-1 ring-blue-300'
                    : 'bg-slate-50 text-slate-400 border border-slate-100'
                }`}
              >
                {state === 'completed' && <Check className="w-2.5 h-2.5 mr-0.5" />}
                {state === 'revoked' && <span className="mr-0.5">✕</span>}
                {st.label}
              </div>
              {idx < stages.length - 1 && <span className="text-slate-300 text-xs">›</span>}
            </React.Fragment>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Alerts */}
      {error && <ErrorAlert message={error} />}
      {success && <SuccessAlert message={success} />}

      {/* Role-tailored SaaS Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold tracking-wider uppercase text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-100">
                {user?.role.replace('_', ' ')}
              </span>
              <span className="text-xs text-slate-400">•</span>
              <span className="text-xs font-medium text-slate-500">
                {user?.name} {user?.districtId ? `(${user.districtId.toUpperCase()})` : ''}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              {user?.role === 'TRAINING_CENTRE' && 'Training Centre Cohort Workspace'}
              {user?.role === 'DISTRICT_OFFICER' && 'District Verification & Signoff Desk'}
              {user?.role === 'QUALITY_TEAM' && 'Quality Assurance & Large Cohort Scrutiny'}
              {user?.role === 'STATE_OFFICE' && 'State Mission Directorate Clearance'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl">
              {user?.role === 'TRAINING_CENTRE' &&
                'Upload candidate spreadsheets, submit for district dual-signoff, and inspect certificate issuance.'}
              {user?.role === 'DISTRICT_OFFICER' &&
                'Review submitted trainee rosters. Dual-signoff required: 2 district officers must approve before advancing.'}
              {user?.role === 'QUALITY_TEAM' &&
                'Cohorts of 50 or more candidates require statistical sanity check and OpenAI GPT-4o forensic verification.'}
              {user?.role === 'STATE_OFFICE' &&
                'Final executive clearance. Generates cryptographic QR certificates, dispatches WhatsApp alerts, and manages registry revocations.'}
            </p>
          </div>

          {/* Contextual Actions */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {user?.role === 'TRAINING_CENTRE' && (
              <>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-xs transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  New Cohort Batch
                </button>
                <div className="flex items-center gap-1 border-l border-slate-200 pl-2">
                  <button
                    onClick={() => downloadSample('valid')}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors"
                    title="Download clean sample CSV"
                  >
                    Sample Valid CSV
                  </button>
                  <button
                    onClick={() => downloadSample('invalid')}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 transition-colors"
                    title="Download sample CSV with errors to test Moment 1"
                  >
                    Sample Error CSV
                  </button>
                  <button
                    onClick={() => downloadSample('large')}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 transition-colors"
                    title="Download 60-candidate cohort to trigger Neha's Quality Gate"
                  >
                    Sample Large CSV (60)
                  </button>
                </div>
              </>
            )}
            <button
              onClick={fetchBatches}
              className="p-2 text-slate-500 hover:text-slate-800 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors"
              title="Refresh cohorts"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Pastel KPI Cards Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
          <div className="bg-[#f0f9ff] border border-[#bae6fd]/60 rounded-xl p-3.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-sky-700">Total Batches</div>
            <div className="text-2xl font-black text-sky-950 mt-1">{batches.length}</div>
            <div className="text-[11px] text-sky-600 mt-0.5">Across jurisdiction</div>
          </div>
          <div className="bg-[#fef3c7] border border-[#fde68a]/60 rounded-xl p-3.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-amber-800">Action Required</div>
            <div className="text-2xl font-black text-amber-950 mt-1">{pendingCount}</div>
            <div className="text-[11px] text-amber-700 mt-0.5">Awaiting your role's turn</div>
          </div>
          <div className="bg-[#f5f3ff] border border-[#ddd6fe]/60 rounded-xl p-3.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-purple-800">In Pipeline</div>
            <div className="text-2xl font-black text-purple-950 mt-1">{inProgressCount}</div>
            <div className="text-[11px] text-purple-700 mt-0.5">District / QA / State</div>
          </div>
          <div className="bg-[#ecfdf5] border border-[#a7f3d0]/60 rounded-xl p-3.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">Issued & Live</div>
            <div className="text-2xl font-black text-emerald-950 mt-1">{issuedCount}</div>
            <div className="text-[11px] text-emerald-700 mt-0.5">Delivered to candidates</div>
          </div>
        </div>
      </div>

      {/* Filter and Tab Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl w-fit">
          <button
            onClick={() => setActiveTab('queue')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'queue'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>Needs Action</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                activeTab === 'queue' ? 'bg-blue-100 text-blue-800' : 'bg-slate-200 text-slate-600'
              }`}
            >
              {pendingCount}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'all'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            All Cohorts ({batches.length})
          </button>
          <button
            onClick={() => setActiveTab('issued')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'issued'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>Issued</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-emerald-100 text-emerald-800">
              {issuedCount}
            </span>
          </button>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by cohort title, course..."
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
        </div>
      </div>

      {/* Cohort Cards Grid */}
      {loading ? (
        <div className="py-16 text-center">
          <LoadingSpinner />
          <p className="text-xs text-slate-400 mt-2">Loading cohort records...</p>
        </div>
      ) : filteredBatches.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-12 text-center">
          <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center mx-auto text-slate-400 mb-3">
            <CheckCircle2 className="w-6 h-6 text-emerald-500" />
          </div>
          <h3 className="text-sm font-bold text-slate-800">All caught up!</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            {activeTab === 'queue'
              ? 'No batches currently require action for your role. Switch to "All Cohorts" or change persona to test other stages.'
              : 'No matching batches found.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3.5">
          {filteredBatches.map((batch) => {
            const isLarge = (batch.candidateCount || 0) >= 50;
            const districtApprovals = batch.approvals?.filter((a) => a.role === 'DISTRICT_OFFICER') || [];
            const hasMyDistrictSignoff = districtApprovals.some((a) => a.officerId === user?.id);
            const isMyTurn =
              (user?.role === 'TRAINING_CENTRE' && (batch.status === 'DRAFT' || batch.status === 'CHANGES_REQUESTED')) ||
              (user?.role === 'DISTRICT_OFFICER' && batch.status === 'PENDING_DISTRICT' && !hasMyDistrictSignoff) ||
              (user?.role === 'QUALITY_TEAM' && batch.status === 'PENDING_QUALITY') ||
              (user?.role === 'STATE_OFFICE' && batch.status === 'PENDING_STATE');

            return (
              <div
                key={batch.id}
                className={`bg-white rounded-2xl border transition-all hover:shadow-xs p-5 ${
                  isMyTurn ? 'border-blue-200 ring-1 ring-blue-500/10' : 'border-slate-200'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Cohort Info */}
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3
                        onClick={() => inspectBatch(batch)}
                        className="text-base font-bold text-slate-900 hover:text-blue-600 cursor-pointer truncate"
                      >
                        {batch.title}
                      </h3>
                      {batch.certificates && batch.certificates.length > 0 && batch.certificates.every((c) => c.status === 'REVOKED') ? (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1">
                          ✕ Revoked
                        </span>
                      ) : (
                        <StatusBadge status={batch.status} />
                      )}
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-semibold">
                        v{batch.revisionNumber}
                      </span>
                      {isLarge && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                          QA Scrutiny (≥50)
                        </span>
                      )}
                      {batch.isEscalated && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1">
                          <AlertTriangle className="w-2.5 h-2.5" /> SLA Watchdog Alert
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap">
                      <span className="font-medium text-slate-700">{batch.courseName}</span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-slate-400" />
                        {batch.candidateCount || 0} candidates
                      </span>
                      <span>•</span>
                      <span>Centre: {batch.centreId}</span>
                      <span>•</span>
                      <span className="font-mono text-[11px] text-slate-400">
                        Updated {new Date(batch.updatedAt).toLocaleTimeString()}
                      </span>
                    </div>

                    {/* Lifecycle pipeline visualizer */}
                    <div className="pt-2">{getStageIndicator(batch)}</div>
                  </div>

                  {/* Actions Column */}
                  <div className="flex items-center gap-2 flex-wrap lg:justify-end shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                    {/* Training Centre: Upload / Submit */}
                    {user?.role === 'TRAINING_CENTRE' && (batch.status === 'DRAFT' || batch.status === 'CHANGES_REQUESTED') && (
                      <>
                        <button
                          onClick={() => setUploadBatch(batch)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-colors"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          {batch.candidateCount && batch.candidateCount > 0 ? 'Replace CSV' : 'Upload CSV'}
                        </button>
                        {batch.candidateCount && batch.candidateCount > 0 && (
                          <button
                            onClick={() => handleSubmitBatch(batch.id)}
                            disabled={actionLoading}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-xs transition-colors"
                          >
                            <Send className="w-3.5 h-3.5" />
                            Submit Cohort
                          </button>
                        )}
                      </>
                    )}

                    {/* District Officer: Dual Quorum Signoff */}
                    {user?.role === 'DISTRICT_OFFICER' && batch.status === 'PENDING_DISTRICT' && (
                      <>
                        {hasMyDistrictSignoff ? (
                          <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200 flex items-center gap-1">
                            <Check className="w-3.5 h-3.5" /> Signed by You ({districtApprovals.length}/2)
                          </span>
                        ) : (
                          <button
                            onClick={() => handleApprove(batch.id)}
                            disabled={actionLoading}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-xs transition-colors"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Sign & Approve ({districtApprovals.length}/2)
                          </button>
                        )}
                        <button
                          onClick={() => setShowReturnModal(batch)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 transition-colors"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          Request Changes
                        </button>
                      </>
                    )}

                    {/* Quality Team: Scrutiny */}
                    {user?.role === 'QUALITY_TEAM' && batch.status === 'PENDING_QUALITY' && (
                      <>
                        <button
                          onClick={() => handleApprove(batch.id)}
                          disabled={actionLoading}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 shadow-xs transition-colors"
                        >
                          <Shield className="w-3.5 h-3.5" />
                          Clear Quality Gate
                        </button>
                        <button
                          onClick={() => setShowReturnModal(batch)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 transition-colors"
                        >
                          Request Changes
                        </button>
                      </>
                    )}

                    {/* State Office: Final Approval & Revocation */}
                    {user?.role === 'STATE_OFFICE' && batch.status === 'PENDING_STATE' && (
                      <button
                        onClick={() => handleApprove(batch.id)}
                        disabled={actionLoading}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-xs transition-colors"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Final Approve & Issue
                      </button>
                    )}

                    {/* State Office: Revoke Issued Batch */}
                    {user?.role === 'STATE_OFFICE' && (batch.status === 'COMPLETED' || batch.status === 'APPROVED') && (
                      batch.certificates && batch.certificates.length > 0 && batch.certificates.every((c) => c.status === 'REVOKED') ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-700 bg-rose-50 px-3 py-1.5 rounded-xl border border-rose-200">
                          ✕ Certificates Revoked
                        </span>
                      ) : (
                        <button
                          onClick={() => setShowRevokeModal(batch)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors"
                        >
                          <AlertTriangle className="w-3.5 h-3.5" />
                          Revoke Certificate
                        </button>
                      )
                    )}

                    {/* Inspect Button */}
                    <button
                      onClick={() => inspectBatch(batch)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5 text-slate-400" />
                      Inspect
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ───────────────── Modal: Create New Cohort ───────────────── */}
      {showCreateModal && (
        <Modal title="Create New Training Cohort" onClose={() => { setShowCreateModal(false); setError(''); }}>
          <form onSubmit={handleCreate} className="space-y-4">
            {error && <ErrorAlert message={error} onClose={() => setError('')} />}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Cohort Batch Title</label>
              <input
                type="text"
                required
                value={createForm.title}
                onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                placeholder="e.g. Solar PV Technician Cohort 102"
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Skilling Course</label>
              <select
                value={createForm.courseName}
                onChange={(e) => setCreateForm({ ...createForm, courseName: e.target.value })}
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              >
                <option value="Solar PV Technician">Solar PV Technician (NSQF Level 4)</option>
                <option value="Healthcare General Duty Assistant">Healthcare General Duty Assistant (NSQF Level 4)</option>
                <option value="Data Entry & Digital Operations">Data Entry & Digital Operations (NSQF Level 3)</option>
                <option value="Industrial Electrician">Industrial Electrician (NSQF Level 4)</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">District</label>
                <input
                  type="text"
                  readOnly
                  value={(user?.districtId || createForm.districtId || 'HYD').toUpperCase()}
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-500 font-medium"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Centre</label>
                <input
                  type="text"
                  readOnly
                  value={user?.centreId || createForm.centreId}
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-500 font-medium"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingCreate}
                className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-colors"
              >
                {submittingCreate ? 'Creating...' : 'Create Cohort Draft'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ───────────────── Modal: CSV Upload Roster ───────────────── */}
      {uploadBatch && (
        <Modal
          title={`Upload Trainee Roster — ${uploadBatch.title}`}
          onClose={() => {
            setUploadBatch(null);
            setUploadErrors([]);
          }}
        >
          <div className="space-y-4">
            <p className="text-xs text-slate-500">
              Upload candidate results spreadsheet. CertiFlow performs all-or-nothing validation against phone numbers,
              score thresholds, and duplicate roll numbers.
            </p>

            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-200 hover:border-blue-400 bg-slate-50/50 hover:bg-blue-50/30 rounded-2xl p-6 text-center cursor-pointer transition-all"
            >
              <Upload className="w-8 h-8 text-blue-500 mx-auto mb-2" />
              <div className="text-xs font-bold text-slate-800">
                {uploading ? 'Processing & validating CSV...' : 'Click to select CSV spreadsheet'}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">Columns: rollNo, name, phone, email, score</div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="hidden"
                disabled={uploading}
              />
            </div>

            {/* Error Table if validation failed (Moment 1) */}
            {uploadErrors.length > 0 && (
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-rose-800">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  Validation Blocked ({uploadErrors.length} errors found) — Nothing was saved
                </div>
                <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                  {uploadErrors.map((err, i) => (
                    <div key={i} className="text-[11px] bg-white p-2 rounded-lg border border-rose-100 text-rose-900">
                      <span className="font-bold">Row {err.row}:</span> {err.message}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* ───────────────── Modal: Request Changes with Reason ───────────────── */}
      {showReturnModal && (
        <Modal title="Request Corrections from Training Centre" onClose={() => setShowReturnModal(null)}>
          <div className="space-y-4">
            <p className="text-xs text-slate-600">
              Specify what needs to be fixed. The training centre will be prompted to resolve these items and resubmit.
              Prior district approvals will be reset to require fresh signoffs on updated data.
            </p>
            <textarea
              rows={3}
              value={returnReason}
              onChange={(e) => setReturnReason(e.target.value)}
              placeholder="e.g. Please verify candidates in rows 12-14: scores exceed max grade rubric."
              className="w-full text-xs p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowReturnModal(null)}
                className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={() => handleRequestChanges(showReturnModal.id)}
                disabled={actionLoading}
                className="px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-xs"
              >
                {actionLoading ? 'Returning...' : 'Send Request'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ───────────────── Modal: Revoke Certificate (State Office) ───────────────── */}
      {showRevokeModal && (
        <Modal title="Emergency Certificate Revocation" onClose={() => setShowRevokeModal(null)}>
          <div className="space-y-4">
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Permanent Invalidation:</span> All certificates issued for this cohort
                will be marked as REVOKED immediately in the public registry and cleared from Redis cache.
              </div>
            </div>

            {error && (
              <div className="p-2.5 bg-rose-100 text-rose-800 text-xs rounded-xl border border-rose-200 font-medium">
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Official Revocation Reason</label>
              <input
                type="text"
                value={revokeReason}
                onChange={(e) => setRevokeReason(e.target.value)}
                className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowRevokeModal(null)}
                className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={() => handleRevokeFirstCert(showRevokeModal)}
                disabled={actionLoading}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs"
              >
                {actionLoading ? 'Revoking...' : 'Revoke Certificate Now'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ───────────────── Modal: Multi-Tab Batch Inspection ───────────────── */}
      {selectedBatch && (
        <Modal
          title={`Cohort Inspection: ${selectedBatch.title}`}
          onClose={() => {
            setSelectedBatch(null);
            setAiReport(null);
          }}
        >
          <div className="space-y-5">
            {/* Modal Tabs */}
            <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
              <button
                onClick={() => setDetailTab('overview')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  detailTab === 'overview'
                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Overview
              </button>
              <button
                onClick={() => setDetailTab('candidates')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                  detailTab === 'candidates'
                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Candidates ({selectedBatch.candidates?.length || selectedBatch.candidateCount || 0})
              </button>
              <button
                onClick={() => setDetailTab('ai')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  detailTab === 'ai'
                    ? 'bg-purple-50 text-purple-700 border border-purple-200'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                AI Forensics (GPT-4o)
              </button>
              <button
                onClick={() => setDetailTab('audit')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  detailTab === 'audit'
                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Audit Log ({batchAuditLogs.length})
              </button>
            </div>

            {/* Tab: Overview */}
            {detailTab === 'overview' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <span className="text-[10px] text-slate-400 font-bold uppercase">Status</span>
                    <div className="mt-1">
                      <StatusBadge status={selectedBatch.status} />
                    </div>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <span className="text-[10px] text-slate-400 font-bold uppercase">Revision</span>
                    <div className="text-sm font-bold text-slate-800 mt-1">v{selectedBatch.revisionNumber}</div>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <span className="text-[10px] text-slate-400 font-bold uppercase">District</span>
                    <div className="text-sm font-bold text-slate-800 mt-1">{(selectedBatch.districtId || 'HYD').toUpperCase()}</div>
                  </div>
                </div>

                {/* District Approvals Quorum Box */}
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                  <h4 className="text-xs font-bold text-slate-800 mb-2">District Quorum Signatures (2 required)</h4>
                  {selectedBatch.approvals && selectedBatch.approvals.length > 0 ? (
                    <div className="space-y-1.5">
                      {selectedBatch.approvals.map((app) => (
                        <div
                          key={app.id}
                          className="text-xs bg-white p-2.5 rounded-lg border border-slate-200 flex items-center justify-between"
                        >
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                            <span className="font-bold text-slate-800">{app.officer?.name || app.officerId}</span>
                            <span className="text-[10px] text-slate-500">({app.role})</span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {new Date(app.createdAt).toLocaleTimeString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic">No district signatures recorded yet.</p>
                  )}
                </div>
              </div>
            )}

            {/* Tab: Candidates */}
            {detailTab === 'candidates' && (
              <div className="space-y-3">
                <div className="max-h-72 overflow-y-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] tracking-wider sticky top-0">
                      <tr>
                        <th className="py-2 px-3">Roll No</th>
                        <th className="py-2 px-3">Candidate</th>
                        <th className="py-2 px-3">Phone</th>
                        <th className="py-2 px-3 text-right">Score</th>
                        <th className="py-2 px-3 text-center">Certificate</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedBatch.candidates && selectedBatch.candidates.length > 0 ? (
                        selectedBatch.candidates.map((c) => (
                          <tr key={c.id} className="hover:bg-slate-50/50">
                            <td className="py-2 px-3 font-mono font-medium text-slate-700">{c.rollNumber}</td>
                            <td className="py-2 px-3 font-semibold text-slate-900">{c.fullName}</td>
                            <td className="py-2 px-3 text-slate-500 font-mono">{c.phone}</td>
                            <td className="py-2 px-3 text-right font-bold text-slate-800">{c.score}%</td>
                            <td className="py-2 px-3 text-center">
                              {c.certificate?.certificateNumber ? (
                                <span className="font-mono text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-semibold">
                                  {c.certificate.certificateNumber}
                                </span>
                              ) : (
                                <span className="text-slate-400 text-[10px]">—</span>
                              )}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-slate-400">
                            No candidates uploaded yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Tab: AI Forensics */}
            {detailTab === 'ai' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-slate-800">OpenAI GPT-4o Forensic Analysis</h4>
                    <p className="text-[11px] text-slate-500">
                      Detects phone number recycling, score clustering anomalies, and credential spoofing.
                    </p>
                  </div>
                  <button
                    onClick={() => runAIForensics(selectedBatch.id)}
                    disabled={aiAnalyzing}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-xl shadow-xs transition-colors"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    {aiAnalyzing ? 'Analyzing with GPT-4o...' : 'Run Forensic Scan'}
                  </button>
                </div>

                {aiReport ? (
                  <div className="space-y-3">
                    <div className="p-3.5 rounded-xl bg-purple-50 border border-purple-200 text-purple-950 text-xs">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold">Risk Assessment</span>
                        <span
                          className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                            aiReport.riskLevel === 'HIGH'
                              ? 'bg-rose-100 text-rose-800'
                              : aiReport.riskLevel === 'MEDIUM'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          Risk Score: {aiReport.riskScore}/100 • {aiReport.riskLevel}
                        </span>
                      </div>
                      <p className="text-slate-700 mt-1 font-medium">{aiReport.recommendation.summary}</p>
                      <p className="text-slate-500 mt-1 text-[11px]">{aiReport.recommendation.rationale}</p>
                    </div>

                    {aiReport.findings && aiReport.findings.length > 0 && (
                      <div className="space-y-1.5">
                        <span className="text-xs font-bold text-slate-800">Detected Signals & Findings:</span>
                        {aiReport.findings.map((f, i) => (
                          <div key={i} className="text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-slate-800">{f.title}</span>
                              <span
                                className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                                  f.severity === 'CRITICAL'
                                    ? 'bg-rose-100 text-rose-700'
                                    : f.severity === 'WARNING'
                                    ? 'bg-amber-100 text-amber-700'
                                    : 'bg-blue-100 text-blue-700'
                                }`}
                              >
                                {f.severity}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5">{f.description}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-6 text-center border border-dashed border-slate-200 rounded-xl text-slate-400 text-xs">
                    Click "Run Forensic Scan" to invoke OpenAI GPT-4o on this cohort roster.
                  </div>
                )}
              </div>
            )}

            {/* Tab: Audit */}
            {detailTab === 'audit' && (
              <div className="max-h-72 overflow-y-auto">
                {loadingAudit ? (
                  <div className="py-8 text-center"><LoadingSpinner /></div>
                ) : (
                  <AuditTimeline logs={batchAuditLogs} />
                )}
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
};
