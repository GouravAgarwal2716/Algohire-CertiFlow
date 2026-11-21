import React, { useState } from 'react';
import { AuditLog, AIAuditReport } from '../types';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { LoadingSpinner } from './ui';
import { BrainCircuit, AlertTriangle, CheckCircle2, ShieldCheck, Zap, BarChart3, Fingerprint, Layers } from 'lucide-react';

export const AuditTimeline: React.FC<{ logs: AuditLog[] }> = ({ logs }) => {
  const actionColors: Record<string, string> = {
    BATCH_CREATED:           'bg-slate-400',
    CANDIDATES_UPLOADED:     'bg-blue-400',
    BATCH_SUBMITTED:         'bg-indigo-400',
    BATCH_RESUBMITTED:       'bg-indigo-500',
    BATCH_APPROVED:          'bg-emerald-400',
    CHANGES_REQUESTED:       'bg-orange-400',
    BATCH_REJECTED:          'bg-red-400',
    SLA_ESCALATED:           'bg-red-500',
    CERTIFICATE_DELIVERED:   'bg-teal-400',
    BATCH_COMPLETED:         'bg-emerald-500',
    CERTIFICATE_REVOKED:     'bg-red-600',
    AI_QUALITY_AUDIT_COMPLETED: 'bg-purple-500',
  };

  if (logs.length === 0) {
    return <p className="text-sm text-slate-400 italic">No audit events recorded yet.</p>;
  }

  return (
    <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
      {logs.map((log, i) => (
        <div key={log.id} className="flex gap-3">
          <div className="flex flex-col items-center">
            <div className={`h-3 w-3 rounded-full mt-1.5 ${actionColors[log.action] || 'bg-slate-300'}`} />
            {i < logs.length - 1 && <div className="w-0.5 bg-slate-200 flex-1 mt-1" />}
          </div>
          <div className="pb-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-slate-800">{log.action.replace(/_/g, ' ')}</span>
              {log.newState && (
                <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-mono">→ {log.newState}</span>
              )}
            </div>
            <div className="text-xs text-slate-500 mt-0.5 space-x-2">
              <span>{new Date(log.createdAt).toLocaleString()}</span>
              {log.actorRole && <span className="bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">{log.actorRole}</span>}
              {log.correlationId && (
                <span className="font-mono text-slate-400">ID: {log.correlationId.slice(0, 8)}...</span>
              )}
            </div>
            {log.metadata && typeof log.metadata === 'object' && (log.metadata as any).reason && (
              <p className="text-xs text-orange-700 bg-orange-50 mt-1 px-2 py-1 rounded italic">
                Reason: {(log.metadata as any).reason}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

interface AIAuditPanelProps {
  batchId: string;
  onClose?: () => void;
}

export const AIAuditPanel: React.FC<AIAuditPanelProps> = ({ batchId }) => {
  const { token } = useAuth();
  const [report, setReport] = useState<AIAuditReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeStage, setActiveStage] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  const stages = [
    { label: 'Feature Extraction', desc: 'Gaussian variance & score moments' },
    { label: 'Forensic Heuristics', desc: 'Ghost SIMs & clumping detection' },
    { label: 'Risk Evaluation', desc: 'Centre risk coefficient calculation' },
    { label: 'Decision Synthesis', desc: 'Governance recommendation output' },
  ];

  const runAudit = async () => {
    setLoading(true);
    setError(null);
    setActiveStage(1);

    const timer1 = setTimeout(() => setActiveStage(2), 400);
    const timer2 = setTimeout(() => setActiveStage(3), 800);
    const timer3 = setTimeout(() => setActiveStage(4), 1200);

    try {
      const r = await api.runAIAudit(batchId, token!);
      setTimeout(() => {
        setReport(r);
        setLoading(false);
        setActiveStage(0);
      }, 1400);
    } catch (err: any) {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      setError(err.message);
      setLoading(false);
      setActiveStage(0);
    }
  };

  const riskColors = {
    LOW:    { bg: 'bg-emerald-50', border: 'border-emerald-300', text: 'text-emerald-800', badge: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
    MEDIUM: { bg: 'bg-amber-50', border: 'border-amber-300', text: 'text-amber-800', badge: 'bg-amber-100 text-amber-800 border-amber-300' },
    HIGH:   { bg: 'bg-red-50', border: 'border-red-300', text: 'text-red-800', badge: 'bg-red-100 text-red-800 border-red-300' },
  };

  const severityIcon = (sev: string) => {
    if (sev === 'CRITICAL') return <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0" />;
    if (sev === 'WARNING')  return <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0" />;
    return <CheckCircle2 className="h-4 w-4 text-blue-600 flex-shrink-0" />;
  };

  return (
    <div className="space-y-5">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 text-white rounded-xl p-5 shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 transform translate-x-8 -translate-y-8 opacity-10 pointer-events-none">
          <BrainCircuit className="h-56 w-56 text-purple-300" />
        </div>
        <div className="relative z-10 flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="bg-purple-500/30 text-purple-200 border border-purple-400/30 text-[11px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
                <Zap className="h-3 w-3 text-purple-300" /> Pragati Agentic AI
              </span>
              <span className="text-purple-300 text-xs font-mono">Model: Statistical Forensic NLP</span>
            </div>
            <h3 className="text-xl font-extrabold text-white mt-1">Autonomous Batch Quality & Anomaly Inspector</h3>
            <p className="text-xs text-purple-200/80 mt-1 max-w-xl">
              Detects ghost candidate clusters, grade fabrication, and pass-threshold boundary clumping before state issuance.
            </p>
          </div>
          <button
            onClick={runAudit}
            disabled={loading}
            className="flex items-center gap-2 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white text-sm font-bold px-5 py-2.5 rounded-xl transition-all shadow-md hover:shadow-purple-500/30 disabled:opacity-50"
          >
            {loading ? <LoadingSpinner size="sm" /> : <BrainCircuit className="h-4 w-4 text-purple-200" />}
            {loading ? 'Running Pipeline...' : 'Run Forensic Pipeline'}
          </button>
        </div>

        {/* Real-time 4-Stage Execution Progress */}
        {loading && (
          <div className="mt-5 pt-4 border-t border-purple-800/60">
            <div className="grid grid-cols-4 gap-2">
              {stages.map((stg, idx) => {
                const stepNum = idx + 1;
                const isCurrent = activeStage === stepNum;
                const isDone = activeStage > stepNum;
                return (
                  <div
                    key={stg.label}
                    className={`p-2.5 rounded-lg border text-xs transition-all ${
                      isCurrent
                        ? 'bg-purple-600/40 border-purple-400 text-white animate-pulse'
                        : isDone
                        ? 'bg-emerald-900/40 border-emerald-500/50 text-emerald-300'
                        : 'bg-white/5 border-white/10 text-purple-300/50'
                    }`}
                  >
                    <div className="font-bold flex items-center gap-1.5">
                      {isDone ? '✓' : stepNum}. {stg.label}
                    </div>
                    <div className="text-[10px] opacity-80 mt-0.5 truncate">{stg.desc}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {error && <div className="text-sm text-red-600 bg-red-50 p-4 rounded-xl border border-red-200">{error}</div>}

      {/* Report View */}
      {report && (() => {
        const colors = riskColors[report.riskLevel];
        return (
          <div className="space-y-4">
            {/* Risk Verdict Banner */}
            <div className={`${colors.bg} ${colors.border} border-2 rounded-xl p-5 shadow-sm`}>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-extrabold px-3 py-1 rounded-full border ${colors.badge}`}>
                      {report.riskLevel} RISK VERDICT
                    </span>
                    <span className="text-xs font-mono text-slate-500">Risk Coefficient: {report.riskScore} / 100</span>
                  </div>
                  <h4 className={`text-lg font-bold mt-2 ${colors.text}`}>{report.recommendation.summary}</h4>
                  <p className="text-sm text-slate-700 mt-1">{report.recommendation.rationale}</p>
                </div>

                <div className="bg-white/90 rounded-xl p-3 border border-slate-200 shadow-sm text-center min-w-[130px]">
                  <div className="text-3xl font-black text-slate-900 font-mono">{100 - report.riskScore}%</div>
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Integrity Index</div>
                </div>
              </div>
            </div>

            {/* Statistical Feature Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Cohort Mean Score', value: `${report.statistics.meanScore}%`, sub: 'Benchmark: 70–85%' },
                { label: 'Gaussian Variance', value: `±${report.statistics.stdDev} pts`, sub: report.statistics.stdDev < 2 ? '⚠️ Unnatural clumping' : '✓ Normal spread' },
                { label: 'Pass Rate', value: `${report.statistics.passRate}%`, sub: `${report.candidateCount} candidates` },
                { label: 'Score Range', value: `${report.statistics.minScore} - ${report.statistics.maxScore}`, sub: 'Evaluated scale 0–100' },
              ].map((s) => (
                <div key={s.label} className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm">
                  <div className="text-xs text-slate-500 font-medium">{s.label}</div>
                  <div className="text-xl font-extrabold text-slate-900 mt-1">{s.value}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">{s.sub}</div>
                </div>
              ))}
            </div>

            {/* Findings & Forensic Flags */}
            <div className="card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                  <Fingerprint className="h-4 w-4 text-purple-600" />
                  Forensic Anomaly Checklist ({report.findings.length} findings)
                </h4>
                <span className="text-xs text-slate-400 font-mono">Analyzed {new Date(report.analyzedAt).toLocaleTimeString()}</span>
              </div>

              {report.findings.length === 0 ? (
                <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-lg text-emerald-800 text-sm flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0" />
                  <span>Zero statistical deviations detected. Scores and candidate phone metadata conform to natural demographic distributions.</span>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {report.findings.map((f) => (
                    <div key={f.code} className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-200 bg-slate-50/70">
                      <div className="mt-0.5">{severityIcon(f.severity)}</div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-bold text-slate-900">{f.title}</p>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded font-mono ${
                            f.severity === 'CRITICAL' ? 'bg-red-100 text-red-700' :
                            f.severity === 'WARNING' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                          }`}>
                            {f.severity}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 mt-1 leading-relaxed">{f.description}</p>
                        {f.affectedCandidates && f.affectedCandidates.length > 0 && (
                          <div className="mt-2 text-xs bg-white p-2 rounded border border-amber-200 text-amber-900 font-mono">
                            <span className="font-bold">Flagged Sample: </span>
                            {f.affectedCandidates.join(' | ')}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Prescribed State Action */}
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-extrabold text-purple-700 uppercase tracking-wider">Prescribed Governance Action</span>
                <p className="text-sm font-extrabold text-purple-950 mt-0.5">
                  {report.recommendation.action.replace(/_/g, ' ')}
                </p>
              </div>
              <span className="bg-purple-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm">
                AI Copilot Advised
              </span>
            </div>
          </div>
        );
      })()}

      {!report && !loading && (
        <div className="card p-8 text-center space-y-3">
          <BrainCircuit className="h-12 w-12 text-purple-400 mx-auto opacity-50" />
          <h4 className="font-bold text-slate-800">No Forensic Audit Executed Yet</h4>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Click <strong>"Run Forensic Pipeline"</strong> above to inspect candidate marks for Gaussian deviations, artificial score clumping, and ghost SIM clusters.
          </p>
        </div>
      )}
    </div>
  );
};
