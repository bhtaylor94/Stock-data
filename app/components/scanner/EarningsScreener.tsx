'use client';
import React, { useEffect, useState } from 'react';

interface EarningsEntry {
  ticker: string;
  date: string;
  hour: string;
  epsEstimate: number | null;
  revenueEstimate: number | null;
}

interface EnrichedEntry extends EarningsEntry {
  ivRank?: number | null;
  expectedMove?: number | null;
  loadingIV?: boolean;
}

function hourLabel(h: string): string {
  if (h === 'bmo') return 'Pre-Market';
  if (h === 'amc') return 'After Close';
  return 'During Hours';
}

function IVBadge({ ivRank }: { ivRank: number | null | undefined }) {
  if (ivRank === undefined) return <span className="text-[10px] text-slate-600">—</span>;
  if (ivRank === null) return <span className="text-[10px] text-slate-500">N/A</span>;
  const color = ivRank >= 70 ? 'bg-red-900/40 border-red-700/40 text-red-400'
    : ivRank >= 40 ? 'bg-amber-900/40 border-amber-700/40 text-amber-400'
    : 'bg-emerald-900/40 border-emerald-700/40 text-emerald-400';
  const label = ivRank >= 70 ? 'Sell Vol' : ivRank >= 40 ? 'Neutral' : 'Buy Vol';
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${color}`}>
      {ivRank}% · {label}
    </span>
  );
}

export function EarningsScreener() {
  const [entries, setEntries] = useState<EnrichedEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/earnings')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => {
        const earnings: EarningsEntry[] = data.earnings ?? [];
        setEntries(earnings.slice(0, 15).map((e) => ({ ...e })));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const loadIV = async (ticker: string) => {
    setEntries((prev) =>
      prev.map((e) => (e.ticker === ticker ? { ...e, loadingIV: true } : e)),
    );
    try {
      const res = await fetch(`/api/options/${ticker}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      const ivRank = data.metrics?.ivRank ?? null;
      // Expected move from ATM straddle (if available)
      const exps = data.expirations ?? [];
      let expectedMove: number | null = null;
      if (exps.length > 0 && data.byExpiration?.[exps[0]]) {
        const { calls = [], puts = [] } = data.byExpiration[exps[0]];
        const price = data.currentPrice ?? 0;
        if (price > 0) {
          const atmCall = calls.reduce((best: any, c: any) => {
            return !best || Math.abs(c.strike - price) < Math.abs(best.strike - price) ? c : best;
          }, null);
          const atmPut = puts.reduce((best: any, p: any) => {
            return !best || Math.abs(p.strike - price) < Math.abs(best.strike - price) ? p : best;
          }, null);
          if (atmCall && atmPut) {
            const straddleCost = (atmCall.ask + atmPut.ask);
            expectedMove = parseFloat(((straddleCost / price) * 100).toFixed(1));
          }
        }
      }
      setEntries((prev) =>
        prev.map((e) => (e.ticker === ticker ? { ...e, ivRank, expectedMove, loadingIV: false } : e)),
      );
    } catch {
      setEntries((prev) =>
        prev.map((e) => (e.ticker === ticker ? { ...e, ivRank: null, loadingIV: false } : e)),
      );
    }
  };

  if (loading) return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 animate-pulse h-32" />
  );
  if (!entries.length) return null;

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-slate-300 uppercase tracking-wide">Earnings Screener</span>
        <span className="text-[10px] text-slate-500">Click ticker to load IV Rank</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-[10px] text-slate-500 border-b border-slate-800">
              <th className="text-left py-1 pr-3 font-normal">Ticker</th>
              <th className="text-left py-1 pr-3 font-normal">Date</th>
              <th className="text-left py-1 pr-3 font-normal">When</th>
              <th className="text-left py-1 pr-3 font-normal">Exp. Move</th>
              <th className="text-left py-1 font-normal">IV Rank</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {entries.map((e) => (
              <tr key={`${e.ticker}-${e.date}`} className="hover:bg-slate-800/30 transition-colors">
                <td className="py-1.5 pr-3">
                  <button
                    className="font-mono font-semibold text-blue-400 hover:text-blue-300 transition-colors"
                    onClick={() => e.ivRank === undefined && !e.loadingIV && loadIV(e.ticker)}
                    title="Load IV Rank"
                  >
                    {e.ticker}
                  </button>
                </td>
                <td className="py-1.5 pr-3 text-slate-400 font-mono">{e.date.slice(5)}</td>
                <td className="py-1.5 pr-3 text-slate-500">{hourLabel(e.hour)}</td>
                <td className="py-1.5 pr-3 text-slate-400">
                  {e.loadingIV ? (
                    <span className="text-[10px] text-slate-600">loading…</span>
                  ) : e.expectedMove !== undefined && e.expectedMove !== null ? (
                    <span className="text-amber-400 font-mono">±{e.expectedMove}%</span>
                  ) : (
                    <span className="text-slate-600">—</span>
                  )}
                </td>
                <td className="py-1.5">
                  {e.loadingIV ? (
                    <span className="text-[10px] text-slate-600">…</span>
                  ) : (
                    <IVBadge ivRank={e.ivRank} />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
