'use client';
import React, { useState, useEffect } from 'react';
import { Flame, TrendingUp, TrendingDown, RefreshCw, ExternalLink, Zap } from 'lucide-react';

interface FlowSignal {
  ticker: string;
  currentPrice: number;
  strike: number;
  type: 'call' | 'put';
  expiration: string;
  dte: number;
  mark: number;
  premium: number;
  volume: number;
  openInterest: number;
  volumeOIRatio: number;
  iv: number;
  delta: number;
  score: number;
  reasons: string[];
  alertLabel: string;
}

function fmtPremium(p: number): string {
  if (p >= 1_000_000) return `$${(p / 1_000_000).toFixed(1)}M`;
  if (p >= 1_000) return `$${(p / 1_000).toFixed(0)}K`;
  return `$${p.toFixed(0)}`;
}

function fmtVol(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return String(v);
}

function alertStyle(label: string): string {
  switch (label) {
    case 'Golden Sweep':    return 'text-amber-400 bg-amber-500/15 border-amber-500/30';
    case 'Block Trade':     return 'text-indigo-400 bg-indigo-500/15 border-indigo-500/30';
    case 'High Conviction': return 'text-blue-400 bg-blue-500/15 border-blue-500/30';
    case 'Sweep':           return 'text-cyan-400 bg-cyan-500/15 border-cyan-500/30';
    default:                return 'text-slate-400 bg-slate-700/20 border-slate-600/30';
  }
}

function scoreBar(score: number): { width: string; color: string } {
  const pct = Math.min(score, 100);
  const color =
    score >= 80 ? 'bg-amber-400' :
    score >= 60 ? 'bg-blue-400' :
    score >= 40 ? 'bg-emerald-400' :
    'bg-slate-500';
  return { width: `${pct}%`, color };
}

function fmtExp(exp: string): string {
  try {
    const d = new Date(exp + 'T12:00:00Z');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  } catch { return exp; }
}

