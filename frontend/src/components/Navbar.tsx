import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useSSE } from '../context/SSEContext';
import { api } from '../api';
import {
  ShieldCheck,
  RotateCcw,
  Layers,
  BrainCircuit,
  MessageSquare,
  ExternalLink,
  ChevronDown
} from 'lucide-react';

interface NavItem {
  id: 'workflows' | 'ai-agent' | 'whatsapp' | 'verify';
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

interface NavbarProps {
  currentTab: 'workflows' | 'ai-agent' | 'whatsapp' | 'verify';
  setCurrentTab: (tab: 'workflows' | 'ai-agent' | 'whatsapp' | 'verify') => void;
  onResetDemo?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentTab, setCurrentTab, onResetDemo }) => {
  const { user, users, switchPersona, loading } = useAuth();
  const { isConnected } = useSSE();

  const navItems: NavItem[] = [
    { id: 'workflows', label: 'Pipeline Hub', icon: Layers },
    { id: 'ai-agent', label: 'AI Forensic Copilot', icon: BrainCircuit, badge: 'GPT-4o' },
    { id: 'whatsapp', label: 'WhatsApp Simulator', icon: MessageSquare },
    { id: 'verify', label: 'Public Registry', icon: ExternalLink },
  ];

  // Initials for avatar
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getRoleColor = (role?: string) => {
    switch (role) {
      case 'TRAINING_CENTRE':
        return 'bg-amber-500 text-white';
      case 'DISTRICT_OFFICER':
        return 'bg-sky-600 text-white';
      case 'QUALITY_TEAM':
        return 'bg-purple-600 text-white';
      case 'STATE_OFFICE':
        return 'bg-emerald-600 text-white';
      default:
        return 'bg-slate-700 text-white';
    }
  };

  const handleReset = async () => {
    try {
      await api.resetDemoData();
      if (onResetDemo) onResetDemo();
      else window.location.reload();
    } catch {
      window.location.reload();
    }
  };

  return (
    <header className="bg-white/95 backdrop-blur-md border-b border-slate-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          {/* Brand */}
          <div
            className="flex items-center gap-2.5 cursor-pointer select-none"
            onClick={() => setCurrentTab('workflows')}
          >
            <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-xs">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-base tracking-tight text-slate-900">
                CertiFlow
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200/60 font-mono">
                Pragati Skills
              </span>
            </div>
          </div>

          {/* Segmented Pill Navigation */}
          <nav className="flex items-center p-1 bg-slate-100 rounded-xl">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setCurrentTab(item.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{item.label}</span>
                  {item.badge && (
                    <span className="text-[9px] bg-purple-100 text-purple-700 px-1 rounded font-mono font-extrabold">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Right Controls: Live Dot + Persona Avatar + Reset Button */}
          <div className="flex items-center gap-3">
            {/* Live SSE Pulse */}
            <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium" title="Real-time SSE Live Connection">
              <span className={`h-2 w-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
              <span className="text-[11px] font-mono hidden xl:inline">Live</span>
            </div>

            {/* Persona Switcher Pill */}
            {user && (
              <div className="relative flex items-center gap-2 bg-slate-50 border border-slate-200/80 rounded-full pl-1 pr-3 py-1 shadow-2xs hover:border-slate-300 transition-colors">
                <div className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-black ${getRoleColor(user.role)}`}>
                  {getInitials(user.name)}
                </div>
                <div className="text-left">
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-bold text-slate-800 leading-tight">
                      {user.name}
                    </span>
                    <select
                      className="opacity-0 absolute inset-0 cursor-pointer w-full h-full"
                      value={user.id}
                      disabled={loading}
                      onChange={(e) => switchPersona(e.target.value)}
                    >
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name} — {u.role.replace('_', ' ')} {u.districtId ? `(${u.districtId})` : ''}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="h-3 w-3 text-slate-400" />
                  </div>
                  <p className="text-[10px] text-slate-500 leading-none">
                    {user.role.replace('_', ' ')} {user.districtId ? `• ${user.districtId}` : ''}
                  </p>
                </div>
              </div>
            )}

            {/* Reset Demo Data Button */}
            <button
              onClick={handleReset}
              title="Reset test environment to clean demo state"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors text-xs font-medium"
            >
              <RotateCcw className="h-3.5 w-3.5 text-blue-600" />
              <span className="hidden sm:inline">Reset Demo</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
