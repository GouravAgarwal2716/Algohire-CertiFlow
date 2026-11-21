import React from 'react';
import { BatchStatus } from '../types';
import { FileEdit, Building2, ShieldAlert, Award, Send } from 'lucide-react';

interface WorkflowStepperProps {
  currentFilter?: string;
  onSelectFilter: (status: string | 'ALL') => void;
  batchCounts: Record<string, number>;
}

export const WorkflowStepper: React.FC<WorkflowStepperProps> = ({
  currentFilter = 'ALL',
  onSelectFilter,
  batchCounts,
}) => {
  const steps = [
    {
      id: 'DRAFT',
      name: '1. Roster Ingestion',
      sub: 'CSV Upload & Draft',
      icon: FileEdit,
      bgActive: 'bg-slate-800 text-white shadow-md',
      bgInactive: 'bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-200',
      badgeBg: 'bg-slate-200 text-slate-800',
    },
    {
      id: 'PENDING_DISTRICT',
      name: '2. District Quorum',
      sub: '2 Distinct Officers',
      icon: Building2,
      bgActive: 'bg-sky-600 text-white shadow-md shadow-sky-500/20',
      bgInactive: 'bg-sky-50/70 text-sky-800 hover:bg-sky-100 border-sky-200',
      badgeBg: 'bg-sky-200 text-sky-800',
    },
    {
      id: 'PENDING_QUALITY',
      name: '3. Quality Gate',
      sub: 'Batches ≥ 50 candidates',
      icon: ShieldAlert,
      bgActive: 'bg-purple-600 text-white shadow-md shadow-purple-500/20',
      bgInactive: 'bg-purple-50/70 text-purple-800 hover:bg-purple-100 border-purple-200',
      badgeBg: 'bg-purple-200 text-purple-800',
    },
    {
      id: 'PENDING_STATE',
      name: '4. State Clearance',
      sub: 'Director Approval',
      icon: Award,
      bgActive: 'bg-amber-600 text-white shadow-md shadow-amber-500/20',
      bgInactive: 'bg-amber-50/70 text-amber-800 hover:bg-amber-100 border-amber-200',
      badgeBg: 'bg-amber-200 text-amber-800',
    },
    {
      id: 'ISSUING_OR_COMPLETED',
      name: '5. Issuance & Delivery',
      sub: 'PDF + WhatsApp Dispatched',
      icon: Send,
      bgActive: 'bg-emerald-600 text-white shadow-md shadow-emerald-500/20',
      bgInactive: 'bg-emerald-50/70 text-emerald-800 hover:bg-emerald-100 border-emerald-200',
      badgeBg: 'bg-emerald-200 text-emerald-800',
    },
  ];

  const totalBatches = Object.values(batchCounts).reduce((a, b) => a + b, 0);

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-sm font-bold tracking-tight text-slate-800 uppercase flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-blue-600 animate-pulse" />
            CertiFlow Lifecycle Stepper
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">Click any stage to filter batches or see stage progress</p>
        </div>
        <button
          onClick={() => onSelectFilter('ALL')}
          className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-all ${
            currentFilter === 'ALL'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          View All ({totalBatches})
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {steps.map((step) => {
          const Icon = step.icon;
          const count =
            step.id === 'ISSUING_OR_COMPLETED'
              ? (batchCounts['ISSUING'] || 0) + (batchCounts['COMPLETED'] || 0)
              : batchCounts[step.id] || 0;
          const isSelected = currentFilter === step.id;

          return (
            <button
              key={step.id}
              onClick={() => onSelectFilter(step.id)}
              className={`p-3.5 rounded-xl border text-left transition-all relative overflow-hidden flex flex-col justify-between ${
                isSelected ? step.bgActive : step.bgInactive
              }`}
            >
              <div className="flex items-center justify-between w-full mb-2">
                <div className={`p-2 rounded-lg ${isSelected ? 'bg-white/20' : 'bg-white shadow-xs'}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <span
                  className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    isSelected ? 'bg-white/30 text-white' : step.badgeBg
                  }`}
                >
                  {count}
                </span>
              </div>
              <div>
                <p className="text-xs font-bold leading-tight">{step.name}</p>
                <p className={`text-[11px] mt-0.5 ${isSelected ? 'text-white/80' : 'opacity-75'}`}>
                  {step.sub}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
