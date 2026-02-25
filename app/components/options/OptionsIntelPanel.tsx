'use client';
import React from 'react';

interface Props {
  ivAnalysis: {
    ivRank: number;
    atmIV: number;
    ivSignal: string;
    recommendation: string;
  };
  metrics: {
    premiumWeightedPC?: number;
    premiumSentiment?: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    ivRank?: number;
    maxPain?: number;
  };
  skewAnalytics: {
    riskReversal25: number;
    skewBias: 'FEAR' | 'GREED' | 'NEUTRAL';
  } | null;
  gex: {
    regime: 'POSITIVE' | 'NEGATIVE';
    netGEX: number;
  };
  historicalVolatility: {
    hv20: number;
    ivVsHV: number | null;
  };
  expectedMoveByExpiration: Record<string, { movePct: number; straddle: number; dte: number }>;
}

function StatTile({
  label,
  value,
  sub,
  valueColor,
}: {
  label: string;
  value: string;
  sub?: string;
  valueColor?: string;
}) {
  return (
    <div className="p-3 rounded-xl border border-slate-700/40 bg-slate-800/20 text-center">
      <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-0.5 leading-tight">{label}</p>
      <p className={`text-sm font-bold ${valueColor || 'text-white'}`}>{value}</p>
      {sub && (
        <p className={`text-[10px] font-semibold mt-0.5 ${valueColor || 'text-slate-400'}`}>{sub}</p>
      )}
    </div>
  );
}

export function OptionsIntelPanel({
  ivAnalysis,
  metrics,
  skewAnalytics,
  gex,
  historicalVolatility,
  expectedMoveByExpiration,
}: Props) {
  const premiumPC = metrics?.premiumWeightedPC;
  const premSentiment = metrics?.premiumSentiment;
  const premPCColor =
    premSentiment === 'BULLISH' ? 'text-emerald-400' :
    premSentiment === 'BEARISH' ? 'text-red-400' :
    'text-slate-300';

  const rr25 = skewAnalytics?.riskReversal25;
  const skewBias = skewAnalytics?.skewBias;
  const skewColor =
    skewBias === 'FEAR' ? 'text-red-400' :
    skewBias === 'GREED' ? 'text-emerald-400' :
    'text-slate-300';

  const ivRank = ivAnalysis?.ivRank ?? metrics?.ivRank ?? 0;
  const ivRankColor =
    ivRank >= 70 ? 'text-red-400' :
    ivRank >= 40 ? 'text-amber-400' :
    'text-emerald-400';

  const atmIV = ivAnalysis?.atmIV ?? 0;
  const ivVsHV = historicalVolatility?.ivVsHV;
  const ivVsHVColor =
    ivVsHV != null && ivVsHV > 1.3 ? 'text-red-400' :
    ivVsHV != null && ivVsHV > 1.1 ? 'text-amber-400' :
    ivVsHV != null && ivVsHV < 0.9 ? 'text-emerald-400' :
    'text-slate-300';
  const ivVsHVLabel =
    ivVsHV != null && ivVsHV > 1.2 ? 'RICH' :
    ivVsHV != null && ivVsHV < 0.85 ? 'CHEAP' :
    'FAIR';

  const gexRegime = gex?.regime;
  const gexColor = gexRegime === 'POSITIVE' ? 'text-emerald-400' : 'text-red-400';

  // Nearest expiration expected move
  const nearestExp = Object.entries(expectedMoveByExpiration || {})
    .sort(([, a], [, b]) => a.dte - b.dte)[0];
  const nearestMovePct = nearestExp?.[1]?.movePct;

  return (
    <div className="rounded-2xl border border-slate-700/50 bg-slate-800/20 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-700/40">
        <h3 className="text-sm font-semibold text-white">Institutional Intel Dashboard</h3>
        <p className="text-xs text-slate-500 mt-0.5">Live derivatives intelligence · 8 key signals</p>
      </div>
      <div className="p-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
        <StatTile
          label="Prem P/C"
          value={premiumPC != null ? premiumPC.toFixed(2) : '—'}
          sub={premSentiment}
          valueColor={premPCColor}
        />
        <StatTile
          label="25D Risk Rev"
          value={rr25 != null ? `${rr25 >= 0 ? '+' : ''}${rr25.toFixed(1)}` : '—'}
          sub={skewBias}
          valueColor={skewColor}
        />
        <StatTile
          label="IV Rank"
          value={ivRank != null ? `${ivRank}` : '—'}
          sub={ivAnalysis?.ivSignal}
          valueColor={ivRankColor}
        />
        <StatTile
          label="ATM IV"
          value={atmIV ? `${atmIV.toFixed(1)}%` : '—'}
          valueColor="text-white"
        />
        <StatTile
          label="IV vs HV20"
          value={ivVsHV != null ? `${ivVsHV.toFixed(2)}×` : '—'}
          sub={ivVsHVLabel}
          valueColor={ivVsHVColor}
        />
        <StatTile
          label="Skew Bias"
          value={skewBias ?? '—'}
          valueColor={skewColor}
        />
        <StatTile
          label="GEX Regime"
          value={gexRegime ?? '—'}
          valueColor={gexColor}
        />
        <StatTile
          label="Exp Move"
          value={nearestMovePct != null ? `±${nearestMovePct.toFixed(1)}%` : '—'}
          sub={nearestExp ? `${nearestExp[1].dte}DTE` : undefined}
          valueColor="text-white"
        />
      </div>
    </div>
  );
}
