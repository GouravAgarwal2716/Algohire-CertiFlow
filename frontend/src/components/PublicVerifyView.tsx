import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { LoadingSpinner } from './ui';
import { ShieldCheck, ShieldX, Search, ExternalLink } from 'lucide-react';

export const PublicVerifyView: React.FC = () => {
  const [certNumber, setCertNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [notFound, setNotFound] = useState(false);

  // Pre-fill with seed certificate for demo
  const demoNumbers = ['PSM-2026-HYD001', 'PSM-2026-HYD002', 'PSM-2026-HYD003'];

  // Check URL path or query params for auto-verification from QR code scans
  useEffect(() => {
    let target = '';
    const pathParts = window.location.pathname.split('/');
    const verifyIdx = pathParts.indexOf('verify');
    if (verifyIdx !== -1 && pathParts[verifyIdx + 1]) {
      target = decodeURIComponent(pathParts[verifyIdx + 1]);
    } else {
      const searchParams = new URLSearchParams(window.location.search);
      if (searchParams.get('cert')) target = searchParams.get('cert')!;
    }

    if (target) {
      setCertNumber(target.toUpperCase());
      verify(target);
    }
  }, []);

  const verify = async (num: string) => {
    const target = num.trim().toUpperCase();
    if (!target) return;
    setLoading(true);
    setResult(null);
    setNotFound(false);
    try {
      const res = await api.verifyPublicly(target);
      if (res.status === 404) {
        setNotFound(true);
      } else {
        setResult(res.data);
      }
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); verify(certNumber); };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center">
        <div className="inline-flex h-16 w-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-700 items-center justify-center mx-auto mb-4 shadow-lg">
          <ShieldCheck className="h-8 w-8 text-white" />
        </div>
        <h1 className="text-3xl font-extrabold text-slate-900">Certificate Verification</h1>
        <p className="mt-2 text-slate-500 text-lg">
          Verify the authenticity of any Pragati Skills Mission certificate
        </p>
        <p className="mt-1 text-sm text-slate-400">No login required. Available 24/7 for employers and the public.</p>
      </div>

      {/* Search Form */}
      <form onSubmit={handleSubmit} className="card p-6 shadow-md space-y-4">
        <label className="block text-sm font-semibold text-slate-700">Enter Certificate Number</label>
        <div className="flex gap-3">
          <input
            type="text"
            className="input flex-1 text-base font-mono uppercase"
            placeholder="e.g., PSM-2026-HYD001"
            value={certNumber}
            onChange={(e) => setCertNumber(e.target.value.toUpperCase())}
            autoFocus
          />
          <button type="submit" disabled={loading || !certNumber.trim()} className="btn-primary flex items-center gap-2 px-6">
            {loading ? <LoadingSpinner size="sm" /> : <Search className="h-4 w-4" />}
            Verify
          </button>
        </div>
        <div className="flex gap-2 flex-wrap">
          <span className="text-xs text-slate-400">Try demo certificates:</span>
          {demoNumbers.map((n) => (
            <button key={n} type="button" onClick={() => { setCertNumber(n); verify(n); }}
              className="text-xs font-mono text-blue-600 hover:text-blue-800 underline">
              {n}
            </button>
          ))}
        </div>
      </form>

      {/* Not Found */}
      {notFound && (
        <div className="card p-8 text-center border-red-200">
          <ShieldX className="h-14 w-14 text-red-300 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-red-700">Certificate Not Found</h2>
          <p className="text-sm text-slate-500 mt-2">
            The certificate number <strong className="font-mono">{certNumber}</strong> does not exist in the official Pragati Skills Mission registry.
          </p>
          <p className="text-xs text-slate-400 mt-2">If you believe this is an error, contact the district certification office.</p>
        </div>
      )}

      {/* Result */}
      {result && result.certificate && (
        <div className={`card shadow-md overflow-hidden ${result.valid ? 'border-emerald-300' : 'border-red-300'}`}>
          {/* Status Header */}
          <div className={`p-6 ${result.valid ? 'bg-gradient-to-r from-emerald-500 to-teal-600' : 'bg-gradient-to-r from-red-500 to-rose-600'}`}>
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 bg-white/20 rounded-full flex items-center justify-center">
                {result.valid
                  ? <ShieldCheck className="h-8 w-8 text-white" />
                  : <ShieldX className="h-8 w-8 text-white" />
                }
              </div>
              <div>
                <p className="text-sm font-semibold text-white/80 uppercase tracking-wide">
                  {result.valid ? 'Verified & Authentic' : 'Certificate Revoked'}
                </p>
                <h2 className="text-2xl font-extrabold text-white">
                  {result.valid ? '✓ VALID' : '✗ REVOKED'}
                </h2>
                <p className="text-sm text-white/70 font-mono mt-1">{result.certificate.certificateNumber}</p>
              </div>
            </div>
          </div>

          {/* Details */}
          <div className="p-6 space-y-4">
            <dl className="grid grid-cols-2 gap-4">
              {[
                { label: 'Candidate Name', value: result.certificate.candidateName },
                { label: 'Course', value: result.certificate.courseName },
                { label: 'Training Centre', value: result.certificate.centreName },
                { label: 'District', value: result.certificate.district },
                { label: 'Issued On', value: new Date(result.certificate.issuedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) },
                { label: 'Status', value: result.certificate.status },
              ].map((item) => (
                <div key={item.label}>
                  <dt className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{item.label}</dt>
                  <dd className={`mt-0.5 text-sm font-semibold ${item.label === 'Status' ? (result.valid ? 'text-emerald-700' : 'text-red-700') : 'text-slate-900'}`}>
                    {item.value}
                  </dd>
                </div>
              ))}
            </dl>

            {!result.valid && (
              <div className="bg-red-50 border border-red-100 rounded-lg p-4">
                <p className="text-sm font-semibold text-red-800">Revocation Details</p>
                {result.certificate.revokedAt && (
                  <p className="text-xs text-red-600 mt-1">Revoked on: {new Date(result.certificate.revokedAt).toLocaleString()}</p>
                )}
                {result.certificate.revocationReason && (
                  <p className="text-xs text-red-700 mt-1 italic">Reason: {result.certificate.revocationReason}</p>
                )}
              </div>
            )}

            <div className="border-t border-slate-100 pt-4 flex items-center gap-2">
              <div className="h-2.5 w-2.5 bg-blue-500 rounded-full" />
              <p className="text-xs text-slate-400">
                This certificate is registered in the official Pragati Skills Mission government registry.
                Contact the State Certifications Office if you have concerns.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
