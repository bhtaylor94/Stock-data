'use client';

import React, { useMemo, useState } from 'react';

export type ViewKey = 'feed' | 'stock' | 'options' | 'tracker' | 'alerts' | 'backtest' | 'greeks';

const VIEW_META: Array<{ key: ViewKey; label: string; icon: string; desc: string }> = [
  { key: 'feed', label: 'AI Feed', icon: '🤖', desc: 'High-confidence opportunities ranked by quality gates.' },
  { key: 'stock', label: 'Stock', icon: '📈', desc: 'Fundamentals + technicals + news + earnings → decision.' },
  { key: 'options', label: 'Options', icon: '🧠', desc: 'Unusual activity + contract quality → calls/puts picks.' },
  { key: 'tracker', label: 'Portfolio', icon: '🗂️', desc: 'Positions, evidence packets, and tracked ideas.' },
  { key: 'alerts', label: 'Alerts', icon: '🔔', desc: 'Rule-based alerts and scans that actually fire.' },
  { key: 'backtest', label: 'Backtest', icon: '🧪', desc: 'Validate strategy logic over historical regimes.' },
  { key: 'greeks', label: 'Greeks', icon: 'Δ', desc: 'Portfolio-level options exposure and risk.' },
];

// Curated "fast picks" by industry. Keep small + liquid; expand later.
const INDUSTRY_WALL: Record<string, string[]> = {
  'Mega Cap': ['AAPL','MSFT','NVDA','AMZN','GOOGL','META'],
  'Financials': ['JPM','BAC','GS','MS','V','MA'],
  'Energy': ['XOM','CVX','COP','SLB'],
  'Healthcare': ['UNH','JNJ','PFE','LLY','MRK'],
  'Consumer': ['WMT','COST','HD','NKE','MCD'],
  'ETFs': ['SPY','QQQ','IWM','DIA','VTI','VOO','XLK','XLF','XLE','XLV'],
};

