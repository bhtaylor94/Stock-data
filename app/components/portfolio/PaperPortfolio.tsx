'use client';
import React, { useEffect, useMemo, useState } from 'react';
import { getPaperTrades, removePaperTrade, PaperTrade } from '../../../lib/paperTrades';

export function PaperPortfolio() {
  const [trades, setTrades] = useState<PaperTrade[]>([]);

  const refresh = () => setTrades(getPaperTrades());

  useEffect(() => { refresh(); }, []);

  const hasTrades = trades.length > 0;

  const totals = useMemo(() => {
    // We only have entry prices reliably; current pricing is intentionally not faked here.
    const count = trades.length;
    const notional = trades.reduce((acc, t) => {
      const multiplier = t.instrument === 'OPTION' ? 100 : 1;
      return acc + (t.entryPrice || 0) * (t.quantity || 0) * multiplier;
    }, 0);
    return { count, notional };
  }, [trades]);

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/30 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-white">Paper Trades</div>
          <div className="text-xs text-slate-400">
            Track Trade creates a paper position instantly at current mid/last price (no broker).
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={refresh}
            className="px-3 py-2 rounded-lg border border-slate-700 bg-slate-800/40 text-slate-200 text-xs hover:bg-slate-800 transition"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-300">
        <span className="px-2 py-1 rounded bg-slate-800/60 border border-slate-700">Open: {totals.count}</span>
        <span className="px-2 py-1 rounded bg-slate-800/60 border border-slate-700">Notional (entry): ${totals.notional.toFixed(0)}</span>
      </div>

      {!hasTrades ? (
        <div className="mt-4 text-sm text-slate-400">
          No paper trades yet. Use <span className="text-slate-200 font-semibold">Track (Paper)</span> on a suggestion to start tracking.
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {trades.map((t) => (
            <div key={t.id} className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-white">
                    {(t.companyName && t.companyName !== t.symbol) ? t.companyName : t.symbol}
                    <span className="text-slate-400 font-normal"> ({t.symbol})</span>
                  </div>
                  <div className="mt-1 text-xs text-slate-300">
                    {t.instrument === 'OPTION' ? (
                      <>
                        <span className="font-semibold">{t.optionType}</span> • ${t.strike} • {t.expiration} • Qty {t.quantity} • Entry ${t.entryPrice.toFixed(2)} (${(t.entryPrice*100).toFixed(0)}/contract)
                      </>
                    ) : (
                      <>
                        <span className="font-semibold">{t.side}</span> • Qty {t.quantity} • Entry ${t.entryPrice.toFixed(2)}
                      </>
                    )}
                  </div>
                  {t.reasons && t.reasons.length > 0 && (
                    <ul className="mt-2 text-xs text-slate-400 list-disc pl-5 space-y-1">
                      {t.reasons.slice(0,3).map((r, idx) => <li key={idx}>{r}</li>)}
                    </ul>
                  )}
                  {t.invalidation && (
                    <div className="mt-2 text-xs text-amber-300">
                      Invalidation: <span className="text-slate-200">{t.invalidation}</span>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => { removePaperTrade(t.id); refresh(); }}
                  className="px-3 py-2 rounded-lg border border-red-900/60 bg-red-950/30 text-red-200 text-xs hover:bg-red-950/50 transition"
                  title="Remove from paper portfolio"
                >
                  Remove
                </button>
              </div>

              <div className="mt-2 text-[11px] text-slate-500">
                Tracked {new Date(t.createdAt).toLocaleString()}
                {typeof t.confidence === 'number' ? ` • Confidence ${t.confidence}/100` : ''}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
