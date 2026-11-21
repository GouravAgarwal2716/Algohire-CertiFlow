import React, { useState } from 'react';
import { BatchStatus } from '../types';

interface StatusBadgeProps {
  status: BatchStatus | string;
  isEscalated?: boolean;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, isEscalated }) => {
  const cfg: Record<string, { color: string; label: string }> = {
    DRAFT:               { color: 'bg-slate-50 text-slate-700 border border-slate-200/90', label: 'Draft' },
    PENDING_DISTRICT:    { color: 'bg-sky-50 text-sky-800 border border-sky-200/90', label: 'District Review' },
    PENDING_QUALITY:     { color: 'bg-purple-50 text-purple-800 border border-purple-200/90', label: 'Quality Scrutiny' },
    PENDING_STATE:       { color: 'bg-amber-50 text-amber-800 border border-amber-200/90', label: 'State Review' },
    APPROVED:            { color: 'bg-teal-50 text-teal-800 border border-teal-200/90', label: 'Approved' },
    ISSUING:             { color: 'bg-indigo-50 text-indigo-800 border border-indigo-200 animate-pulse', label: '⚡ Issuing...' },
    COMPLETED:           { color: 'bg-emerald-50 text-emerald-800 border border-emerald-200/90', label: '✓ Delivered' },
    CHANGES_REQUESTED:   { color: 'bg-rose-50 text-rose-800 border border-rose-200/90', label: 'Changes Requested' },
    REJECTED:            { color: 'bg-red-50 text-red-800 border border-red-200/90', label: 'Rejected' },
  };
  const s = cfg[status] || { color: 'bg-slate-50 text-slate-700 border border-slate-200', label: status };
  return (
    <span className="flex items-center gap-1.5 flex-wrap">
      <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${s.color}`}>{s.label}</span>
      {isEscalated && (
        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-300 animate-pulse">
          ⚠ SLA BREACH
        </span>
      )}
    </span>
  );
};

export const LoadingSpinner: React.FC<{ size?: 'sm' | 'md' | 'lg' }> = ({ size = 'md' }) => {
  const s = { sm: 'h-4 w-4', md: 'h-6 w-6', lg: 'h-10 w-10' }[size];
  return <div className={`${s} border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin`} />;
};

export const ErrorAlert: React.FC<{ message: string; onClose?: () => void }> = ({ message, onClose }) => (
  <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start justify-between gap-3">
    <div className="flex items-start gap-2">
      <span className="text-red-500 text-lg">⚠</span>
      <p className="text-sm text-red-700">{message}</p>
    </div>
    {onClose && (
      <button onClick={onClose} className="text-red-400 hover:text-red-600 font-bold text-lg leading-none">×</button>
    )}
  </div>
);

export const SuccessAlert: React.FC<{ message: string }> = ({ message }) => (
  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex items-center gap-2">
    <span className="text-emerald-500">✓</span>
    <p className="text-sm text-emerald-700 font-medium">{message}</p>
  </div>
);

// Modal component
export const Modal: React.FC<{ title: string; onClose: () => void; children: React.ReactNode; size?: 'md' | 'lg' | 'xl' }> = ({
  title, onClose, children, size = 'lg'
}) => {
  const widths = { md: 'max-w-md', lg: 'max-w-2xl', xl: 'max-w-4xl' };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className={`${widths[size]} w-full bg-white rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h2 className="font-bold text-slate-900 text-lg">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl leading-none font-light">×</button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
};

// Confirm dialog
export function useConfirm() {
  const [state, setState] = useState<{ message: string; resolve: (val: string | null) => void } | null>(null);

  const confirm = (message: string): Promise<string | null> =>
    new Promise((resolve) => setState({ message, resolve }));

  const ConfirmDialog: React.FC = () => {
    const [inputVal, setInputVal] = useState('');
    if (!state) return null;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full space-y-4">
          <h3 className="font-bold text-slate-900">{state.message}</h3>
          <input
            className="input"
            placeholder="Enter reason (required)..."
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            autoFocus
          />
          <div className="flex gap-3 justify-end">
            <button className="btn-secondary" onClick={() => { setState(null); state.resolve(null); }}>Cancel</button>
            <button
              className="btn-danger"
              disabled={!inputVal.trim()}
              onClick={() => { setState(null); state.resolve(inputVal.trim()); }}
            >
              Confirm
            </button>
          </div>
        </div>
      </div>
    );
  };

  return { confirm, ConfirmDialog };
}
