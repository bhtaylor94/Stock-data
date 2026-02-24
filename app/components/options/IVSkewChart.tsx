'use client';
import React from 'react';

interface Contract {
  strike: number;
  iv: number;
  type: 'call' | 'put';
  delta?: number;
  volume?: number;
  openInterest?: number;
  volumeOIRatio?: number;
  isUnusual?: boolean;
}

function spreadColor(spread: number): string {
  if (spread > 0.05) return 'text-red-400';
  if (spread > 0.02) return 'text-orange-400';
  if (spread < -0.05) return 'text-emerald-400';
  if (spread < -0.02) return 'text-cyan-400';
  return 'text-slate-500';
}

function fmtVol(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return String(v);
}

export function IVSkewChart({
  calls,
  puts,
  currentPrice,
  expiration,
}: {
  calls: Contract[];
  puts: Contract[];
  currentPrice: number;
  expiration?: string;
}) {
  // Filter to ±20% of current price, require iv > 0
  const range = currentPrice * 0.20;
  const filteredCalls = calls
    .filter(c => c.iv > 0 && Math.abs(c.strike - currentPrice) <= range)
    .sort((a, b) => a.strike - b.strike);
  const filteredPuts = puts
    .filter(p => p.iv > 0 && Math.abs(p.strike - currentPrice) <= range)
    .sort((a, b) => a.strike - b.strike);

  const allStrikes = Array.from(
    new Set([...filteredCalls.map(c => c.strike), ...filteredPuts.map(p => p.strike)])
  ).sort((a, b) => a - b);

  if (allStrikes.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-700/50 bg-slate-800/20 p-6 text-center">
        <p className="text-xs text-slate-500">No IV skew data available for this expiration</p>
      </div>
    );
  }

  const callMap = new Map(filteredCalls.map(c => [c.strike, c]));
  const putMap = new Map(filteredPuts.map(p => [p.strike, p]));

  // Max IV for proportional bars
  const allIVs = [...filteredCalls, ...filteredPuts].map(c => c.iv);
  const maxIV = Math.max(...allIVs, 0.01);

  // ── OTM skew summary ──────────────────────────────────────────────────────
  // Compare 5% OTM put to 5% OTM call (where skew actually lives)
  const otmCallTarget = currentPrice * 1.05;
  const otmPutTarget = currentPrice * 0.95;

  const otmCall = filteredCalls
    .filter(c => c.strike > currentPrice)
    .reduce<Contract | null>(
      (best, c) =>
        !best || Math.abs(c.strike - otmCallTarget) < Math.abs(best.strike - otmCallTarget)
          ? c
          : best,
      null,
    );

  const otmPut = filteredPuts
    .filter(p => p.strike < currentPrice)
    .reduce<Contract | null>(
      (best, p) =>
        !best || Math.abs(p.strike - otmPutTarget) < Math.abs(best.strike - otmPutTarget)
          ? p
          : best,
      null,
    );

  const skewSpread = otmCall && otmPut ? otmPut.iv - otmCall.iv : null;

  const skewInfo =
    skewSpread === null
      ? null
      : skewSpread > 0.03
      ? { label: 'Bearish Skew', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' }
      : skewSpread < -0.03
      ? {
          label: 'Bullish Skew',
          color: 'text-emerald-400',
          bg: 'bg-emerald-500/10 border-emerald-500/20',
        }
      : { label: 'Flat', color: 'text-slate-400', bg: 'bg-slate-700/20 border-slate-600/30' };

  // ── ATM helpers ───────────────────────────────────────────────────────────
  const isATM = (s: number) => Math.abs(s - currentPrice) / currentPrice < 0.008;
  const isNearATM = (s: number) => Math.abs(s - currentPrice) / currentPrice < 0.025;

  return (
    <div className="rounded-2xl border border-slate-700/50 bg-slate-800/20 overflow-hidden">

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/40">
        <div>
          <h3 className="text-sm font-semibold text-white">IV Skew by Strike</h3>
          <p className="text-xs text-slate-500 mt-0.5">ATM ±20% · call vs put implied volatility</p>
        </div>
        <div className="flex items-center gap-2">
          {expiration && <span className="text-xs text-slate-500 font-mono">{expiration}</span>}
          {skewInfo && (
            <span
              className={`text-[11px] px-2 py-0.5 rounded-full border font-semibold ${skewInfo.color} ${skewInfo.bg}`}
            >
              {skewInfo.label}
            </span>
          )}
        </div>
      </div>

      {/* ── OTM skew summary strip ── */}
      <div className="grid grid-cols-3 divide-x divide-slate-700/30 border-b border-slate-700/30">
        <div className="px-3 py-2.5 text-center">
          <p className="text-[10px] text-slate-500 uppercase tracking-wide leading-none mb-1">
            5% OTM Call
            {otmCall && (
              <span className="text-slate-600 font-mono ml-1">${otmCall.strike}</span>
            )}
          </p>
          <p className="text-sm font-bold text-emerald-400">
            {otmCall ? `${(otmCall.iv * 100).toFixed(1)}%` : '—'}
          </p>
        </div>
        <div className="px-3 py-2.5 text-center">
          <p className="text-[10px] text-slate-500 uppercase tracking-wide leading-none mb-1">
            5% OTM Put
            {otmPut && (
              <span className="text-slate-600 font-mono ml-1">${otmPut.strike}</span>
            )}
          </p>
          <p className="text-sm font-bold text-red-400">
            {otmPut ? `${(otmPut.iv * 100).toFixed(1)}%` : '—'}
          </p>
        </div>
        <div className="px-3 py-2.5 text-center">
          <p className="text-[10px] text-slate-500 uppercase tracking-wide leading-none mb-1">
            Put Premium
          </p>
          <p
            className={`text-sm font-bold ${
              skewSpread !== null ? spreadColor(skewSpread) : 'text-slate-500'
            }`}
          >
            {skewSpread !== null
              ? `${skewSpread >= 0 ? '+' : ''}${(skewSpread * 100).toFixed(1)}%`
              : '—'}
          </p>
        </div>
      </div>

      {/* ── Strike table ── */}
      {/* Column headers */}
      <div className="grid grid-cols-[1fr_72px_52px_1fr] text-[10px] text-slate-600 uppercase tracking-wide px-3 py-1.5 bg-slate-900/40 border-b border-slate-800/60 sticky top-0">
        <span className="text-right pr-3">Call IV</span>
        <span className="text-center">Strike</span>
        <span className="text-center">Spread</span>
        <span className="text-left pl-3">Put IV</span>
      </div>

      <div className="overflow-y-auto" style={{ maxHeight: 300 }}>
        {allStrikes.map(strike => {
          const call = callMap.get(strike);
          const put = putMap.get(strike);
          const spread = call && put ? put.iv - call.iv : null;
          const atm = isATM(strike);
          const nearAtm = isNearATM(strike);
          const unusualCall = call?.isUnusual || (call?.volumeOIRatio ?? 0) > 2;
          const unusualPut = put?.isUnusual || (put?.volumeOIRatio ?? 0) > 2;

          return (
            <div
              key={strike}
              className={`grid grid-cols-[1fr_72px_52px_1fr] items-center px-3 py-1.5 border-b border-slate-800/30 transition-colors ${
                atm
                  ? 'bg-blue-500/10 border-blue-500/20'
                  : nearAtm
                  ? 'bg-slate-800/20'
                  : 'hover:bg-slate-800/15'
              }`}
            >
              {/* Call IV — right-aligned with bar growing leftward */}
              <div className="flex items-center justify-end gap-2 pr-3">
                {call ? (
                  <>
                    {unusualCall && (
                      <span className="text-[9px] text-amber-400 font-bold">⚡</span>
                    )}
                    {call.volume != null && call.volume > 0 && (
                      <span className="text-[10px] text-slate-600 font-mono">
                        {fmtVol(call.volume)}
                      </span>
                    )}
                    <div className="flex items-center gap-1">
                      {/* Bar grows right-to-left visually via flex-row-reverse */}
                      <div className="w-10 h-1.5 bg-slate-800 rounded-full overflow-hidden flex justify-end">
                        <div
                          className="h-full bg-emerald-500/70 rounded-full"
                          style={{ width: `${Math.min((call.iv / maxIV) * 100, 100)}%` }}
                        />
                      </div>
                      <span className="text-xs font-mono font-semibold text-emerald-400 w-10 text-right">
                        {(call.iv * 100).toFixed(1)}%
                      </span>
                    </div>
                  </>
                ) : (
                  <span className="text-xs text-slate-700">—</span>
                )}
              </div>

              {/* Strike */}
              <div className="text-center">
                <span
                  className={`text-xs font-mono font-bold ${
                    atm ? 'text-blue-400' : nearAtm ? 'text-slate-200' : 'text-slate-400'
                  }`}
                >
                  ${strike}
                </span>
                {atm && (
                  <span className="block text-[9px] text-blue-500 leading-none mt-0.5">ATM</span>
                )}
              </div>

              {/* Put-Call spread */}
              <div className="text-center">
                {spread !== null ? (
                  <span className={`text-[10px] font-mono font-semibold ${spreadColor(spread)}`}>
                    {spread >= 0 ? '+' : ''}
                    {(spread * 100).toFixed(1)}
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-700">—</span>
                )}
              </div>

              {/* Put IV — left-aligned */}
              <div className="flex items-center gap-2 pl-3">
                {put ? (
                  <>
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-mono font-semibold text-red-400 w-10">
                        {(put.iv * 100).toFixed(1)}%
                      </span>
                      <div className="w-10 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-red-500/70 rounded-full"
                          style={{ width: `${Math.min((put.iv / maxIV) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                    {put.volume != null && put.volume > 0 && (
                      <span className="text-[10px] text-slate-600 font-mono">
                        {fmtVol(put.volume)}
                      </span>
                    )}
                    {unusualPut && (
                      <span className="text-[9px] text-amber-400 font-bold">⚡</span>
                    )}
                  </>
                ) : (
                  <span className="text-xs text-slate-700">—</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Interpretation line ── */}
      {skewSpread !== null && (
        <p className="text-xs text-slate-400 px-4 py-3 border-t border-slate-700/30">
          {skewSpread > 0.03
            ? `OTM puts are ${(skewSpread * 100).toFixed(1)}% more expensive than equidistant calls — market is pricing in downside risk.`
            : skewSpread < -0.03
            ? `OTM calls are ${(Math.abs(skewSpread) * 100).toFixed(1)}% more expensive than equidistant puts — elevated upside speculation.`
            : 'Put and call IV are balanced — no strong directional skew in the options market.'}
        </p>
      )}
    </div>
  );
}
