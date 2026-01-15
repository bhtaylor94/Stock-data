'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { TradePlanDrawer, type TradePlan } from '@/app/components/core/TradePlanDrawer';

type PresetId = 'conservative' | 'balanced' | 'aggressive';

type Signal = {
  symbol: string;
  instrument: 'STOCK' | 'OPTION';
  action: 'BUY' | 'SELL' | 'NO_TRADE';
  confidence: number;
  strategyId: string;
  strategyName: string;
  why: string[];
  invalidation: string;
  tradePlan: {
    entry?: number | string;
    stop?: number | string;
    target?: number | string;
    horizon?: string;
  };
  evidencePacketId?: string;
};

type StrategySpec = {
  id: string;
  name: string;
  shortDescription: string;
  marketRegimes: string[];
  horizon: string;
  presets: Array<{
    id: PresetId;
    name: string;
    description: string;
    editableInPaper: boolean;
    lockedInLive: boolean;
  }>;
};

const DEFAULT_SYMBOLS = ['SPY', 'QQQ', 'AAPL', 'MSFT', 'NVDA', 'AMZN', 'META', 'TSLA', 'GOOGL', 'AMD'];

function badgeForAction(action: Signal['action']) {
  if (action === 'BUY') return 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300';
  if (action === 'SELL') return 'bg-red-500/10 border-red-500/30 text-red-300';
  return 'bg-slate-700/20 border-slate-600/30 text-slate-300';
}

