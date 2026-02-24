'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { Activity, RefreshCw, TrendingUp, TrendingDown, Minus, Zap } from 'lucide-react';

interface ScanResult {
  ticker: string;
  price: number;
  change: number;
  changePct: number;
  volume: number;
  avgVolume: number;
  volRatio: number | null;
  heat: number;
  sector: string;
  direction: 'UP' | 'DOWN' | 'FLAT';
}

interface ScanData {
  results: ScanResult[];
  sectorMap: Record<string, { tickers: string[]; avgHeat: number; bullCount: number; bearCount: number }>;
  scannedAt: string;
  count: number;
}

function fmtVol(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return String(v);
}

export function ScannerFeed({ onSelectTicker }: { onSelectTicker?: (ticker: string) => void }) {
  const [data, setData] = useState<ScanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [scannedAt, setScannedAt] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  // Live age counter
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(t);
  }, []);

  const fetchData = useCallback(async () => {
    setError(false);
    try {
      const res = await fetch('/api/scanner');
      if (!res.ok) throw new Error(`${res.status}`);
      const json: ScanData = await res.json();
      setData(json);
      setScannedAt(json.scannedAt);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const ageSeconds = scannedAt ? Math.floor((now - new Date(scannedAt).getTime()) / 1000) : null;
  const gainers = data?.results.filter(r => r.direction === 'UP') ?? [];
  const losers = data?.results.filter(r => r.direction === 'DOWN') ?? [];
  const flat = data?.results.filter(r => r.direction === 'FLAT') ?? [];
  const hottestSector = data
    ? Object.entries(data.sectorMap).sort(([, a], [, b]) => b.avgHeat - a.avgHeat)[0]?.[0]
    : null;

  return (
    <div className="rounded-2xl border border-slate-700/50 bg-slate-800/20 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-700/40 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-white flex items-center gap-1.5">
            <Activity size={14} className="text-blue-400" />
            Market Momentum Scanner
          </h2>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border font-medium text-emerald-400 bg-emerald-500/10 border-emerald-500/20">
              ✓ Schwab Live
            </span>
            {ageSeconds != null && (
              <p className="text-xs text-slate-500">refreshed {ageSeconds}s ago</p>
            )}
          </div>
        </div>
        <button
          onClick={() => { setLoading(true); fetchData(); }}
          className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700 transition-colors"
          title="Refresh"
        >
          <RefreshCw size={12} className={`text-slate-400 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* What is the heat score? */}
      <details className="group">
        <summary className="px-4 py-2 text-[11px] text-slate-500 cursor-pointer hover:text-slate-300 transition-colors list-none flex items-center gap-1.5">
          <Zap size={10} className="text-blue-400" />
          How the heat score works
          <span className="ml-auto text-slate-600 group-open:rotate-180 transition-transform">▼</span>
        </summary>
        <div className="px-4 pb-3 text-[11px] text-slate-400 space-y-1 border-b border-slate-800/60">
          <p>Heat (0–100) combines <strong className="text-slate-300">price momentum + volume surge</strong> into one number:</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 mt-1.5">
            <span>📈 % Change — up to 60 pts (5% move = max)</span>
            <span>📊 Vol / 10d Avg — up to 40 pts (3× avg = max)</span>
          </div>
          <div className="flex items-center gap-4 mt-1.5">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" /> 70+ Hot</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> 40–69 Warm</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" /> 0–39 Cool</span>
          </div>
          <p className="text-slate-600 mt-1">High heat = strong price move + unusual volume = potential options opportunity. Click any ticker to analyze its options chain.</p>
        </div>
      </details>

      {/* Summary bar */}
      {data && !loading && (
        <div className="px-4 py-2 border-b border-slate-800/40 flex items-center gap-4 flex-wrap">
          <span className="flex items-center gap-1 text-[11px]">
            <TrendingUp size={11} className="text-emerald-400" />
            <span className="text-emerald-400 font-semibold">{gainers.length}</span>
            <span className="text-slate-500">gainers</span>
          </span>
          <span className="flex items-center gap-1 text-[11px]">
            <TrendingDown size={11} className="text-red-400" />
            <span className="text-red-400 font-semibold">{losers.length}</span>
            <span className="text-slate-500">losing</span>
          </span>
          <span className="flex items-center gap-1 text-[11px]">
            <Minus size={11} className="text-slate-500" />
            <span className="text-slate-400 font-semibold">{flat.length}</span>
            <span className="text-slate-500">flat</span>
          </span>
          {hottestSector && (
            <span className="ml-auto text-[11px] text-slate-500">
              Hottest sector: <span className="text-amber-400 font-semibold">{hottestSector}</span>
            </span>
          )}
        </div>
      )}

      {/* Loading state */}
      {loading && !data && (
        <div className="p-3 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="p-3 rounded-xl border border-slate-700/30 bg-slate-800/20 animate-pulse space-y-2">
              <div className="h-3 bg-slate-700/60 rounded w-12" />
              <div className="h-4 bg-slate-700/40 rounded w-20" />
              <div className="h-1.5 bg-slate-700/40 rounded w-full" />
            </div>
          ))}
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="px-4 py-6 text-center">
          <p className="text-xs text-red-400">Scanner unavailable</p>
          <p className="text-[11px] text-slate-600 mt-1">Schwab API required for live market data</p>
        </div>
      )}

      {/* Ticker grid — sorted by heat score descending */}
      {data && (
        <div className="p-3 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
          {data.results.map((r, i) => {
            const heat = r.heat;
            const heatColor = heat >= 70 ? 'bg-red-400' : heat >= 40 ? 'bg-amber-400' : 'bg-emerald-400';
            const heatText = heat >= 70 ? 'text-red-400' : heat >= 40 ? 'text-amber-400' : 'text-emerald-400';
            const isHottest = i === 0;
            const volHot = r.volRatio != null && r.volRatio >= 1.5;

            return (
              <button
                key={r.ticker}
                onClick={() => onSelectTicker?.(r.ticker)}
                className={`p-3 rounded-xl border text-left transition-all hover:scale-[1.02] active:scale-[0.99] ${
                  r.direction === 'UP'
                    ? 'border-emerald-500/25 bg-emerald-500/5 hover:border-emerald-500/40'
                    : r.direction === 'DOWN'
                    ? 'border-red-500/25 bg-red-500/5 hover:border-red-500/40'
                    : 'border-slate-700/40 bg-slate-800/20 hover:border-slate-600/60'
                }`}
              >
                {/* Ticker + sector */}
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1">
                    <span className="text-sm font-bold font-mono text-white">{r.ticker}</span>
                    {isHottest && <span className="text-[10px]">🔥</span>}
                  </div>
                  <span className="text-[10px] text-slate-500">{r.sector}</span>
                </div>

                {/* Price + % change */}
                <div className="flex items-baseline gap-2 mb-1.5">
                  <span className="text-sm font-semibold text-slate-200">${r.price.toFixed(2)}</span>
                  <span className={`text-xs font-bold ${
                    r.direction === 'UP' ? 'text-emerald-400' :
                    r.direction === 'DOWN' ? 'text-red-400' :
                    'text-slate-400'
                  }`}>
                    {r.changePct >= 0 ? '+' : ''}{r.changePct.toFixed(2)}%
                  </span>
                </div>

                {/* Volume vs average */}
                <div className="text-[10px] text-slate-500 mb-1.5">
                  {r.volRatio != null ? (
                    <>
                      Vol:{' '}
                      <span className={volHot ? 'text-amber-400 font-semibold' : 'text-slate-400'}>
                        {r.volRatio.toFixed(1)}× avg
                      </span>
                      {' '}· {fmtVol(r.volume)}
                    </>
                  ) : (
                    <span>{fmtVol(r.volume)} vol</span>
                  )}
                </div>

                {/* Heat bar */}
                <div className="flex items-center gap-1.5">
                  <div className="flex-1 h-1 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${heatColor}`}
                      style={{ width: `${heat}%` }}
                    />
                  </div>
                  <span className={`text-[10px] font-bold w-5 text-right ${heatText}`}>{heat}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Footer */}
      {data && (
        <div className="px-4 py-2 border-t border-slate-800/60">
          <p className="text-[10px] text-slate-600">
            Sorted by heat score · Tap any ticker to analyze its options chain · Auto-refreshes every 30s
          </p>
        </div>
      )}
    </div>
  );
}