function classNames(parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

export function AppShell(props: {
  active: ViewKey;
  onNavigate: (v: ViewKey) => void;
  ticker: string;
  onTickerChange: (v: string) => void;
  onTickerSubmit: () => void;
  quickTickers: string[];
  onQuickPick: (t: string) => void;
  rightPanel?: React.ReactNode;
  children: React.ReactNode;
}) {
  const meta = useMemo(() => VIEW_META.find((v) => v.key === props.active), [props.active]);
  const [wallOpen, setWallOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-950 to-slate-900 text-slate-100">
      {/* Desktop shell */}
      <div className="hidden md:flex min-h-screen">
        <aside className="w-72 shrink-0 border-r border-white/10 bg-white/[0.02] backdrop-blur-2xl">
          <div className="p-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-blue-500/30 to-emerald-500/20 border border-white/10 flex items-center justify-center">
                <span className="text-lg">⚡</span>
              </div>
              <div>
                <div className="text-sm font-semibold text-white">AI Hedge Fund</div>
                <div className="text-xs text-slate-400">Accuracy-first trade intelligence</div>
              </div>
            </div>

            <div className="mt-5">
              <div className="text-xs font-semibold text-slate-400 mb-2">Command</div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🔎</span>
                  <input
                    value={props.ticker}
                    onChange={(e) => props.onTickerChange(e.target.value.toUpperCase())}
                    onKeyDown={(e) => (e.key === 'Enter' ? props.onTickerSubmit() : null)}
                    placeholder="Type ticker (e.g. AAPL)"
                    className="w-full bg-transparent outline-none text-sm text-white placeholder:text-slate-500"
                  />
                  <button
                    onClick={props.onTickerSubmit}
                    className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-xs font-semibold"
                  >
                    Load
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {props.quickTickers.map((t) => (
                    <button
                      key={t}
                      onClick={() => props.onQuickPick(t)}
                      className="px-2.5 py-1 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-slate-200"
                      title={`Load ${t}`}
                    >
                      {t}
                    </button>
                  ))}
                </div>

                <div className="mt-3">
                  <button
                    onClick={() => setWallOpen(!wallOpen)}
                    className="w-full px-3 py-2 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-slate-200 flex items-center justify-between"
                    title="Curated industry tickers"
                  >
                    <span>Industry Wall</span>
                    <span className="text-slate-400">{wallOpen ? '▾' : '▸'}</span>
                  </button>
                  {wallOpen ? (
                    <div className="mt-2 space-y-2">
                      {Object.keys(INDUSTRY_WALL).map((k) => (
                        <div key={k} className="rounded-2xl border border-white/10 bg-white/[0.02] p-3">
                          <div className="text-[11px] font-semibold text-slate-400">{k}</div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {INDUSTRY_WALL[k].map((t) => (
                              <button
                                key={t}
                                onClick={() => props.onQuickPick(t)}
                                className="px-2.5 py-1 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-slate-200"
                              >
                                {t}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="mt-6">
              <div className="text-xs font-semibold text-slate-400 mb-2">Workspace</div>
              <nav className="space-y-1">
                {VIEW_META.map((v) => (
                  <button
                    key={v.key}
                    onClick={() => props.onNavigate(v.key)}
                    className={classNames([
                      'w-full text-left px-3 py-2 rounded-xl border text-sm transition',
                      props.active === v.key
                        ? 'bg-white/10 border-white/20 text-white'
                        : 'bg-transparent border-transparent hover:bg-white/5 hover:border-white/10 text-slate-300',
                    ])}
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-6 inline-flex justify-center">{v.icon}</span>
                      <span className="font-semibold">{v.label}</span>
                    </div>
                    <div className="text-xs text-slate-500 pl-8 mt-0.5">{v.desc}</div>
                  </button>
                ))}
              </nav>
            </div>
          </div>
        </aside>

        <main className="flex-1 min-w-0">
          <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/60 backdrop-blur-2xl">
            <div className="px-6 py-4 flex items-center justify-between">
              <div>
                <div className="text-sm text-slate-400">Active</div>
                <div className="text-xl font-bold text-white flex items-center gap-2">
                  <span>{meta?.icon}</span>
                  <span>{meta?.label}</span>
                  <span className="text-slate-500">•</span>
                  <span className="text-slate-200">{props.ticker || '—'}</span>
                </div>
              </div>
              <div className="text-xs text-slate-400">
                Quality bar: prefer fewer, higher-confidence calls.
              </div>
            </div>
          </header>

          <div className="px-6 py-6">
            <div className="grid grid-cols-12 gap-6">
              <div className={classNames(['col-span-12', props.rightPanel ? 'lg:col-span-8' : 'lg:col-span-12'])}>
                {props.children}
              </div>
              {props.rightPanel ? (
                <div className="col-span-12 lg:col-span-4">
                  {props.rightPanel}
                </div>
              ) : null}
            </div>
          </div>
        </main>
      </div>

      {/* Mobile shell */}
      <div className="md:hidden min-h-screen">
        <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/70 backdrop-blur-2xl">
          <div className="px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">AI Hedge Fund</div>
              <div className="text-xs text-slate-400">{props.ticker || '—'}</div>
            </div>
            <div className="mt-3 flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2">
              <span>🔎</span>
              <input
                value={props.ticker}
                onChange={(e) => props.onTickerChange(e.target.value.toUpperCase())}
                onKeyDown={(e) => (e.key === 'Enter' ? props.onTickerSubmit() : null)}
                placeholder="Ticker"
                className="w-full bg-transparent outline-none text-sm text-white placeholder:text-slate-500"
              />
              <button
                onClick={props.onTickerSubmit}
                className="px-3 py-1.5 rounded-xl bg-white/10 border border-white/10 text-xs font-semibold"
              >
                Load
              </button>
            </div>
            <div className="mt-3 flex gap-2 overflow-x-auto no-scrollbar">
              {props.quickTickers.map((t) => (
                <button
                  key={t}
                  onClick={() => props.onQuickPick(t)}
                  className="shrink-0 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-semibold"
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </header>

        <div className="px-4 py-4">{props.children}</div>

        <nav className="sticky bottom-0 z-40 border-t border-white/10 bg-slate-950/70 backdrop-blur-2xl">
          <div className="grid grid-cols-4">
            {VIEW_META.slice(0, 4).map((v) => (
              <button
                key={v.key}
                onClick={() => props.onNavigate(v.key)}
                className={classNames([
                  'py-3 text-center',
                  props.active === v.key ? 'text-white' : 'text-slate-400',
                ])}
              >
                <div className="text-lg">{v.icon}</div>
                <div className="text-[10px] font-semibold">{v.label}</div>
              </button>
            ))}
          </div>
        </nav>
      </div>
    </div>
  );
}
