'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { TrendingUp, TrendingDown, RefreshCw } from 'lucide-react';

interface ScanResult {
  ticker: string;
  price: number;
  changePct: number;
  volume: number;
  avgVolume: number;
  volRatio: number | null;
  heat: number;
  sector: string;
  direction: 'UP' | 'DOWN' | 'FLAT';
  high52Week: number;
  low52Week: number;
}

interface ScanData {
  results: ScanResult[];
  scannedAt: string;
}

// How close to the 52W extreme to qualify (2% band)
const THRESHOLD = 0.02;

function pctFromHigh(price: number, high: number): number {
  if (!high) return 0;
  return ((price - high) / high) * 100;
}

function pctFromLow(price: number, low: number): number {
  if (!low) return 0;
  return ((price - low) / low) * 100;
}

function buildDescription(r: ScanResult, type: 'HIGH' | 'LOW'): string {
  const parts: string[] = [];
  if (r.volRatio != null && r.volRatio >= 2) parts.push(`${r.volRatio.toFixed(1)}× avg vol`);
  const chg = r.changePct;
  if (Math.abs(chg) >= 1) parts.push(`${chg >= 0 ? '+' : ''}${chg.toFixed(1)}% today`);
  if (r.sector && r.sector !== 'Other') parts.push(`${r.sector} sector`);

  if (type === 'HIGH') {
    if (parts.length === 0) return 'Trading at 52-week high — sustained bullish momentum.';
    return `${parts.join(' · ')} — trading at or near 52-week high.`;
  } else {
    if (parts.length === 0) return 'Trading at 52-week low — extended downtrend.';
    return `${parts.join(' · ')} — trading at or near 52-week low.`;
  }
}

