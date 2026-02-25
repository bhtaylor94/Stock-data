'use client';
import React from 'react';

interface ZDTEActivity {
  strike: number;
  type: string;
  expiration: string;
  dte: number;
  premiumFormatted?: string;
  premium?: number;
  sentiment?: string;
  alertType?: string;
}

interface Props {
  zdteFlow: {
    detected: true;
    activities: ZDTEActivity[];
    totalPremium: number;
    bullishPremium: number;
    bearishPremium: number;
    netBias: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  };
  currentPrice: number;
}

function fmtPremium(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

export function ZeroDTEAlert({ zdteFlow, currentPrice }: Props) {
  const biasColor =
    zdteFlow.netBias === 'BULLISH' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' :
    zdteFlow.netBias === 'BEARISH' ? 'text-red-400 bg-red-500/10 border-red-500/30' :
    'text-slate-300 bg-slate-700/20 border-slate-600/30';

  const totalPrem = zdteFlow.bullishPremium + zdteFlow.bearishPremium;
  const bullPct = totalPrem > 0 ? (zdteFlow.bullishPremium / totalPrem) * 100 : 50;

  return (
    <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-amber-500/20">
        <div className="flex items-center gap-2">
          <span className="text-amber-400 font-bold text-sm">⚡ 0DTE FLOW DETECTED</span>
          <span className={`text-[11px] px-2 py-0.5 rounded-full border font-semibold ${biasColor}`}>
            {zdteFlow.netBias}
          </span>
        </div>
        <span className="text-xs text-slate-400 font-mono">{fmtPremium(zdteFlow.totalPremium)} total</span>
      </div>

      <div className="p-4 space-y-3">
        {/* Premium split */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-slate-400">
            <span className="text-emerald-400">Bullish: {fmtPremium(zdteFlow.bullishPremium)}</span>
            <span className="text-red-400">Bearish: {fmtPremium(zdteFlow.bearishPremium)}</span>
          </div>
          <div className="h-2 rounded-full bg-red-500/30 overflow-hidden">
            <div
              className="h-full bg-emerald-500/70 rounded-full transition-all"
              style={{ width: `${bullPct}%` }}
            />
          </div>
        </div>

        {/* Top activities */}
        {zdteFlow.activities.slice(0, 2).map((a, i) => (
          <div
            key={i}
            className="flex items-center gap-2 p-2 rounded-lg bg-slate-800/30 border border-slate-700/30"
          >
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
              a.type?.toUpperCase() === 'CALL'
                ? 'bg-emerald-500/20 text-emerald-400'
                : 'bg-red-500/20 text-red-400'
            }`}>
              {a.type?.toUpperCase()}
            </span>
            <span className="text-xs font-mono text-white">${a.strike}</span>
            <span className="text-xs text-slate-500">{a.expiration}</span>
            {a.premiumFormatted && (
              <span className="ml-auto text-xs font-semibold text-amber-400">{a.premiumFormatted}</span>
            )}
          </div>
        ))}

        <p className="text-[10px] text-slate-500">
          ⚠ 0DTE options have extreme gamma risk and can expire worthless intraday. Educational only — not financial advice.
        </p>
      </div>
    </div>
  );
}
