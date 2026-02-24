'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';

interface ScanResult {
  ticker: string;
  price: number;
  change: number;
  changePct: number;
  volume: number;
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

function HeatBar({ heat }: { heat: number }) {
  const color = heat >= 70 ? 'bg-red-400' : heat >= 40 ? 'bg-amber-400' : 'bg-emerald-400';
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex-1 h-1 bg-slate-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${heat}%` }} />
      </div>
      <span className={`text-xs font-bold w-6 text-right ${heat >= 70 ? 'text-red-400' : heat >= 40 ? 'text-amber-400' : 'text-emerald-400'}`}>
        {heat}
      </span>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="p-3 rounded-xl border border-slate-700/30 bg-slate-800/20 animate-pulse space-y-2">
      <div className="h-3 bg-slate-700/60 rounded w-12" />
      <div className="h-4 bg-slate-700/40 rounded w-20" />
      <div className="h-1.5 bg-slate-700/40 rounded w-full" />
    </div>
  );
}

export function ScannerFeed({ onSelectTicker }: { onSelectTicker?: (ticker: string) => void }) {
  const [data, setData] = useState<ScanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    setError(false);
    try {
      const res = await fetch('/api/scanner');
      if (!res.ok) throw new Error(`${res.status}`);
      const json: ScanData = await res.json();
      setData(json);
      setLastUpdated(new Date());
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

  function timeAgo(d: Date): string {
    const s = Math.round((Date.now() - d.getTime()) / 1000);
    if (s < 60) return `${s}s ago`;
    return `${Math.floor(s / 60)}m ago`;
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">Market Scanner</h2>
        <div className="flex items-center gap-2">
          {lastUpdated && (
            <span className="text-xs text-slate-500">Updated {timeAgo(lastUpdated)}</span>
          )}
          <button
            onClick={fetchData}
            disabled={loading}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/50 transition-all"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/5 text-sm text-red-400">
          Scanner unavailable — check Schwab API credentials.
        </div>
      )}

      {/* Ticker grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
        {loading && !data && Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}

        {data?.results.map(r => (
          <button
            key={r.ticker}
            onClick={() => onSelectTicker?.(r.ticker)}
            className={`p-3 rounded-xl border text-left transition-all hover:scale-[1.02] ${
              r.direction === 'UP'
                ? 'border-emerald-500/25 bg-emerald-500/5 hover:border-emerald-500/40'
                : r.direction === 'DOWN'
                ? 'border-red-500/25 bg-red-500/5 hover:border-red-500/40'
                : 'border-slate-700/40 bg-slate-800/20 hover:border-slate-600/60'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-bold font-mono text-white">{r.ticker}</span>
              <span className="text-xs text-slate-500">{r.sector}</span>
            </div>
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-sm font-semibold text-slate-200">${r.price.toFixed(2)}</span>
              <span className={`text-xs font-bold ${r.direction === 'UP' ? 'text-emerald-400' : r.direction === 'DOWN' ? 'text-red-400' : 'text-slate-400'}`}>
                {r.changePct >= 0 ? '+' : ''}{r.changePct.toFixed(2)}%
              </span>
            </div>
            <HeatBar heat={r.heat} />
          </button>
        ))}
      </div>
    </div>
  );
}
