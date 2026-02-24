'use client';
import React, { useState } from 'react';

interface Contract {
  symbol: string;
  strike: number;
  expiration: string;
  dte: number;
  type: 'call' | 'put';
  bid: number;
  ask: number;
  mark: number;
  volume: number;
  openInterest: number;
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  iv: number;
  itm: boolean;
  spreadPercent: number;
  volumeOIRatio: number;
  isUnusual: boolean;
}

function fmtVol(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return String(v);
}

function ivColor(iv: number): string {
  const pct = iv * 100;
  if (pct > 70) return 'text-red-400';
  if (pct > 50) return 'text-orange-400';
  if (pct > 30) return 'text-amber-400';
  return 'text-emerald-400';
}

export function OptionsChainTable({
  calls,
  puts,
  currentPrice,
  onSelectContract,
}: {
  calls: Contract[];
  puts: Contract[];
  currentPrice: number;
  onSelectContract?: (c: Contract) => void;
}) {
  const [compact, setCompact] = useState(false);

  // Build a map of puts by strike for fast lookup
  const putMap = new Map(puts.map(p => [p.strike, p]));

  // Get unique sorted strikes from calls (they share strikes)
  const strikes = Array.from(new Set([...calls.map(c => c.strike), ...puts.map(p => p.strike)])).sort((a, b) => a - b);

  // ATM strike = closest to current price
  const atmStrike = strikes.reduce((prev, s) => Math.abs(s - currentPrice) < Math.abs(prev - currentPrice) ? s : prev, strikes[0] ?? currentPrice);

  // Filter to ±20% of current price to keep table manageable
  const filteredStrikes = strikes.filter(s => Math.abs(s - currentPrice) / currentPrice <= 0.20);

  const callMap = new Map(calls.map(c => [c.strike, c]));

  return (
    <div className="rounded-2xl border border-slate-700/50 bg-slate-800/20 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/40">
        <h3 className="text-sm font-semibold text-white">Options Chain</h3>
        <button onClick={() => setCompact(!compact)} className="text-xs text-slate-400 hover:text-white transition">
          {compact ? 'Full view' : 'Compact'}
        </button>
      </div>

      <div className="overflow-auto max-h-[420px]">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-slate-900 z-10">
            <tr>
              {/* Calls side */}
              {!compact && <th className="px-2 py-2 text-right text-slate-500 font-medium">Bid</th>}
              <th className="px-2 py-2 text-right text-slate-500 font-medium">Ask</th>
              <th className="px-2 py-2 text-right text-slate-500 font-medium">Δ</th>
              <th className="px-2 py-2 text-right text-slate-500 font-medium">IV</th>
              <th className="px-2 py-2 text-right text-slate-400 font-semibold text-emerald-500">VOL</th>
              {!compact && <th className="px-2 py-2 text-right text-slate-500 font-medium">OI</th>}
              {/* Center */}
              <th className="px-3 py-2 text-center text-slate-300 font-bold bg-slate-800/60">Strike</th>
              {/* Puts side */}
              {!compact && <th className="px-2 py-2 text-left text-slate-500 font-medium">Bid</th>}
              <th className="px-2 py-2 text-left text-slate-500 font-medium">Ask</th>
              <th className="px-2 py-2 text-left text-slate-500 font-medium">Δ</th>
              <th className="px-2 py-2 text-left text-slate-500 font-medium">IV</th>
              <th className="px-2 py-2 text-left text-slate-400 font-semibold text-red-400">VOL</th>
              {!compact && <th className="px-2 py-2 text-left text-slate-500 font-medium">OI</th>}
            </tr>
          </thead>
          <tbody>
            {filteredStrikes.map(strike => {
              const call = callMap.get(strike);
              const put = putMap.get(strike);
              const isAtm = strike === atmStrike;

              return (
                <tr
                  key={strike}
                  className={`border-b border-slate-800/60 hover:bg-slate-700/20 transition-colors ${
                    isAtm ? 'bg-blue-500/8 border-blue-500/20' : ''
                  }`}
                >
                  {/* Calls left side */}
                  {!compact && (
                    <td
                      className={`px-2 py-1.5 text-right cursor-pointer ${call?.itm ? 'bg-emerald-500/5' : ''}`}
                      onClick={() => call && onSelectContract?.(call)}
                    >
                      <span className="text-slate-400">{call ? `$${call.bid.toFixed(2)}` : '—'}</span>
                    </td>
                  )}
                  <td
                    className={`px-2 py-1.5 text-right cursor-pointer ${call?.itm ? 'bg-emerald-500/5' : ''}`}
                    onClick={() => call && onSelectContract?.(call)}
                  >
                    <span className="text-white font-medium">{call ? `$${call.ask.toFixed(2)}` : '—'}</span>
                  </td>
                  <td className={`px-2 py-1.5 text-right ${call?.itm ? 'bg-emerald-500/5' : ''}`}>
                    <span className="text-slate-300">{call ? call.delta.toFixed(2) : '—'}</span>
                  </td>
                  <td className={`px-2 py-1.5 text-right ${call?.itm ? 'bg-emerald-500/5' : ''}`}>
                    <span className={call ? ivColor(call.iv) : 'text-slate-600'}>
                      {call ? `${(call.iv * 100).toFixed(0)}%` : '—'}
                    </span>
                  </td>
                  <td
                    className={`px-2 py-1.5 text-right ${call?.itm ? 'bg-emerald-500/5' : ''}`}
                    onClick={() => call && onSelectContract?.(call)}
                  >
                    <span className={`font-medium ${call?.isUnusual ? 'text-amber-400' : 'text-emerald-400'}`}>
                      {call ? fmtVol(call.volume) : '—'}
                      {call?.isUnusual && <span className="ml-1 text-amber-400">●</span>}
                    </span>
                  </td>
                  {!compact && (
                    <td className={`px-2 py-1.5 text-right ${call?.itm ? 'bg-emerald-500/5' : ''}`}>
                      <span className="text-slate-500">{call ? fmtVol(call.openInterest) : '—'}</span>
                    </td>
                  )}

                  {/* Strike center */}
                  <td className={`px-3 py-1.5 text-center font-bold bg-slate-800/60 ${
                    isAtm ? 'text-blue-400' : strike < currentPrice ? 'text-emerald-500' : 'text-red-400'
                  }`}>
                    ${strike}
                    {isAtm && <span className="text-xs text-blue-400 ml-1">ATM</span>}
                  </td>

                  {/* Puts right side */}
                  {!compact && (
                    <td
                      className={`px-2 py-1.5 text-left cursor-pointer ${put?.itm ? 'bg-red-500/5' : ''}`}
                      onClick={() => put && onSelectContract?.(put)}
                    >
                      <span className="text-slate-400">{put ? `$${put.bid.toFixed(2)}` : '—'}</span>
                    </td>
                  )}
                  <td
                    className={`px-2 py-1.5 text-left cursor-pointer ${put?.itm ? 'bg-red-500/5' : ''}`}
                    onClick={() => put && onSelectContract?.(put)}
                  >
                    <span className="text-white font-medium">{put ? `$${put.ask.toFixed(2)}` : '—'}</span>
                  </td>
                  <td className={`px-2 py-1.5 text-left ${put?.itm ? 'bg-red-500/5' : ''}`}>
                    <span className="text-slate-300">{put ? put.delta.toFixed(2) : '—'}</span>
                  </td>
                  <td className={`px-2 py-1.5 text-left ${put?.itm ? 'bg-red-500/5' : ''}`}>
                    <span className={put ? ivColor(put.iv) : 'text-slate-600'}>
                      {put ? `${(put.iv * 100).toFixed(0)}%` : '—'}
                    </span>
                  </td>
                  <td
                    className={`px-2 py-1.5 text-left ${put?.itm ? 'bg-red-500/5' : ''}`}
                    onClick={() => put && onSelectContract?.(put)}
                  >
                    <span className={`font-medium ${put?.isUnusual ? 'text-amber-400' : 'text-red-400'}`}>
                      {put ? fmtVol(put.volume) : '—'}
                      {put?.isUnusual && <span className="ml-1 text-amber-400">●</span>}
                    </span>
                  </td>
                  {!compact && (
                    <td className={`px-2 py-1.5 text-left ${put?.itm ? 'bg-red-500/5' : ''}`}>
                      <span className="text-slate-500">{put ? fmtVol(put.openInterest) : '—'}</span>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
        {filteredStrikes.length === 0 && (
          <p className="text-slate-500 text-center py-8 text-sm">No chain data for this expiration</p>
        )}
      </div>

      <div className="px-4 py-2 border-t border-slate-700/40 flex items-center gap-4 text-xs text-slate-500">
        <span><span className="text-emerald-400">●</span> Unusual volume</span>
        <span><span className="text-emerald-500">Strike</span> = calls ITM</span>
        <span><span className="text-red-400">Strike</span> = puts ITM</span>
        <span><span className="text-blue-400">Strike</span> = ATM</span>
      </div>
    </div>
  );
}