function ExtremeRow({
  r,
  type,
  onClick,
}: {
  r: ScanResult;
  type: 'HIGH' | 'LOW';
  onClick?: (ticker: string) => void;
}) {
  const pct = type === 'HIGH'
    ? pctFromHigh(r.price, r.high52Week)
    : pctFromLow(r.price, r.low52Week);
  const extreme = type === 'HIGH' ? r.high52Week : r.low52Week;
  const isAtExact = Math.abs(pct) < 0.5;

  return (
    <button
      onClick={() => onClick?.(r.ticker)}
      className={`w-full text-left px-3 py-2.5 rounded-xl border transition-all hover:scale-[1.01] ${
        type === 'HIGH'
          ? 'border-emerald-500/20 bg-emerald-500/5 hover:border-emerald-500/35'
          : 'border-red-500/20 bg-red-500/5 hover:border-red-500/35'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-sm font-bold font-mono text-white">{r.ticker}</span>
            {isAtExact && (
              <span className={`text-[9px] font-bold px-1.5 py-0 rounded-full ${
                type === 'HIGH'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'bg-red-500/20 text-red-300 border border-red-500/30'
              }`}>
                {type === 'HIGH' ? '🏆 ATH area' : '⚠️ ATL area'}
              </span>
            )}
            <span className="text-[10px] text-slate-500">{r.sector}</span>
          </div>
          <p className="text-[10px] text-slate-400 leading-tight">{buildDescription(r, type)}</p>
        </div>
        <div className="text-right shrink-0">
          <div className="text-sm font-semibold text-slate-200">${r.price.toFixed(2)}</div>
          <div className={`text-[10px] font-mono ${type === 'HIGH' ? 'text-emerald-400' : 'text-red-400'}`}>
            {type === 'HIGH' ? pct.toFixed(1) : `+${pct.toFixed(1)}`}% from {type === 'HIGH' ? 'high' : 'low'}
          </div>
          <div className="text-[10px] text-slate-600">52W {type === 'HIGH' ? 'H' : 'L'}: ${extreme.toFixed(2)}</div>
        </div>
      </div>
    </button>
  );
}

export function FiftyTwoWeekPanel({ onSelectTicker }: { onSelectTicker?: (ticker: string) => void }) {
  const [data, setData] = useState<ScanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchData = useCallback(async () => {
    setError(false);
    try {
      const res = await fetch('/api/scanner');
      if (!res.ok) throw new Error(`${res.status}`);
      const json: ScanData = await res.json();
      setData(json);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60_000); // 1-min refresh (52W data changes slowly)
    return () => clearInterval(interval);
  }, [fetchData]);

  const { nearHighs, nearLows } = useMemo(() => {
    if (!data) return { nearHighs: [], nearLows: [] };
    const valid = data.results.filter(r => r.high52Week > 0 && r.low52Week > 0 && r.price > 0);

    const nearHighs = valid
      .filter(r => Math.abs(pctFromHigh(r.price, r.high52Week)) <= THRESHOLD * 100)
      .sort((a, b) => Math.abs(pctFromHigh(a.price, a.high52Week)) - Math.abs(pctFromHigh(b.price, b.high52Week)));

    const nearLows = valid
      .filter(r => pctFromLow(r.price, r.low52Week) <= THRESHOLD * 100)
      .sort((a, b) => pctFromLow(a.price, a.low52Week) - pctFromLow(b.price, b.low52Week));

    return { nearHighs, nearLows };
  }, [data]);

  const [tab, setTab] = useState<'HIGH' | 'LOW'>('HIGH');

  return (
    <div className="rounded-2xl border border-slate-700/50 bg-slate-800/20 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-700/40 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-white flex items-center gap-1.5">
            <TrendingUp size={14} className="text-emerald-400" />
            52-Week Extremes
          </h2>
          <p className="text-[10px] text-slate-500 mt-0.5">
            Tickers within 2% of 52-week high or low · Schwab live
          </p>
        </div>
        <button
          onClick={() => { setLoading(true); fetchData(); }}
          className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700 transition-colors"
          title="Refresh"
        >
          <RefreshCw size={12} className={`text-slate-400 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Tab toggle */}
      <div className="px-4 pt-2.5 pb-0 flex items-center gap-2">
        <button
          onClick={() => setTab('HIGH')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
            tab === 'HIGH'
              ? 'bg-emerald-600/20 border-emerald-500/40 text-emerald-300'
              : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
          }`}
        >
          <TrendingUp size={12} />
          52W Highs
          {data && (
            <span className={`ml-1 text-[10px] rounded-full px-1.5 py-0 ${
              tab === 'HIGH' ? 'bg-emerald-500/30 text-emerald-200' : 'bg-slate-700 text-slate-500'
            }`}>
              {nearHighs.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab('LOW')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
            tab === 'LOW'
              ? 'bg-red-600/20 border-red-500/40 text-red-300'
              : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
          }`}
        >
          <TrendingDown size={12} />
          52W Lows
          {data && (
            <span className={`ml-1 text-[10px] rounded-full px-1.5 py-0 ${
              tab === 'LOW' ? 'bg-red-500/30 text-red-200' : 'bg-slate-700 text-slate-500'
            }`}>
              {nearLows.length}
            </span>
          )}
        </button>
      </div>

      {/* Content */}
      <div className="p-3 space-y-2">
        {loading && !data && (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="p-3 rounded-xl border border-slate-700/30 bg-slate-800/20 animate-pulse h-14" />
          ))
        )}

        {error && (
          <div className="px-4 py-6 text-center">
            <p className="text-xs text-red-400">Unable to load 52-week data</p>
            <p className="text-[11px] text-slate-600 mt-1">Schwab API required</p>
          </div>
        )}

        {data && !loading && tab === 'HIGH' && (
          nearHighs.length === 0
            ? <p className="text-xs text-slate-500 text-center py-4">No tickers within 2% of 52W high right now</p>
            : nearHighs.map(r => (
                <ExtremeRow key={r.ticker} r={r} type="HIGH" onClick={onSelectTicker} />
              ))
        )}

        {data && !loading && tab === 'LOW' && (
          nearLows.length === 0
            ? <p className="text-xs text-slate-500 text-center py-4">No tickers within 2% of 52W low right now</p>
            : nearLows.map(r => (
                <ExtremeRow key={r.ticker} r={r} type="LOW" onClick={onSelectTicker} />
              ))
        )}
      </div>

      {/* Footer note */}
      {data && (
        <div className="px-4 py-2 border-t border-slate-800/60">
          <p className="text-[10px] text-slate-600">
            52W data from Schwab · All-time highs/lows not available via market data API · Tap to analyze
          </p>
        </div>
      )}
    </div>
  );
}