export function SignalsFeed() {
  const [strategies, setStrategies] = useState<StrategySpec[]>([]);
  const [loadingRegistry, setLoadingRegistry] = useState(true);

  const [symbolsInput, setSymbolsInput] = useState(DEFAULT_SYMBOLS.join(','));
  const [presetId, setPresetId] = useState<PresetId>('balanced');
  const [minConfidence, setMinConfidence] = useState(60);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const [loadingSignals, setLoadingSignals] = useState(false);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [error, setError] = useState<string>('');
  const [lastUpdate, setLastUpdate] = useState<number>(0);
  const [now, setNow] = useState(Date.now());

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTitle, setDrawerTitle] = useState<string>('');
  const [drawerPlan, setDrawerPlan] = useState<TradePlan>({});

  const symbols = useMemo(() => {
    return symbolsInput
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean)
      .slice(0, 25);
  }, [symbolsInput]);

  const grouped = useMemo(() => {
    const by: Record<string, { strategyName: string; items: Signal[] }> = {};
    for (const s of signals) {
      if (!by[s.strategyId]) by[s.strategyId] = { strategyName: s.strategyName, items: [] };
      by[s.strategyId].items.push(s);
    }
    for (const k of Object.keys(by)) {
      by[k].items.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
    }
    return by;
  }, [signals]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let mounted = true;
    setLoadingRegistry(true);
    fetch('/api/strategies/registry')
      .then((r) => r.json())
      .then((d) => {
        if (!mounted) return;
        setStrategies(Array.isArray(d?.strategies) ? d.strategies : []);
        setLoadingRegistry(false);
      })
      .catch(() => {
        if (!mounted) return;
        setStrategies([]);
        setLoadingRegistry(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const fetchSignals = async () => {
    try {
      setLoadingSignals(true);
      setError('');
      const qs = new URLSearchParams({
        symbols: symbols.join(','),
        presetId,
        minConfidence: String(minConfidence),
      });
      const res = await fetch(`/api/signals?${qs.toString()}`);
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        setSignals([]);
        setError(data?.error || 'Failed to load signals');
      } else {
        const rows: Signal[] = Array.isArray(data?.signals) ? data.signals : [];
        rows.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
        setSignals(rows);
        setLastUpdate(Date.now());
      }
    } catch {
      setSignals([]);
      setError('Failed to load signals');
    } finally {
      setLoadingSignals(false);
    }
  };

  useEffect(() => {
    fetchSignals();
    if (!autoRefresh) return;
    const t = setInterval(fetchSignals, 60000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetId, minConfidence, symbolsInput, autoRefresh]);

  const openPlan = (sig: Signal) => {
    setDrawerTitle(`${sig.symbol} • ${sig.strategyName} • ${sig.action}`);
    const why = (sig.why || []).slice(0, 3);
    const inv = sig.invalidation ? [`Invalidation: ${sig.invalidation}`] : [];
    setDrawerPlan({
      entry: sig.tradePlan?.entry,
      stop: sig.tradePlan?.stop,
      target: sig.tradePlan?.target,
      horizon: sig.tradePlan?.horizon,
      why: [...why, ...inv],
    });
    setDrawerOpen(true);
  };

  const strategyOrder = useMemo(() => {
    const ids = strategies.map((s) => s.id);
    // fallback: stable ordering if registry hasn't loaded
    return ids.length ? ids : Object.keys(grouped);
  }, [strategies, grouped]);

  if (loadingRegistry) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl md:text-2xl font-bold text-white">📡 Signals</h2>
            <p className="text-xs md:text-sm text-slate-400 mt-1">
              Strategy-first signals • Last updated{' '}
              {lastUpdate ? `${Math.floor((now - lastUpdate) / 1000)}s ago` : '—'}
              {autoRefresh ? ' • Auto-refresh every 60s' : ''}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchSignals}
              className="p-2 rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700 transition-colors"
              title="Refresh"
            >
              <span className="text-lg">🔄</span>
            </button>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-slate-400 block mb-1">Symbols (comma separated)</label>
              <input
                value={symbolsInput}
                onChange={(e) => setSymbolsInput(e.target.value)}
                placeholder="SPY,QQQ,AAPL"
                className="w-full px-3 py-2 rounded-lg bg-slate-900/40 border border-slate-700 text-slate-100 text-sm outline-none focus:border-blue-500/60"
              />
              <div className="mt-2 flex flex-wrap gap-2">
                {DEFAULT_SYMBOLS.slice(0, 6).map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      const next = new Set(symbols);
                      next.add(s);
                      setSymbolsInput(Array.from(next).join(','));
                    }}
                    className="px-2.5 py-1 rounded-lg border border-slate-700 bg-slate-900/20 text-xs text-slate-200 hover:bg-slate-800/40"
                  >
                    + {s}
                  </button>
                ))}
                <button
                  onClick={() => setSymbolsInput(DEFAULT_SYMBOLS.join(','))}
                  className="px-2.5 py-1 rounded-lg border border-blue-500/30 bg-blue-500/10 text-xs text-blue-300 hover:bg-blue-500/20"
                >
                  Reset
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1">Preset</label>
              <select
                value={presetId}
                onChange={(e) => setPresetId(e.target.value as PresetId)}
                className="w-full px-3 py-2 rounded-lg bg-slate-900/40 border border-slate-700 text-slate-100 text-sm"
              >
                <option value="conservative">Conservative (locked for live)</option>
                <option value="balanced">Balanced (locked for live)</option>
                <option value="aggressive">Aggressive (locked for live)</option>
              </select>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-xs text-slate-400">Min confidence: {minConfidence}%</span>
                <label className="flex items-center gap-2 text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={autoRefresh}
                    onChange={(e) => setAutoRefresh(e.target.checked)}
                  />
                  Auto-refresh
                </label>
              </div>
              <input
                type="range"
                min="40"
                max="95"
                step="5"
                value={minConfidence}
                onChange={(e) => setMinConfidence(parseInt(e.target.value))}
                className="w-full"
              />
            </div>

            <div>
              <div className="text-xs text-slate-400 mb-1">What you’re seeing</div>
              <div className="rounded-xl border border-slate-700 bg-slate-950/30 p-3">
                <div className="text-sm text-slate-200 font-semibold">Strategy-first output</div>
                <div className="mt-1 text-xs text-slate-400 leading-relaxed">
                  Signals are grouped by strategy. Click any signal to open its Trade Plan drawer (entry/stop/target + why + invalidation).
                </div>
              </div>
            </div>
          </div>
        </div>

        {error ? (
          <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
            ⚠️ {error}
          </div>
        ) : null}

        {loadingSignals ? (
          <div className="flex items-center justify-center py-10">
            <div className="w-7 h-7 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-5">
            {strategyOrder.map((sid) => {
              const bucket = grouped[sid];
              const strat = strategies.find((s) => s.id === sid);
              const title = strat?.name || bucket?.strategyName || sid;
              const items = bucket?.items || [];
              return (
                <div key={sid} className="rounded-2xl border border-slate-800 bg-slate-900/20">
                  <div className="p-4 border-b border-slate-800 flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-bold text-white">{title}</div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        {strat?.shortDescription || 'Strategy signals'}
                      </div>
                    </div>
                    <div className="text-xs text-slate-400">{items.length} signals</div>
                  </div>

                  {items.length === 0 ? (
                    <div className="p-4 text-sm text-slate-500">No qualifying signals right now.</div>
                  ) : (
                    <div className="p-3 space-y-2">
                      {items.map((sig) => (
                        <button
                          key={`${sid}-${sig.symbol}-${sig.action}-${sig.confidence}`}
                          onClick={() => openPlan(sig)}
                          className="w-full text-left rounded-xl border border-slate-800 bg-slate-950/30 hover:bg-slate-900/30 transition p-3"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <div className="text-sm font-semibold text-white">{sig.symbol}</div>
                              <div className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${badgeForAction(sig.action)}`}>
                                {sig.action}
                              </div>
                            </div>
                            <div className="text-xs text-slate-300">
                              <span className="font-semibold">{Math.round(sig.confidence || 0)}%</span>
                            </div>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {(sig.why || []).slice(0, 3).map((w, i) => (
                              <span
                                key={i}
                                className="px-2 py-1 rounded-lg border border-slate-800 bg-slate-900/20 text-[11px] text-slate-200"
                              >
                                {w}
                              </span>
                            ))}
                          </div>
                          <div className="mt-2 text-[11px] text-slate-400">
                            Entry {sig.tradePlan?.entry ?? '—'} • Stop {sig.tradePlan?.stop ?? '—'} • Target {sig.tradePlan?.target ?? '—'}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <TradePlanDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={drawerTitle}
        plan={drawerPlan}
      />
    </>
  );
}
