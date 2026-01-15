'use client';

import React, { useEffect, useMemo, useState } from 'react';
import SimpleLineChart from '@/app/components/charts/SimpleLineChart';

type RangeKey = '1D' | '1W' | '1M' | '3M' | 'YTD' | '1Y' | '5Y';
type Candle = { time: number; open: number; high: number; low: number; close: number; volume?: number };

async function fetchCandles(symbol: string, range: RangeKey, signal?: AbortSignal): Promise<Candle[]> {
  const qs = new URLSearchParams({ symbol, range });
  const res = await fetch(`/api/market/candles?${qs.toString()}`, { signal });
  const data = await res.json();
  if (!res.ok || !data?.ok) return [];
  return Array.isArray(data?.candles) ? data.candles : [];
}

export default function LiveCandlesCard({ symbol }: { symbol: string }) {
  const [range, setRange] = useState<RangeKey>('1D');
  const [candles, setCandles] = useState<Candle[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  const pollMs = range === '1D' || range === '1W' ? 15000 : 60000;

  useEffect(() => {
    if (!symbol) return;
    let mounted = true;
    const ac = new AbortController();

    const run = async () => {
      try {
        setLoading(true);
        setError('');
        const rows = await fetchCandles(symbol, range, ac.signal);
        if (!mounted) return;
        setCandles(rows);
        setLoading(false);
      } catch (e: any) {
        if (!mounted) return;
        setLoading(false);
        setError('Failed to load chart candles');
      }
    };

    run();
    const t = setInterval(run, pollMs);
    return () => {
      mounted = false;
      ac.abort();
      clearInterval(t);
    };
  }, [symbol, range, pollMs]);

  const values = useMemo(() => {
    return (candles || [])
      .filter((c) => Number.isFinite(c.close) && c.time > 0)
      .map((c) => ({ t: c.time, v: c.close }));
  }, [candles]);

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/20 p-3">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <div className="text-xs text-slate-400">Live chart</div>
          <div className="text-sm font-semibold text-white">{symbol}</div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-1">
          {(['1D','1W','1M','3M','YTD','1Y','5Y'] as RangeKey[]).map((k) => (
            <button
              key={k}
              onClick={() => setRange(k)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition ${
                range === k
                  ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-100'
                  : 'border-slate-700 bg-slate-950/30 text-slate-300 hover:bg-slate-800/40'
              }`}
            >
              {k}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <div className="p-3 rounded-xl border border-red-500/30 bg-red-500/10 text-xs text-red-200">{error}</div>
      ) : (
        <div className="relative">
          {loading && (
            <div className="absolute right-2 top-2 text-[11px] text-slate-400">Updating…</div>
          )}
          <SimpleLineChart values={values} height={240} className="p-0 border-0 bg-transparent" />
        </div>
      )}

      <div className="mt-2 text-[11px] text-slate-500">
        Updates {range === '1D' || range === '1W' ? 'every 15s' : 'every 60s'} • Source: Schwab pricehistory
      </div>
    </div>
  );
}
