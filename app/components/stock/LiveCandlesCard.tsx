'use client';

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { TradePlanDrawer, type TradePlan } from '@/app/components/core/TradePlanDrawer';

const CandlestickChart = dynamic(() => import('@/app/components/charts/CandlestickChart'), { ssr: false });

type RangeKey = '1D' | '1W' | '1M' | '3M' | 'YTD' | '1Y' | '5Y';
type Candle = { time: number; open: number; high: number; low: number; close: number; volume?: number };

type OverlayKey = 'EMA20' | 'EMA50' | 'VWAP' | 'BBANDS';

async function fetchCandles(symbol: string, range: RangeKey, signal?: AbortSignal): Promise<Candle[]> {
  const qs = new URLSearchParams({ symbol, range });
  const res = await fetch(`/api/market/candles?${qs.toString()}`, { signal });
  const data = await res.json();
  if (!res.ok || !data?.ok) return [];
  return Array.isArray(data?.candles) ? data.candles : [];
}

export default function LiveCandlesCard({
  symbol,
  tradePlan,
}: {
  symbol: string;
  tradePlan?: TradePlan | null;
}) {
  const [range, setRange] = useState<RangeKey>('1D');
  const [candles, setCandles] = useState<Candle[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  const [overlays, setOverlays] = useState<Record<OverlayKey, boolean>>({
    EMA20: true,
    EMA50: true,
    VWAP: true,
    BBANDS: true,
  });

  const [showRSI, setShowRSI] = useState(false);
  const [showMACD, setShowMACD] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);

  const plan: TradePlan | null = tradePlan || null;

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

      <div className="flex flex-wrap items-center gap-1.5 mb-2">
        {(
          [
            { k: 'EMA20' as const, label: 'EMA 20' },
            { k: 'EMA50' as const, label: 'EMA 50' },
            { k: 'VWAP' as const, label: 'VWAP' },
            { k: 'BBANDS' as const, label: 'Bollinger' },
          ]
        ).map((o) => (
          <button
            key={o.k}
            onClick={() => setOverlays((prev) => ({ ...prev, [o.k]: !prev[o.k] }))}
            className={`px-2 py-1 rounded-full text-[11px] font-semibold border transition ${
              overlays[o.k]
                ? 'border-slate-600 bg-slate-800/60 text-slate-100'
                : 'border-slate-800 bg-slate-950/30 text-slate-400 hover:bg-slate-900/30'
            }`}
            title="Toggle indicator overlay"
          >
            {o.label}
          </button>
        ))}

        <span className="mx-1 h-5 w-px bg-slate-800" />

        <button
          onClick={() => setShowRSI((p) => !p)}
          className={`px-2 py-1 rounded-full text-[11px] font-semibold border transition ${
            showRSI
              ? 'border-slate-600 bg-slate-800/60 text-slate-100'
              : 'border-slate-800 bg-slate-950/30 text-slate-400 hover:bg-slate-900/30'
          }`}
          title="Toggle RSI panel"
        >
          RSI
        </button>
        <button
          onClick={() => setShowMACD((p) => !p)}
          className={`px-2 py-1 rounded-full text-[11px] font-semibold border transition ${
            showMACD
              ? 'border-slate-600 bg-slate-800/60 text-slate-100'
              : 'border-slate-800 bg-slate-950/30 text-slate-400 hover:bg-slate-900/30'
          }`}
          title="Toggle MACD panel"
        >
          MACD
        </button>

        {plan ? (
          <button
            onClick={() => setPlanOpen(true)}
            className="ml-auto px-3 py-1 rounded-full text-[11px] font-semibold border border-emerald-500/30 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/15"
            title="View trade plan"
          >
            Trade plan
          </button>
        ) : null}
      </div>

      {error ? (
        <div className="p-3 rounded-xl border border-red-500/30 bg-red-500/10 text-xs text-red-200">{error}</div>
      ) : (
        <div className="relative">
          {loading && (
            <div className="absolute right-2 top-2 text-[11px] text-slate-400">Updating…</div>
          )}
          <CandlestickChart candles={candles} overlays={overlays} height={260} showRSI={showRSI} showMACD={showMACD} />
        </div>
      )}

      <div className="mt-2 text-[11px] text-slate-500">
        Updates {range === '1D' || range === '1W' ? 'every 15s' : 'every 60s'} • Source: Schwab pricehistory
      </div>

      {plan ? (
        <TradePlanDrawer
          isOpen={planOpen}
          onClose={() => setPlanOpen(false)}
          title={`${symbol} plan`}
          plan={plan}
        />
      ) : null}
    </div>
  );
}
