'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

type Preset = {
  id: string;
  name: string;
  description: string;
  editableInPaper: boolean;
  lockedInLive: boolean;
};

type StrategySpec = {
  id: string;
  name: string;
  shortDescription: string;
  marketRegimes: string[];
  horizon: string;
  entryTriggers: string[];
  confirmations: string[];
  disqualifiers: string[];
  invalidationRules: string[];
  riskModel: string[];
  positionLogic: string[];
  presets: Preset[];
};

function pill(text: string) {
  return (
    <span className="px-2 py-1 rounded-full border border-slate-800 bg-slate-950/30 text-[11px] text-slate-200">
      {text}
    </span>
  );
}

export function StrategyLibrary() {
  const [strategies, setStrategies] = useState<StrategySpec[]>([]);
  const [loading, setLoading] = useState(true);
  const [statsById, setStatsById] = useState<Record<string, any>>({});
  const [q, setQ] = useState('');

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    fetch('/api/strategies/registry')
      .then((r) => r.json())
      .then((d) => {
        if (!mounted) return;
        setStrategies(Array.isArray(d?.strategies) ? d.strategies : []);
        setLoading(false);
      })
      .catch(() => {
        if (!mounted) return;
        setStrategies([]);
        setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    fetch('/api/forward-stats')
      .then((r) => r.json())
      .then((d) => {
        if (!mounted) return;
        setStatsById(d?.statsByStrategy && typeof d.statsByStrategy === 'object' ? d.statsByStrategy : {});
      })
      .catch(() => {
        if (!mounted) return;
        setStatsById({});
      });
    return () => {
      mounted = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return strategies;
    return strategies.filter((x) => {
      return (
        x.name.toLowerCase().includes(s) ||
        x.id.toLowerCase().includes(s) ||
        (x.marketRegimes || []).join(' ').toLowerCase().includes(s) ||
        (x.shortDescription || '').toLowerCase().includes(s)
      );
    });
  }, [q, strategies]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-white">📚 Strategy Library</h2>
          <p className="text-xs md:text-sm text-slate-400 mt-1">
            Strategies are first-class objects. Each has explicit rules, disqualifiers, invalidation, and presets.
          </p>
        </div>
      </div>

      <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700">
        <label className="text-xs text-slate-400 block mb-1">Search</label>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Trend, breakout, range…"
          className="w-full px-3 py-2 rounded-lg bg-slate-900/40 border border-slate-700 text-slate-100 text-sm outline-none focus:border-blue-500/60"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {filtered.map((s) => (
          <div key={s.id} className="rounded-2xl border border-slate-800 bg-slate-900/20 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-lg font-bold text-white">{s.name}</div>
                <div className="text-xs text-slate-400 mt-1">{s.shortDescription}</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {pill(`Regime: ${(s.marketRegimes || []).join(', ') || '—'}`)}
                  {pill(`Horizon: ${s.horizon || '—'}`)}
                  {pill(`Presets: ${(s.presets || []).length}`)}
                  {(() => {
                    const st = statsById?.[s.id];
                    const n = typeof st?.sampleSize === 'number' ? st.sampleSize : null;
                    const wr = typeof st?.winRate === 'number' ? st.winRate : null;
                    const ar = typeof st?.avgR === 'number' ? st.avgR : null;
                    return (
                      <>
                        {pill(`Forward N: ${n !== null ? n : '—'}`)}
                        {pill(`Win: ${wr !== null ? `${wr}%` : '—'}`)}
                        {pill(`Avg R: ${ar !== null ? ar : '—'}`)}
                      </>
                    );
                  })()}
                </div>
              </div>

              <Link
                href={`/strategies/${encodeURIComponent(s.id)}`}
                className="px-3 py-2 rounded-xl border border-blue-500/30 bg-blue-500/10 text-blue-200 text-xs font-semibold hover:bg-blue-500/20"
              >
                View details →
              </Link>
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="rounded-xl border border-slate-800 bg-slate-950/30 p-3">
                <div className="text-xs font-semibold text-white">Entry triggers</div>
                <ul className="mt-2 list-disc pl-5 space-y-1 text-xs text-slate-200">
                  {(s.entryTriggers || []).slice(0, 3).map((x, i) => (
                    <li key={i}>{x}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/30 p-3">
                <div className="text-xs font-semibold text-white">Disqualifiers</div>
                <ul className="mt-2 list-disc pl-5 space-y-1 text-xs text-slate-200">
                  {(s.disqualifiers || []).slice(0, 3).map((x, i) => (
                    <li key={i}>{x}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950/20 p-3">
              <div className="text-xs font-semibold text-white">Presets (locked for live)</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {(s.presets || []).map((p) => (
                  <span
                    key={p.id}
                    className="px-2 py-1 rounded-lg border border-slate-800 bg-slate-900/20 text-[11px] text-slate-200"
                    title={p.description}
                  >
                    {p.name}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {!filtered.length ? (
        <div className="text-center py-10 text-slate-500">No strategies match your search.</div>
      ) : null}
    </div>
  );
}
