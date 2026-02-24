'use client';
import React from 'react';
import { Flame, TrendingUp, TrendingDown, Zap } from 'lucide-react';

interface Contract {
  volume?: number;
  isUnusual?: boolean;
  unusualScore?: number;
  volumeOIRatio?: number;
  type?: string;
}

interface ExpStats {
  exp: string;
  callVol: number;
  putVol: number;
  totalVol: number;
  unusualCount: number;
  heatScore: number;
  callPct: number; // 0–100
}

function computeExpStats(
  expirations: string[],
  byExpiration: Record<string, { calls: Contract[]; puts: Contract[] }>,
): ExpStats[] {
  return expirations.map(exp => {
    const { calls = [], puts = [] } = byExpiration[exp] ?? {};
    const callVol = calls.reduce((s, c) => s + (c.volume || 0), 0);
    const putVol = puts.reduce((s, p) => s + (p.volume || 0), 0);
    const totalVol = callVol + putVol;

    const allContracts = [...calls, ...puts];
    const unusualContracts = allContracts.filter(
      c => c.isUnusual || (c.unusualScore ?? 0) > 50 || (c.volumeOIRatio ?? 0) > 2,
    );
    const unusualCount = unusualContracts.length;

    const activeContracts = allContracts.filter(c => (c.volume || 0) > 0);
    const avgVolOI =
      activeContracts.length > 0
        ? activeContracts.reduce((s, c) => s + (c.volumeOIRatio || 0), 0) / activeContracts.length
        : 0;

    const heatScore = unusualCount * 15 + avgVolOI * 5 + Math.min(totalVol / 200, 15);
    const callPct = totalVol > 0 ? (callVol / totalVol) * 100 : 50;

    return { exp, callVol, putVol, totalVol, unusualCount, heatScore, callPct };
  });
}

function fmtVol(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return String(v);
}

function fmtExp(exp: string): string {
  // "2026-03-21" → "Mar 21"
  try {
    const d = new Date(exp + 'T12:00:00Z');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  } catch {
    return exp;
  }
}

export function ExpirationFlowBar({
  expirations,
  byExpiration,
  selectedExp,
  onSelect,
}: {
  expirations: string[];
  byExpiration: Record<string, { calls: any[]; puts: any[] }>;
  selectedExp: string;
  onSelect: (exp: string) => void;
}) {
  if (!expirations || expirations.length === 0) return null;

  const stats = computeExpStats(expirations, byExpiration);
  const maxHeat = Math.max(...stats.map(s => s.heatScore), 1);
  const hottestIdx = stats.reduce(
    (bestIdx, s, i) => (s.heatScore > stats[bestIdx].heatScore ? i : bestIdx),
    0,
  );
  const hottest = stats[hottestIdx];
  const hasUnusual = stats.some(s => s.unusualCount > 0);

  return (
    <div className="rounded-2xl border border-slate-700/50 bg-slate-800/20 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-700/30 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white flex items-center gap-1.5">
            <Flame size={13} className="text-orange-400" />
            Expiration Flow Scanner
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {expirations.length} expirations · click to view IV skew &amp; chain
          </p>
        </div>
        {hasUnusual && (
          <div className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-400">
            <Zap size={10} />
            Unusual: {fmtExp(hottest.exp)}
          </div>
        )}
      </div>

      {/* Scrollable card row */}
      <div className="p-3 overflow-x-auto scrollbar-thin scrollbar-track-slate-900 scrollbar-thumb-slate-700">
        <div className="flex gap-2" style={{ minWidth: 'max-content' }}>
          {stats.map((s, i) => {
            const isSelected = s.exp === selectedExp;
            const isHottest = i === hottestIdx && hasUnusual;
            const heatPct = Math.max((s.heatScore / maxHeat) * 100, 4);
            const isBullish = s.callPct > 57;
            const isBearish = s.callPct < 43;

            return (
              <button
                key={s.exp}
                onClick={() => onSelect(s.exp)}
                className={`flex flex-col gap-1.5 p-2.5 rounded-xl border transition-all text-left w-[108px] flex-shrink-0 ${
                  isSelected
                    ? 'border-blue-500/60 bg-blue-500/12 ring-1 ring-blue-500/20'
                    : isHottest
                    ? 'border-orange-500/50 bg-orange-500/8 hover:bg-orange-500/12'
                    : 'border-slate-700/40 bg-slate-900/40 hover:border-slate-600 hover:bg-slate-800/50'
                }`}
              >
                {/* Date + badges */}
                <div className="flex items-center justify-between gap-0.5">
                  <span className="text-[11px] font-mono font-semibold text-white leading-none">
                    {fmtExp(s.exp)}
                  </span>
                  <div className="flex items-center gap-0.5">
                    {isHottest && <Flame size={9} className="text-orange-400 flex-shrink-0" />}
                    {s.unusualCount > 0 && (
                      <span className="text-[9px] px-1 py-0.5 rounded bg-orange-500/20 text-orange-400 font-bold leading-none">
                        {s.unusualCount}⚡
                      </span>
                    )}
                  </div>
                </div>

                {/* Bias */}
                <div className="flex items-center gap-1">
                  {isBullish ? (
                    <TrendingUp size={9} className="text-emerald-400 flex-shrink-0" />
                  ) : isBearish ? (
                    <TrendingDown size={9} className="text-red-400 flex-shrink-0" />
                  ) : (
                    <span className="text-[9px] text-slate-600 w-[9px]">—</span>
                  )}
                  <span
                    className={`text-[10px] font-medium ${
                      isBullish
                        ? 'text-emerald-400'
                        : isBearish
                        ? 'text-red-400'
                        : 'text-slate-500'
                    }`}
                  >
                    {isBullish
                      ? `${Math.round(s.callPct)}% call`
                      : isBearish
                      ? `${Math.round(100 - s.callPct)}% put`
                      : 'balanced'}
                  </span>
                </div>

                {/* Volume */}
                <span className="text-[10px] text-slate-500 leading-none">
                  {s.totalVol > 0 ? `${fmtVol(s.totalVol)} vol` : 'no data'}
                </span>

                {/* Heat bar */}
                <div className="w-full h-0.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      isHottest ? 'bg-orange-400' : isSelected ? 'bg-blue-400' : 'bg-slate-600'
                    }`}
                    style={{ width: `${heatPct}%` }}
                  />
                </div>

                {/* Call/Put volume bar */}
                {s.totalVol > 0 && (
                  <div className="w-full h-0.5 bg-slate-800 rounded-full overflow-hidden flex">
                    <div
                      className="h-full bg-emerald-500"
                      style={{ width: `${s.callPct}%` }}
                    />
                    <div
                      className="h-full bg-red-500"
                      style={{ width: `${100 - s.callPct}%` }}
                    />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="px-4 pb-3 flex items-center gap-4 text-[10px] text-slate-600">
        <span className="flex items-center gap-1"><span className="w-2 h-0.5 bg-emerald-500 inline-block" /> Call vol</span>
        <span className="flex items-center gap-1"><span className="w-2 h-0.5 bg-red-500 inline-block" /> Put vol</span>
        <span className="flex items-center gap-1"><span className="w-2 h-0.5 bg-orange-400 inline-block" /> Heat</span>
        <span>⚡ = unusual contracts</span>
      </div>
    </div>
  );
}
