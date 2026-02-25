'use client';
import React from 'react';

interface ExpGreeks {
  netDelta: number;
  totalTheta: number;
  totalVega: number;
  totalGamma: number;
  dte: number;
}

interface ExpMove {
  straddle: number;
  movePct: number;
  upperTarget: number;
  lowerTarget: number;
  dte: number;
}

interface Props {
  greeksAggregation: {
    byExpiration: Record<string, ExpGreeks>;
    totals: { netDelta: number; totalTheta: number; totalVega: number; totalGamma: number };
  } | null;
  expectedMoveByExpiration: Record<string, ExpMove>;
  currentPrice: number;
  expirations: string[];
}

function fmtDollar(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : n > 0 ? '+' : '';
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(0)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

function fmtDelta(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '+';
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(0)}K`;
  return `${sign}${abs.toFixed(0)}`;
}

export function GreeksPanel({ greeksAggregation, expectedMoveByExpiration, currentPrice, expirations }: Props) {
  const sortedExps = expirations.slice().sort();
  const expMoveEntries = Object.entries(expectedMoveByExpiration || {}).sort(([, a], [, b]) => a.dte - b.dte);

  return (
    <div className="space-y-3">
      {/* Section A — Greeks by expiration */}
      {greeksAggregation && (
        <div className="rounded-2xl border border-slate-700/50 bg-slate-800/20 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-700/40">
            <h3 className="text-sm font-semibold text-white">Market Greeks Exposure</h3>
            <p className="text-xs text-slate-500 mt-0.5">Aggregated OI-weighted Greeks across all expirations</p>
          </div>

          {/* Totals row */}
          <div className="grid grid-cols-3 divide-x divide-slate-700/30 border-b border-slate-700/30">
            <div className="px-3 py-2.5 text-center">
              <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-0.5">Net Delta</p>
              <p className={`text-sm font-bold ${greeksAggregation.totals.netDelta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {fmtDelta(greeksAggregation.totals.netDelta)}
              </p>
            </div>
            <div className="px-3 py-2.5 text-center">
              <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-0.5">θ / Day</p>
              <p className="text-sm font-bold text-red-400">
                {fmtDollar(greeksAggregation.totals.totalTheta)}
              </p>
            </div>
            <div className="px-3 py-2.5 text-center">
              <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-0.5">υ / 1%</p>
              <p className="text-sm font-bold text-blue-400">
                {fmtDollar(greeksAggregation.totals.totalVega)}
              </p>
            </div>
          </div>

          {/* Per-expiration table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[10px] text-slate-600 uppercase tracking-wide bg-slate-900/30">
                  <th className="px-3 py-1.5 text-left font-medium">Exp</th>
                  <th className="px-2 py-1.5 text-center font-medium">DTE</th>
                  <th className="px-2 py-1.5 text-center font-medium">Net Δ</th>
                  <th className="px-2 py-1.5 text-center font-medium">θ /day</th>
                  <th className="px-2 py-1.5 text-center font-medium">υ /1%</th>
                  <th className="px-2 py-1.5 text-center font-medium">Bias</th>
                </tr>
              </thead>
              <tbody>
                {sortedExps.slice(0, 6).map((exp) => {
                  const g = greeksAggregation.byExpiration[exp];
                  if (!g) return null;
                  const bias = g.netDelta > 500 ? 'BULLISH' : g.netDelta < -500 ? 'BEARISH' : 'NEUTRAL';
                  const biasColor = bias === 'BULLISH' ? 'text-emerald-400' : bias === 'BEARISH' ? 'text-red-400' : 'text-slate-400';
                  return (
                    <tr key={exp} className="border-t border-slate-800/40 hover:bg-slate-800/10">
                      <td className="px-3 py-1.5 font-mono text-slate-300">{exp}</td>
                      <td className="px-2 py-1.5 text-center text-slate-500">{g.dte}</td>
                      <td className={`px-2 py-1.5 text-center font-mono ${g.netDelta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {fmtDelta(g.netDelta)}
                      </td>
                      <td className="px-2 py-1.5 text-center font-mono text-red-400">
                        {fmtDollar(g.totalTheta)}
                      </td>
                      <td className="px-2 py-1.5 text-center font-mono text-blue-400">
                        {fmtDollar(g.totalVega)}
                      </td>
                      <td className={`px-2 py-1.5 text-center font-semibold ${biasColor}`}>
                        {bias}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Section B — Expected Move by Expiration */}
      {expMoveEntries.length > 0 && (
        <div className="rounded-2xl border border-slate-700/50 bg-slate-800/20 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-700/40">
            <h3 className="text-sm font-semibold text-white">Expected Move by Expiration</h3>
            <p className="text-xs text-slate-500 mt-0.5">ATM straddle cost as % of spot · σ₁ implied range</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[10px] text-slate-600 uppercase tracking-wide bg-slate-900/30">
                  <th className="px-3 py-1.5 text-left font-medium">Exp</th>
                  <th className="px-2 py-1.5 text-center font-medium">DTE</th>
                  <th className="px-2 py-1.5 text-center font-medium">±Move</th>
                  <th className="px-2 py-1.5 text-center font-medium">Straddle</th>
                  <th className="px-2 py-1.5 text-center font-medium">Upper</th>
                  <th className="px-2 py-1.5 text-center font-medium">Lower</th>
                </tr>
              </thead>
              <tbody>
                {expMoveEntries.slice(0, 6).map(([exp, m]) => (
                  <tr key={exp} className="border-t border-slate-800/40 hover:bg-slate-800/10">
                    <td className="px-3 py-1.5 font-mono text-slate-300">{exp}</td>
                    <td className="px-2 py-1.5 text-center text-slate-500">{m.dte}</td>
                    <td className="px-2 py-1.5 text-center font-bold text-white">±{m.movePct.toFixed(1)}%</td>
                    <td className="px-2 py-1.5 text-center font-mono text-slate-400">${m.straddle.toFixed(2)}</td>
                    <td className="px-2 py-1.5 text-center font-mono text-emerald-400">${m.upperTarget.toFixed(2)}</td>
                    <td className="px-2 py-1.5 text-center font-mono text-red-400">${m.lowerTarget.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
