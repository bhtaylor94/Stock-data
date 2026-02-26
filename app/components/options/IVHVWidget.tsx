'use client';
import React from 'react';

interface IVHVWidgetProps {
  atmIV: number;       // decimal, e.g. 0.28 = 28%
  hv20: number;        // decimal
  ivVsHV: number | null;  // ratio, e.g. 1.35
  ivRank: number | null;  // 0-100
  ivPercentile?: number | null;
}

function GaugeBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all ${color}`}
        style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
      />
    </div>
  );
}

export function IVHVWidget({ atmIV, hv20, ivVsHV, ivRank, ivPercentile }: IVHVWidgetProps) {
  const ivPct = Math.round(atmIV * 100 * 10) / 10;
  const hvPct = Math.round(hv20 * 100 * 10) / 10;

  // Premium signal from IV/HV ratio
  let signal: { label: string; sub: string; color: string; bg: string; border: string };
  if (ivVsHV == null) {
    signal = { label: 'N/A', sub: 'Insufficient data', color: 'text-slate-400', bg: 'bg-slate-500/10', border: 'border-slate-500/20' };
  } else if (ivVsHV >= 1.4) {
    signal = { label: 'IV RICH', sub: 'Sell premium / credit spreads', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/25' };
  } else if (ivVsHV >= 1.15) {
    signal = { label: 'ELEVATED', sub: 'Slight edge to sellers', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/25' };
  } else if (ivVsHV >= 0.85) {
    signal = { label: 'FAIR VALUE', sub: 'No clear edge', color: 'text-slate-300', bg: 'bg-slate-500/10', border: 'border-slate-500/25' };
  } else if (ivVsHV >= 0.65) {
    signal = { label: 'DISCOUNTED', sub: 'Slight edge to buyers', color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/25' };
  } else {
    signal = { label: 'IV CHEAP', sub: 'Buy premium / debit spreads', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/25' };
  }

  const ivRankColor = ivRank == null ? 'text-slate-400'
    : ivRank >= 80 ? 'text-red-400'
    : ivRank >= 50 ? 'text-amber-400'
    : ivRank >= 20 ? 'text-blue-400'
    : 'text-emerald-400';

  return (
    <div className="rounded-2xl border border-slate-700/50 bg-slate-800/30 p-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wide">
            Volatility Premium
          </h3>
          <p className="text-[10px] text-slate-500 mt-0.5">
            Implied vs Historical — options pricing edge
          </p>
        </div>
        {/* Signal badge */}
        <div className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${signal.color} ${signal.bg} ${signal.border}`}>
          {signal.label}
        </div>
      </div>

      {/* IV vs HV comparison */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        {/* Implied Volatility */}
        <div className="space-y-1">
          <div className="flex justify-between items-baseline">
            <span className="text-[10px] text-slate-500">ATM IV (30d)</span>
            <span className="text-sm font-bold font-mono text-white">{ivPct}%</span>
          </div>
          <GaugeBar pct={Math.min(ivPct * 2, 100)} color="bg-amber-500" />
        </div>

        {/* Historical Volatility */}
        <div className="space-y-1">
          <div className="flex justify-between items-baseline">
            <span className="text-[10px] text-slate-500">HV 20-day</span>
            <span className="text-sm font-bold font-mono text-slate-300">{hvPct}%</span>
          </div>
          <GaugeBar pct={Math.min(hvPct * 2, 100)} color="bg-blue-500" />
        </div>
      </div>

      {/* IV/HV ratio + IV Rank row */}
      <div className="flex items-center gap-3 pt-2 border-t border-slate-700/40">
        {ivVsHV != null && (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-slate-500">IV/HV</span>
            <span className={`text-xs font-bold font-mono ${signal.color}`}>
              {ivVsHV.toFixed(2)}×
            </span>
          </div>
        )}
        {ivRank != null && (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-slate-500">IV Rank</span>
            <span className={`text-xs font-bold font-mono ${ivRankColor}`}>
              {Math.round(ivRank)}
            </span>
          </div>
        )}
        {ivPercentile != null && (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-slate-500">IV %ile</span>
            <span className={`text-xs font-bold font-mono ${ivRankColor}`}>
              {Math.round(ivPercentile)}
            </span>
          </div>
        )}
        <div className="ml-auto text-[10px] text-slate-500 italic">
          {signal.sub}
        </div>
      </div>
    </div>
  );
}