export function TopFlowFeed({
  onSelectTicker,
}: {
  onSelectTicker?: (ticker: string) => void;
}) {
  const [signals, setSignals] = useState<FlowSignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [scannedAt, setScannedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(t);
  }, []);

  async function fetchSignals(force = false) {
    setLoading(true);
    setError(null);
    try {
      const url = force ? '/api/flow-scan?force=1' : '/api/flow-scan';
      const res = await fetch(url);
      const data = await res.json();
      if (data.error) { setError(data.error); return; }
      setSignals(data.signals ?? []);
      setScannedAt(data.scannedAt ?? null);
    } catch {
      setError('Failed to load flow signals');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchSignals();
    const t = setInterval(() => fetchSignals(), 90_000);
    return () => clearInterval(t);
  }, []);

  const ageSeconds = scannedAt ? Math.floor((now - new Date(scannedAt).getTime()) / 1000) : null;

  return (
    <div className="rounded-2xl border border-slate-700/50 bg-slate-800/20 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-700/40 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-white flex items-center gap-1.5">
            <Flame size={14} className="text-orange-400" />
            Top Conviction Options Flow
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Live sweep & block detection across {10} liquid tickers
            {ageSeconds != null && ` · refreshed ${ageSeconds}s ago`}
          </p>
        </div>
        <button
          onClick={() => fetchSignals(true)}
          className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700 transition-colors"
          title="Force refresh"
        >
          <RefreshCw size={12} className={`text-slate-400 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* What makes a strong buy — collapsible info strip */}
      <details className="group">
        <summary className="px-4 py-2 text-[11px] text-slate-500 cursor-pointer hover:text-slate-300 transition-colors list-none flex items-center gap-1.5">
          <Zap size={10} className="text-amber-400" />
          How strong buy signals are detected
          <span className="ml-auto text-slate-600 group-open:rotate-180 transition-transform">▼</span>
        </summary>
        <div className="px-4 pb-3 text-[11px] text-slate-400 space-y-1 border-b border-slate-800/60">
          <p>Signals require <strong className="text-slate-300">3+ confirming factors</strong> modeled on institutional flow platforms:</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 mt-1.5">
            <span>⚡ Vol/OI &gt; 2× — new positions opening</span>
            <span>💰 Premium &gt;$50K — institutional size</span>
            <span>🎯 Delta 0.25–0.65 — directional bet</span>
            <span>📅 DTE 14–60 days — target timeframe</span>
            <span>📊 Volume &gt;500 contracts — real activity</span>
            <span>📉 IV not extreme — fair entry price</span>
          </div>
          <p className="text-slate-600 mt-1">Score 0–100. Golden Sweeps require Vol/OI ≥10× AND premium ≥$100K.</p>
        </div>
      </details>

      {/* Signals */}
      {loading && (
        <div className="flex items-center justify-center py-10">
          <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!loading && error && (
        <div className="px-4 py-6 text-center">
          <p className="text-xs text-red-400">{error}</p>
          <p className="text-[11px] text-slate-600 mt-1">Schwab API required for live flow data</p>
        </div>
      )}

      {!loading && !error && signals.length === 0 && (
        <div className="px-4 py-8 text-center">
          <p className="text-xs text-slate-500">No high-conviction signals detected right now</p>
          <p className="text-[11px] text-slate-600 mt-1">Market may be quiet or criteria not met</p>
        </div>
      )}

      {!loading && signals.length > 0 && (
        <div className="divide-y divide-slate-800/50">
          {signals.map((s, i) => {
            const bar = scoreBar(s.score);
            return (
              <div key={i} className="px-4 py-3 hover:bg-slate-800/30 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  {/* Left: ticker + contract */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      {/* Ticker */}
                      <button
                        onClick={() => onSelectTicker?.(s.ticker)}
                        className="text-sm font-bold text-white hover:text-blue-400 transition-colors flex items-center gap-1"
                      >
                        {s.ticker}
                        <ExternalLink size={10} className="text-slate-600" />
                      </button>

                      {/* Contract spec */}
                      <span className={`text-xs font-mono font-semibold ${s.type === 'call' ? 'text-emerald-400' : 'text-red-400'}`}>
                        ${s.strike} {s.type.toUpperCase()}
                      </span>
                      <span className="text-xs text-slate-500">
                        {fmtExp(s.expiration)} · {s.dte}d
                      </span>

                      {/* Alert label */}
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${alertStyle(s.alertLabel)}`}>
                        {s.alertLabel}
                      </span>
                    </div>

                    {/* Stats row */}
                    <div className="flex items-center gap-3 text-[11px] text-slate-400 flex-wrap">
                      <span className="text-emerald-400 font-semibold">{fmtPremium(s.premium)}</span>
                      <span>{fmtVol(s.volume)} vol</span>
                      <span>Vol/OI {s.volumeOIRatio}×</span>
                      <span>Δ{s.delta.toFixed(2)}</span>
                      <span>IV {(s.iv * 100).toFixed(0)}%</span>
                    </div>

                    {/* Top 2 reasons */}
                    <div className="mt-1.5 space-y-0.5">
                      {s.reasons.slice(0, 2).map((r, ri) => (
                        <p key={ri} className="text-[11px] text-slate-500">· {r}</p>
                      ))}
                    </div>
                  </div>

                  {/* Right: score */}
                  <div className="flex flex-col items-center gap-1 flex-shrink-0">
                    <span className={`text-base font-bold ${
                      s.score >= 80 ? 'text-amber-400' :
                      s.score >= 60 ? 'text-blue-400' :
                      'text-emerald-400'
                    }`}>{s.score}</span>
                    <span className="text-[9px] text-slate-600 uppercase tracking-wide">score</span>
                    <div className="w-10 h-1 bg-slate-800 rounded-full overflow-hidden">
                      <div className={`h-full ${bar.color} rounded-full`} style={{ width: bar.width }} />
                    </div>
                    <div className="flex items-center gap-0.5">
                      {s.type === 'call'
                        ? <TrendingUp size={9} className="text-emerald-400" />
                        : <TrendingDown size={9} className="text-red-400" />}
                      <span className={`text-[9px] font-semibold ${s.type === 'call' ? 'text-emerald-400' : 'text-red-400'}`}>
                        {s.type.toUpperCase()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && signals.length > 0 && (
        <div className="px-4 py-2 border-t border-slate-800/60">
          <p className="text-[10px] text-slate-600">
            Score based on Vol/OI ratio, premium size, delta, DTE, and IV. Not financial advice.
          </p>
        </div>
      )}
    </div>
  );
}
