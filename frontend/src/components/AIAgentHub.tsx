import React, { useState } from 'react';
import { Batch, AIAuditReport } from '../types';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { LoadingSpinner } from './ui';
import {
  BrainCircuit,
  AlertTriangle,
  CheckCircle2,
  Zap,
  Fingerprint,
  Sparkles,
  BarChart3,
  Bot,
  Search,
  ExternalLink
} from 'lucide-react';

interface AIAgentHubProps {
  batches: Batch[];
  onOpenBatchDetail: (batch: Batch) => void;
}

export const AIAgentHub: React.FC<AIAgentHubProps> = ({ batches, onOpenBatchDetail }) => {
  const { token } = useAuth();
  const [selectedBatchId, setSelectedBatchId] = useState<string>(batches[0]?.id || '');
  const [report, setReport] = useState<AIAuditReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeStage, setActiveStage] = useState<number>(0);

  const selectedBatch = batches.find((b) => b.id === selectedBatchId);

  const stages = [
    { label: 'Feature Extraction', desc: 'Gaussian variance & statistical moments' },
    { label: 'Forensic Heuristics', desc: 'Ghost SIM sequential contacts & clumping' },
    { label: 'Risk Evaluation', desc: 'Centre risk coefficient calculation' },
    { label: 'OpenAI GPT-4o Synthesis', desc: 'Neural forensic reasoning & governance verdict' },
  ];

  const runAudit = async () => {
    if (!selectedBatchId) return;
    setLoading(true);
    setError(null);
    setActiveStage(1);

    const t1 = setTimeout(() => setActiveStage(2), 350);
    const t2 = setTimeout(() => setActiveStage(3), 700);
    const t3 = setTimeout(() => setActiveStage(4), 1050);

    try {
      const res = await api.runAIAudit(selectedBatchId, token!);
      setTimeout(() => {
        setReport(res);
        setLoading(false);
        setActiveStage(0);
      }, 1400);
    } catch (err: any) {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      setError(err.message || 'AI Audit execution failed');
      setLoading(false);
      setActiveStage(0);
    }
  };

  const riskColors = {
    LOW: {
      bg: 'bg-emerald-50/80',
      border: 'border-emerald-200',
      text: 'text-emerald-900',
      pill: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    },
    MEDIUM: {
      bg: 'bg-amber-50/80',
      border: 'border-amber-200',
      text: 'text-amber-900',
      pill: 'bg-amber-100 text-amber-800 border-amber-300',
    },
    HIGH: {
      bg: 'bg-rose-50/80',
      border: 'border-rose-200',
      text: 'text-rose-900',
      pill: 'bg-rose-100 text-rose-800 border-rose-300',
    },
  };

  return (
    <div className="space-y-6">
      {/* Hero Header */}
      <div className="bg-gradient-to-r from-purple-950 via-indigo-900 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-8 opacity-10 pointer-events-none">
          <BrainCircuit className="w-80 h-80 text-purple-300" />
        </div>
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/20 border border-purple-400/30 text-purple-200 text-xs font-bold mb-3">
            <Sparkles className="h-3.5 w-3.5 text-purple-300" />
            Powered by OpenAI GPT-4o & Statistical Forensic Engine
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Pragati AI Quality & Forensic Copilot
          </h1>
          <p className="mt-2 text-sm text-purple-200/80 leading-relaxed">
            Autonomous multi-stage audit pipeline for State Credentialing. Analyzes candidate scores,
            detects ghost-candidate SIM clusters, identifies grade fabrication, and synthesizes
            actionable governance decisions before certificate generation.
          </p>

          {/* Batch Selector Bar */}
          <div className="mt-6 flex items-center gap-3 flex-wrap">
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-1.5 border border-white/20 flex items-center gap-2 flex-1 min-w-[280px]">
              <Search className="h-4 w-4 text-purple-300 ml-2" />
              <select
                className="bg-transparent text-sm text-white font-medium focus:outline-none w-full cursor-pointer pr-2"
                value={selectedBatchId}
                onChange={(e) => {
                  setSelectedBatchId(e.target.value);
                  setReport(null);
                }}
              >
                {batches.map((b) => (
                  <option key={b.id} value={b.id} className="text-slate-900">
                    {b.title} ({b.candidateCount} candidates — {b.districtId})
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={runAudit}
              disabled={loading || !selectedBatchId}
              className="bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white text-sm font-bold px-6 py-2.5 rounded-xl shadow-lg transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {loading ? <LoadingSpinner size="sm" /> : <Zap className="h-4 w-4 text-yellow-300" />}
              {loading ? 'Executing Pipeline...' : 'Run Forensic Pipeline'}
            </button>
          </div>
        </div>

        {/* Pipeline Execution Animation */}
        {loading && (
          <div className="mt-8 pt-6 border-t border-purple-800/60">
            <p className="text-xs font-semibold text-purple-300 uppercase tracking-wider mb-3">
              Progressive Pipeline Execution
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              {stages.map((stg, idx) => {
                const stepNum = idx + 1;
                const isCurrent = activeStage === stepNum;
                const isDone = activeStage > stepNum;
                return (
                  <div
                    key={stg.label}
                    className={`p-3 rounded-xl border text-xs transition-all ${
                      isCurrent
                        ? 'bg-purple-600/50 border-purple-400 text-white shadow-md animate-pulse'
                        : isDone
                        ? 'bg-emerald-900/40 border-emerald-500/50 text-emerald-300'
                        : 'bg-white/5 border-white/10 text-purple-300/40'
                    }`}
                  >
                    <div className="font-bold flex items-center gap-1.5">
                      {isDone ? '✓' : stepNum}. {stg.label}
                    </div>
                    <div className="text-[10px] opacity-75 mt-0.5 truncate">{stg.desc}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-sm">
          {error}
        </div>
      )}

      {/* Main Audit Report Results */}
      {report && (
        <div className="space-y-6">
          {/* Executive Summary Card */}
          {(() => {
            const colors = riskColors[report.riskLevel];
            return (
              <div className={`${colors.bg} ${colors.border} border-2 rounded-2xl p-6 shadow-sm`}>
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="space-y-2 max-w-2xl">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-black px-3 py-1 rounded-full border ${colors.pill}`}>
                        {report.riskLevel} RISK VERDICT
                      </span>
                      <span className="text-xs font-mono text-slate-500">
                        Evaluated {new Date(report.analyzedAt).toLocaleTimeString()}
                      </span>
                    </div>
                    <h3 className={`text-xl font-extrabold ${colors.text}`}>
                      {report.recommendation.summary}
                    </h3>
                    <p className="text-sm text-slate-700 leading-relaxed">
                      {report.recommendation.rationale}
                    </p>
                  </div>

                  {/* Integrity Gauge */}
                  <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm text-center min-w-[140px]">
                    <div className="text-4xl font-black text-slate-900 font-mono">
                      {100 - report.riskScore}%
                    </div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                      Integrity Index
                    </div>
                    <div className="mt-2 text-xs font-semibold text-purple-700">
                      Risk: {report.riskScore}/100
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-slate-200/60 flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Bot className="h-4 w-4 text-purple-700" />
                    <span className="text-xs font-bold text-purple-950 uppercase tracking-wider">
                      Prescribed Action:
                    </span>
                    <span className="text-xs font-extrabold bg-purple-100 text-purple-800 px-2.5 py-1 rounded-md">
                      {report.recommendation.action.replace(/_/g, ' ')}
                    </span>
                  </div>
                  {selectedBatch && (
                    <button
                      onClick={() => onOpenBatchDetail(selectedBatch)}
                      className="text-xs font-semibold text-purple-700 hover:text-purple-900 underline flex items-center gap-1"
                    >
                      Open full batch details <ExternalLink className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Statistical Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              {
                label: 'Mean Assessment Score',
                val: `${report.statistics.meanScore}%`,
                sub: 'State target: 70–85%',
                bg: 'bg-sky-50/70 border-sky-200',
              },
              {
                label: 'Gaussian Spread (Std Dev)',
                val: `±${report.statistics.stdDev} pts`,
                sub: report.statistics.stdDev < 2 ? '⚠️ High clumping' : '✓ Natural variance',
                bg: 'bg-purple-50/70 border-purple-200',
              },
              {
                label: 'Pass Ratio',
                val: `${report.statistics.passRate}%`,
                sub: `${report.candidateCount} total candidates`,
                bg: 'bg-emerald-50/70 border-emerald-200',
              },
              {
                label: 'Min / Max Bounds',
                val: `${report.statistics.minScore}% - ${report.statistics.maxScore}%`,
                sub: 'Evaluation range 0–100',
                bg: 'bg-amber-50/70 border-amber-200',
              },
            ].map((m) => (
              <div key={m.label} className={`rounded-2xl p-4 border ${m.bg} shadow-xs`}>
                <p className="text-xs font-semibold text-slate-500">{m.label}</p>
                <p className="text-2xl font-black text-slate-900 mt-1">{m.val}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">{m.sub}</p>
              </div>
            ))}
          </div>

          {/* Forensic Anomaly Findings */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <Fingerprint className="h-5 w-5 text-purple-600" />
                Forensic Check Findings ({report.findings.length})
              </h3>
              <span className="text-xs text-slate-400 font-mono">
                Batch: {report.batchTitle}
              </span>
            </div>

            {report.findings.length === 0 ? (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3 text-emerald-800 text-sm">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0" />
                <div>
                  <p className="font-bold">Zero Anomalies Detected</p>
                  <p className="text-xs text-emerald-700 mt-0.5">
                    Scores follow standard Gaussian distribution; all candidate phone numbers and
                    roll numbers are heterogeneous.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {report.findings.map((f) => (
                  <div
                    key={f.code}
                    className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex items-start gap-3.5"
                  >
                    <div className="mt-0.5">
                      {f.severity === 'CRITICAL' ? (
                        <AlertTriangle className="h-5 w-5 text-rose-600" />
                      ) : f.severity === 'WARNING' ? (
                        <AlertTriangle className="h-5 w-5 text-amber-600" />
                      ) : (
                        <CheckCircle2 className="h-5 w-5 text-sky-600" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-bold text-slate-900">{f.title}</p>
                        <span
                          className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full font-mono ${
                            f.severity === 'CRITICAL'
                              ? 'bg-rose-100 text-rose-800 border border-rose-200'
                              : f.severity === 'WARNING'
                              ? 'bg-amber-100 text-amber-800 border border-amber-200'
                              : 'bg-sky-100 text-sky-800 border border-sky-200'
                          }`}
                        >
                          {f.severity}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                        {f.description}
                      </p>
                      {f.affectedCandidates && f.affectedCandidates.length > 0 && (
                        <div className="mt-2.5 p-2 bg-white rounded-lg border border-amber-200/80 text-xs font-mono text-amber-900">
                          <span className="font-bold text-amber-700">Flagged Cluster: </span>
                          {f.affectedCandidates.join(' | ')}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!report && !loading && (
        <div className="bg-white rounded-3xl border border-slate-200/80 p-12 text-center space-y-3 shadow-xs">
          <div className="h-16 w-16 bg-purple-50 rounded-2xl flex items-center justify-center mx-auto text-purple-600 shadow-xs">
            <BrainCircuit className="h-8 w-8" />
          </div>
          <h3 className="font-bold text-slate-800 text-lg">No Audit Run for this Batch Yet</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
            Select a batch from the dropdown above and click{' '}
            <strong>"Run Forensic Pipeline"</strong> to perform automated fraud detection and OpenAI
            GPT-4o executive analysis.
          </p>
        </div>
      )}
    </div>
  );
};
