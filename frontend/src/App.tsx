import React, { useState } from 'react';
import { Navbar } from './components/Navbar';
import { DashboardView } from './components/DashboardView';
import { AIAgentHub } from './components/AIAgentHub';
import { WhatsAppPhoneMockup } from './components/WhatsAppPhoneMockup';
import { PublicVerifyView } from './components/PublicVerifyView';
import { api } from './api';
import { useAuth } from './context/AuthContext';
import { Batch } from './types';

type Tab = 'workflows' | 'ai-agent' | 'whatsapp' | 'verify';

export default function App() {
  const [currentTab, setCurrentTab] = useState<Tab>(() => {
    if (typeof window !== 'undefined') {
      const path = window.location.pathname;
      const params = new URLSearchParams(window.location.search);
      if (path.includes('/verify') || params.has('cert')) {
        return 'verify';
      }
    }
    return 'workflows';
  });
  const [batches, setBatches] = useState<Batch[]>([]);
  const { token } = useAuth();

  const handleOpenBatchDetail = (batch: Batch) => {
    setCurrentTab('workflows');
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans">
      <Navbar currentTab={currentTab} setCurrentTab={setCurrentTab} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {currentTab === 'workflows' && (
          <DashboardView onBatchesLoaded={(b) => setBatches(b)} />
        )}
        {currentTab === 'ai-agent' && (
          <AIAgentHub batches={batches} onOpenBatchDetail={handleOpenBatchDetail} />
        )}
        {currentTab === 'whatsapp' && <WhatsAppPhoneMockup />}
        {currentTab === 'verify' && <PublicVerifyView />}
      </main>
    </div>
  );
}
