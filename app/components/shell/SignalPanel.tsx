'use client';

import React, { useEffect, useMemo, useState } from 'react';

function badgeClass(kind: 'good' | 'warn' | 'bad') {
  if (kind === 'good') return 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300';
  if (kind === 'warn') return 'bg-amber-500/10 border-amber-500/30 text-amber-300';
  return 'bg-rose-500/10 border-rose-500/30 text-rose-300';
}

type StockMeta = {
  asOf?: string;
  quoteAgeMs?: number;
  isStale?: boolean;
  regime?: string;
  atrPct?: number;
  trendStrength?: number;
  tradeDecision?: { action?: string; confidence?: number; confidenceBucket?: string; calibrationVersion?: string; rationale?: string[] };
  warnings?: { news?: string | null; technicals?: string | null };
};

export function SignalPanel({ ticker }: { ticker: string }) {
  const [loading, setLoading] = useState(false);
  const [meta, setMeta] = useState<StockMeta | null>(null);
  const [name, setName] = useState<string>('');
  const [price, setPrice] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;
    async function run() {
      if (!ticker) return;
      setLoading(true);
      try {
        const res = await fetch(`/api/stock/${ticker}`, { cache: 'no-store' });
        const data = await res.json();
        if (!mounted) return;
        setMeta(data?.meta || null);
        setName(String(data?.name || ''));
        setPrice(typeof data?.price === 'number' ? data.price : null);
      } catch {
        if (!mounted) return;
        setMeta(null);
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    }
    run();
    const t = setInterval(run, 30000);
    return () => {
      mounted = false;
      clearInterval(t);
    };
  }, [ticker]);

  const decision = meta?.tradeDecision;
  const freshnessKind: 'good' | 'warn' | 'bad' = !ticker
    ? 'warn'
    : meta?.isStale
      ? 'bad'
      : (meta?.quoteAgeMs ?? 0) > 30_000
        ? 'warn'
        : 'good';

  const decisionKind: 'good' | 'warn' | 'bad' = useMemo(() => {
    const a = String(decision?.action || '');
    if (!a) return 'warn';
    if (a === 'NO_TRADE') return 'bad';
    if (a.includes('BUY') || a.includes('SELL')) return 'good';
    return 'warn';
  }, [decision?.action]);

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-2xl shadow-2xl overflow-hidden">
      <div className="p-5 border-b border-white/10">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs text-slate-400">Signal Stack</div>
            <div className="text-lg font-bold text-white mt-0.5">{ticker || 'Select a ticker'}</div>
            {name ? <div className="text-xs text-slate-500 mt-0.5">{name}</div> : null}
          </div>
          {typeof price === 'number' ? (
            <div className="text-right">
              <div className="text-xs text-slate-400">Price</div>
              <div className="text-lg font-bold">${price.toFixed(2)}</div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="p-5 space-y-4">
        {loading ? (
          <div className="text-sm text-slate-400">Loading…</div>
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          <div className={`rounded-2xl border px-3 py-2 ${badgeClass(freshnessKind)}`}>
            <div className="text-[11px] font-semibold">Freshness</div>
            <div className="text-xs mt-1">
              {meta?.isStale ? 'Stale quote' : 'OK'}
              {typeof meta?.quoteAgeMs === 'number' ? ` • ${(meta.quoteAgeMs / 1000).toFixed(0)}s` : ''}
            </div>
          </div>
          <div className={`rounded-2xl border px-3 py-2 ${badgeClass(decisionKind)}`}>
            <div className="text-[11px] font-semibold">Decision</div>
            <div className="text-xs mt-1">
              {decision?.action || '—'}
              {typeof decision?.confidence === 'number' ? ` • ${Math.round(decision.confidence)}%` : ''}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold text-slate-200">Regime</div>
            <div className="text-xs text-slate-400">{meta?.regime || '—'}</div>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-300">
            <div>ATR%: <span className="text-slate-100">{typeof meta?.atrPct === 'number' ? meta.atrPct : '—'}</span></div>
            <div>Trend: <span className="text-slate-100">{typeof meta?.trendStrength === 'number' ? meta.trendStrength : '—'}</span></div>
          </div>
        </div>

        {Array.isArray(decision?.rationale) && decision?.rationale.length ? (
          <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-4">
            <div className="text-xs font-semibold text-rose-200">Why NO_TRADE (quality gates)</div>
            <ul className="mt-2 space-y-1 text-xs text-rose-100/80">
              {decision.rationale.slice(0, 5).map((r, idx) => (
                <li key={idx}>• {r}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {meta?.warnings?.news || meta?.warnings?.technicals ? (
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
            <div className="text-xs font-semibold text-amber-200">Data warnings</div>
            <div className="mt-2 text-xs text-amber-100/80 space-y-1">
              {meta?.warnings?.news ? <div>• {meta.warnings.news}</div> : null}
              {meta?.warnings?.technicals ? <div>• {meta.warnings.technicals}</div> : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
