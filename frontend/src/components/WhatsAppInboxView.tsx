import React, { useState, useEffect } from 'react';
import { WhatsAppMessage } from '../types';
import { api } from '../api';
import { LoadingSpinner } from './ui';
import { MessageSquare, Download, RefreshCw, Wifi } from 'lucide-react';

export const WhatsAppInboxView: React.FC = () => {
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [chaos, setChaos] = useState({ failRate: 0, timeoutRate: 0 });
  const [chaosLoading, setChaosLoading] = useState(false);
  const [chaosSuccess, setChaosSuccess] = useState('');

  const loadMessages = async () => {
    setLoading(true);
    try {
      const msgs = await api.getWhatsAppMessages();
      setMessages(msgs);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMessages();
    const interval = setInterval(loadMessages, 5000);
    return () => clearInterval(interval);
  }, []);

  const updateChaos = async () => {
    setChaosLoading(true);
    try {
      const res = await fetch('http://localhost:3001/chaos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ failRate: chaos.failRate, timeoutRate: chaos.timeoutRate, timeoutMs: 2000 }),
      });
      if (res.ok) {
        setChaosSuccess('Chaos configuration updated!');
        setTimeout(() => setChaosSuccess(''), 3000);
      }
    } finally {
      setChaosLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <MessageSquare className="h-6 w-6 text-emerald-500" />
            Candidate WhatsApp Inbox
          </h1>
          <p className="text-slate-500 mt-1 text-sm">
            {messages.length} message{messages.length !== 1 ? 's' : ''} delivered via Mock WhatsApp API
          </p>
        </div>
        <button onClick={loadMessages} disabled={loading} className="btn-secondary flex items-center gap-2 text-sm">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {/* Chaos Engineering Panel */}
      <div className="card p-5 border-amber-200 bg-amber-50/50">
        <div className="flex items-center gap-2 mb-4">
          <Wifi className="h-5 w-5 text-amber-600" />
          <h3 className="font-bold text-amber-900">Chaos Engineering Controls</h3>
          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold">LIVE DEMO FEATURE</span>
        </div>
        <p className="text-xs text-amber-700 mb-4">
          Simulate real-world WhatsApp API unreliability. BullMQ will automatically retry failed jobs with exponential backoff.
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-amber-800 block mb-1">
              Failure Rate: <strong>{Math.round(chaos.failRate * 100)}%</strong>
            </label>
            <input type="range" min="0" max="1" step="0.05" value={chaos.failRate}
              onChange={(e) => setChaos({ ...chaos, failRate: parseFloat(e.target.value) })}
              className="w-full accent-amber-500" />
          </div>
          <div>
            <label className="text-xs font-semibold text-amber-800 block mb-1">
              Timeout Rate: <strong>{Math.round(chaos.timeoutRate * 100)}%</strong>
            </label>
            <input type="range" min="0" max="1" step="0.05" value={chaos.timeoutRate}
              onChange={(e) => setChaos({ ...chaos, timeoutRate: parseFloat(e.target.value) })}
              className="w-full accent-amber-500" />
          </div>
        </div>
        <div className="flex items-center gap-3 mt-3">
          <button onClick={updateChaos} disabled={chaosLoading} className="bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
            Apply Chaos Config
          </button>
          <button onClick={() => { setChaos({ failRate: 0, timeoutRate: 0 }); }} className="text-sm text-amber-700 underline">Reset to 0%</button>
          {chaosSuccess && <span className="text-sm text-emerald-700 font-semibold">{chaosSuccess}</span>}
        </div>
      </div>

      {/* Messages Feed */}
      {loading && messages.length === 0 ? (
        <div className="flex justify-center py-16"><LoadingSpinner size="lg" /></div>
      ) : messages.length === 0 ? (
        <div className="card p-12 text-center">
          <MessageSquare className="h-12 w-12 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No messages yet</p>
          <p className="text-sm text-slate-400">Messages appear here when batches are approved and certificates are issued.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {messages.map((msg) => (
            <div key={msg.id} className="card p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start gap-3">
                {/* WhatsApp icon */}
                <div className="h-10 w-10 rounded-full bg-emerald-500 flex items-center justify-center text-white text-lg flex-shrink-0">
                  💬
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900 text-sm">+91 {msg.to}</span>
                      {msg.certificateNumber && (
                        <span className="font-mono text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full border border-blue-100">
                          {msg.certificateNumber}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-slate-400">{new Date(msg.timestamp).toLocaleString()}</span>
                  </div>
                  <p className="text-sm text-slate-600 mt-1 leading-relaxed line-clamp-2">{msg.message}</p>
                  {msg.downloadUrl && (
                    <a
                      href={msg.downloadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 mt-2 text-xs font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 px-3 py-1.5 rounded-full border border-blue-100 hover:bg-blue-100 transition-colors"
                    >
                      <Download className="h-3.5 w-3.5" /> Open Certificate PDF
                    </a>
                  )}
                  {msg.idempotencyKey && (
                    <p className="mt-1 text-xs text-slate-300 font-mono">key: {msg.idempotencyKey.slice(0, 16)}...</p>
                  )}
                </div>
                <span className="text-emerald-500 text-lg flex-shrink-0">✓✓</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
