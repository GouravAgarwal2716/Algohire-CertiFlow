import React, { useState, useEffect } from 'react';
import { WhatsAppMessage } from '../types';
import { api } from '../api';
import { LoadingSpinner } from './ui';
import {
  MessageSquare,
  Download,
  RefreshCw,
  Wifi,
  Send,
  Phone,
  Video,
  MoreVertical,
  CheckCheck,
  Smartphone
} from 'lucide-react';

export const WhatsAppPhoneMockup: React.FC = () => {
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeMessageIndex, setActiveMessageIndex] = useState(0);
  const [chaos, setChaos] = useState({ failRate: 0, timeoutRate: 0 });
  const [chaosLoading, setChaosLoading] = useState(false);
  const [chaosSuccess, setChaosSuccess] = useState('');

  const loadMessages = async () => {
    try {
      const msgs = await api.getWhatsAppMessages();
      setMessages(msgs);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMessages();
    const interval = setInterval(loadMessages, 4000);
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

  const activeMsg = messages[activeMessageIndex] || messages[0];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <span className="p-2 rounded-xl bg-emerald-100 text-emerald-700">
              <MessageSquare className="h-6 w-6" />
            </span>
            Candidate WhatsApp Delivery Simulator
          </h1>
          <p className="text-slate-500 text-xs mt-1">
            Simulates real-world delivery to candidates' smartphones via the WhatsApp Business API
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadMessages}
            disabled={loading}
            className="btn-secondary text-xs flex items-center gap-1.5 py-2 px-3"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh Feed
          </button>
        </div>
      </div>

      {/* Chaos Engineering Banner */}
      <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Wifi className="h-4 w-4 text-amber-700" />
            <h3 className="font-bold text-amber-900 text-sm">WhatsApp Network Chaos Simulator</h3>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-200 text-amber-800">
              LIVE RESILIENCE DEMO
            </span>
          </div>
          {chaosSuccess && <span className="text-xs font-bold text-emerald-700">{chaosSuccess}</span>}
        </div>
        <p className="text-xs text-amber-800/80 leading-relaxed">
          Inject packet loss or gateway timeouts into the mock provider. Watch BullMQ automatically
          retry with exponential backoff and guarantee exactly-once delivery.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
          <div>
            <div className="flex justify-between text-xs font-bold text-amber-900 mb-1">
              <span>Failure Rate</span>
              <span>{Math.round(chaos.failRate * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="0.8"
              step="0.05"
              value={chaos.failRate}
              onChange={(e) => setChaos({ ...chaos, failRate: parseFloat(e.target.value) })}
              className="w-full accent-amber-600 cursor-pointer"
            />
          </div>
          <div>
            <div className="flex justify-between text-xs font-bold text-amber-900 mb-1">
              <span>Timeout Rate</span>
              <span>{Math.round(chaos.timeoutRate * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="0.8"
              step="0.05"
              value={chaos.timeoutRate}
              onChange={(e) => setChaos({ ...chaos, timeoutRate: parseFloat(e.target.value) })}
              className="w-full accent-amber-600 cursor-pointer"
            />
          </div>
        </div>

        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={updateChaos}
            disabled={chaosLoading}
            className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-4 py-1.5 rounded-lg transition-colors"
          >
            Apply Chaos
          </button>
          <button
            onClick={() => {
              setChaos({ failRate: 0, timeoutRate: 0 });
            }}
            className="text-xs font-semibold text-amber-700 underline"
          >
            Reset to 0% (Reliable)
          </button>
        </div>
      </div>

      {/* Main Grid: Candidate Phone Mockup + Delivery Stream */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Smartphone Simulator */}
        <div className="lg:col-span-5 flex justify-center">
          <div className="w-full max-w-[340px] bg-slate-900 rounded-[44px] p-3 shadow-2xl border-4 border-slate-800 relative">
            {/* Speaker & Camera notch */}
            <div className="absolute top-5 left-1/2 -translate-x-1/2 w-28 h-4 bg-black rounded-full z-20 flex items-center justify-center">
              <div className="w-3 h-3 bg-slate-900 rounded-full mr-2" />
              <div className="w-2 h-2 bg-slate-800 rounded-full" />
            </div>

            {/* Smartphone Screen */}
            <div className="bg-[#efeae2] rounded-[36px] overflow-hidden min-h-[520px] flex flex-col relative text-slate-800">
              {/* WhatsApp App Header */}
              <div className="bg-[#075e54] text-white pt-8 pb-3 px-3 shadow-md flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-full bg-emerald-300 flex items-center justify-center text-[#075e54] font-black text-sm">
                    PSM
                  </div>
                  <div>
                    <h4 className="text-xs font-bold leading-tight flex items-center gap-1">
                      Pragati Skills Mission
                      <span className="text-[10px] bg-emerald-600 px-1 rounded text-white font-mono">
                        ✓
                      </span>
                    </h4>
                    <p className="text-[10px] text-emerald-200">Official Government Account</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-emerald-100">
                  <Video className="h-4 w-4" />
                  <Phone className="h-4 w-4" />
                  <MoreVertical className="h-4 w-4" />
                </div>
              </div>

              {/* Chat Message Canvas */}
              <div className="flex-1 p-3 space-y-3 overflow-y-auto bg-[radial-gradient(#e5ddd5_1px,transparent_1px)] [background-size:16px_16px]">
                <div className="text-center my-2">
                  <span className="bg-[#dcf8c6] text-emerald-900 text-[10px] px-2 py-0.5 rounded-md font-mono shadow-xs">
                    Today
                  </span>
                </div>

                {activeMsg ? (
                  <div className="max-w-[88%] bg-white rounded-2xl rounded-tl-xs p-3 shadow-sm border border-slate-200/50 space-y-2">
                    <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-1.5">
                      <span className="text-[10px] font-bold text-emerald-700 font-mono">
                        +91 {activeMsg.to}
                      </span>
                      {activeMsg.certificateNumber && (
                        <span className="text-[9px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-mono font-semibold">
                          {activeMsg.certificateNumber}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-700 leading-relaxed">{activeMsg.message}</p>
                    {activeMsg.downloadUrl && (
                      <div className="pt-1">
                        <a
                          href={activeMsg.downloadUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full bg-[#25d366] hover:bg-[#20ba5a] text-white text-xs font-bold py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition-all"
                        >
                          <Download className="h-3.5 w-3.5" />
                          Download Verified PDF
                        </a>
                      </div>
                    )}
                    <div className="flex items-center justify-end gap-1 text-[9px] text-slate-400">
                      <span>{new Date(activeMsg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      <CheckCheck className="h-3.5 w-3.5 text-blue-500" />
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-16 text-slate-400 text-xs">
                    No messages delivered yet. Approve a batch to see WhatsApp messages appear here.
                  </div>
                )}
              </div>

              {/* Chat Input Bar (Decorative) */}
              <div className="bg-[#f0f0f0] p-2 flex items-center gap-2 border-t border-slate-200">
                <div className="flex-1 bg-white rounded-full px-3 py-1.5 text-xs text-slate-400">
                  Message Pragati Skills Mission...
                </div>
                <div className="w-8 h-8 rounded-full bg-[#075e54] flex items-center justify-center text-white">
                  <Send className="h-3.5 w-3.5" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Delivered Messages Stream */}
        <div className="lg:col-span-7 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
              <Smartphone className="h-4 w-4 text-emerald-600" />
              Delivered Dispatch Feed ({messages.length})
            </h3>
            <span className="text-xs text-slate-400 font-mono">Real-time mock stream</span>
          </div>

          {messages.length === 0 ? (
            <div className="card p-8 text-center text-slate-400 text-sm">
              <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-30 text-emerald-500" />
              No dispatched WhatsApp credentials recorded yet.
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[540px] overflow-y-auto pr-1">
              {messages.map((m, idx) => (
                <div
                  key={m.id}
                  onClick={() => setActiveMessageIndex(idx)}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                    activeMessageIndex === idx
                      ? 'bg-emerald-50/80 border-emerald-300 shadow-sm'
                      : 'bg-white hover:bg-slate-50 border-slate-200/80'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-slate-900">+91 {m.to}</span>
                      {m.certificateNumber && (
                        <span className="font-mono text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-semibold">
                          {m.certificateNumber}
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-400 font-mono">
                      {new Date(m.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1 line-clamp-1">{m.message}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
