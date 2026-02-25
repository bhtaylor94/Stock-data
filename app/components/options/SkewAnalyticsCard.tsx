'use client';
import React from 'react';
import { TipLabel } from '@/app/components/core/Tooltip';

interface Props {
  skewAnalytics: {
    delta25CallIV: number;
    delta25PutIV: number;
    riskReversal25: number;
    delta10CallIV: number;
    delta10PutIV: number;
    riskReversal10: number;
    skewBias: 'FEAR' | 'GREED' | 'NEUTRAL';
  } | null;
}

export function SkewAnalyticsCard({ skewAnalytics }: Props) {
  if (!skewAnalytics) {
    return (
      <div className="rounded-2xl border border-slate-700/50 bg-slate-800/20 p-6 text-center">
        <p className="text-xs text-slate-500">Insufficient delta data for skew analytics</p>
      </div>
    );
  }

  const { delta25CallIV, delta25PutIV, riskReversal25, delta10CallIV, delta10PutIV, riskReversal10, skewBias } = skewAnalytics;

  const biasColor =
    skewBias === 'FEAR' ? 'text-red-400 bg-red-500/10 border-red-500/20' :
    skewBias === 'GREED' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' :
    'text-slate-300 bg-slate-700/20 border-slate-600/30';

  // Gauge: riskReversal25 ranges from about -10 (extreme greed) to +10 (extreme fear)
  // Map to 0–100% for position
  const gaugeClamp = Math.max(-10, Math.min(10, riskReversal25));
  const gaugePct = ((gaugeClamp + 10) / 20) * 100; // 0% = far left (greed), 100% = far right (fear)

  const interpretation =
    riskReversal25 > 3
      ? `OTM puts are ${riskReversal25.toFixed(1)} vol pts more expensive than equidistant calls — elevated hedging demand.`
      : riskReversal25 < -3
      ? `OTM calls are ${Math.abs(riskReversal25).toFixed(1)} vol pts more expensive than equidistant puts — elevated upside speculation.`
      : 'Put and call skew is balanced — market not pricing in strong directional fear or greed.';

  return (
    <div className="rounded-2xl border border-slate-700/50 bg-slate-800/20 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/40">
        <div>
          <h3 className="text-sm font-semibold text-white"><TipLabel labelKey="25D RISK REV">Volatility Skew Analytics</TipLabel></h3>
          <p className="text-xs text-slate-500 mt-0.5">25-delta risk reversal · put vs call skew</p>
        </div>
        <span className={`text-[11px] px-2 py-0.5 rounded-full border font-semibold ${biasColor}`}>
          {skewBias}
        </span>
      </div>

      <div className="p-4 space-y-4">
        {/* Gauge bar */}
        <div>
          <div className="flex justify-between text-[10px] text-slate-500 mb-1.5">
            <span className="text-emerald-400">← GREED</span>
            <span className="text-slate-400">NEUTRAL</span>
            <span className="text-red-400">FEAR →</span>
          </div>
          <div className="relative h-2.5 bg-gradient-to-r from-emerald-500/30 via-slate-700 to-red-500/30 rounded-full">
            <div
              className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white border-2 border-slate-800 shadow transition-all"
              style={{ left: `calc(${gaugePct}% - 6px)` }}
            />
          </div>
          <p className="text-center text-xs text-slate-400 mt-1.5 font-mono">
            RR25: {riskReversal25 >= 0 ? '+' : ''}{riskReversal25.toFixed(1)} pts
          </p>
        </div>

        {/* Delta rows */}
        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-2 rounded-lg bg-slate-800/40">
              <p className="text-[10px] text-slate-500 mb-0.5">25Δ Call IV</p>
              <p className="text-sm font-bold text-emerald-400">{delta25CallIV.toFixed(1)}%</p>
            </div>
            <div className="p-2 rounded-lg bg-slate-800/40">
              <p className="text-[10px] text-slate-500 mb-0.5"><TipLabel labelKey="25D RISK REV">25Δ RR</TipLabel></p>
              <p className={`text-sm font-bold ${riskReversal25 > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                {riskReversal25 >= 0 ? '+' : ''}{riskReversal25.toFixed(1)}
              </p>
            </div>
            <div className="p-2 rounded-lg bg-slate-800/40">
              <p className="text-[10px] text-slate-500 mb-0.5">25Δ Put IV</p>
              <p className="text-sm font-bold text-red-400">{delta25PutIV.toFixed(1)}%</p>
            </div>
          </div>

          {delta10CallIV > 0 && delta10PutIV > 0 && (
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2 rounded-lg bg-slate-800/20">
                <p className="text-[10px] text-slate-500 mb-0.5">10Δ Call IV</p>
                <p className="text-xs font-semibold text-emerald-400">{delta10CallIV.toFixed(1)}%</p>
              </div>
              <div className="p-2 rounded-lg bg-slate-800/20">
                <p className="text-[10px] text-slate-500 mb-0.5">10Δ RR</p>
                <p className={`text-xs font-semibold ${riskReversal10 > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                  {riskReversal10 >= 0 ? '+' : ''}{riskReversal10.toFixed(1)}
                </p>
              </div>
              <div className="p-2 rounded-lg bg-slate-800/20">
                <p className="text-[10px] text-slate-500 mb-0.5">10Δ Put IV</p>
                <p className="text-xs font-semibold text-red-400">{delta10PutIV.toFixed(1)}%</p>
              </div>
            </div>
          )}
        </div>

        <p className="text-xs text-slate-400 border-t border-slate-700/30 pt-3">{interpretation}</p>
      </div>
    </div>
  );
}
