'use client';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  RefreshCw, Search, AlertTriangle, CheckCircle2,
} from 'lucide-react';

import { StockSetupCard } from './StockSetupCard';

// Deep-dive sub-components (same as original StockTab in page.tsx)
import { StockDecisionHero } from '@/app/components/stock/StockDecisionHero';
import { StockScoreBreakdown } from '@/app/components/stock/StockScoreBreakdown';
import { ConsensusSourcesList } from '@/app/components/stock/ConsensusSourcesList';
import { ChartPatternCard } from '@/app/components/stock/ChartPatternCard';
import { NarrativeCard } from '@/app/components/ai/NarrativeCard';
import { EarningsWidget } from '@/app/components/core/EarningsWidget';
import { PortfolioContextAlert } from '@/app/components/portfolio/PortfolioContextAlert';
import { StockChart } from '@/app/components/stock/StockChart';

// ── Setup type filters ────────────────────────────────────────────────────────

const SETUP_TYPES = [
  { id: 'all',          label: 'All'          },
  { id: 'bull-flag',    label: 'Bull Flag'    },
  { id: 'pullback-ma',  label: 'Pullback'     },
  { id: 'breakout',     label: 'Breakout'     },
  { id: 'higher-lows',  label: 'Higher Lows'  },
  { id: 'double-bottom',label: 'Double Bottom'},
  { id: 'bear-flag',    label: 'Bear Flag'    },
  { id: 'gap-up',       label: 'Gap Up'       },
];

// ── Small shared utilities ────────────────────────────────────────────────────

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

// ── DeepDiveContent: mirrors the original StockTab body ──────────────────────

function DeepDiveContent({
  data, ticker, onTrack, onViewEvidence, onTrade,
}: {
  data: any;
  ticker: string;
  onTrack?: (success: boolean, message: string) => void;
  onViewEvidence?: () => void;
  onTrade?: (symbol: string, price: number, action: 'BUY' | 'SELL' | 'HOLD', quantity: number) => void;
}) {
  const { analysis, suggestions, chartPatterns, technicals, fundamentals, news, analysts } = data;
  const candles = data.meta?.priceHistory?.candles as number | undefined;
  const ds = (data.dataSource ?? '') as string;

  return (
    <>
      {/* Data quality strip */}
      <div className="flex items-center gap-2 flex-wrap mb-3">
        {ds.startsWith('schwab') && !ds.includes('+finnhub') && (
          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border font-medium text-emerald-400 bg-emerald-500/10 border-emerald-500/20">
            ✓ Schwab Live
          </span>
        )}
        {ds === 'finnhub' && (
          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border font-medium text-amber-400 bg-amber-500/10 border-amber-500/20">
            ⚠ Finnhub Fallback
          </span>
        )}
        {ds.includes('+finnhub') && (
          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border font-medium text-blue-400 bg-blue-500/10 border-blue-500/20">
            ↔ Schwab + Finnhub
          </span>
        )}
        {data.meta?.isStale && (
          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border font-medium text-amber-400 bg-amber-500/10 border-amber-500/20">
            ⏱ Stale Quote
          </span>
        )}
        {candles != null && candles > 0 && candles < 200 && (
          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border font-medium text-amber-400 bg-amber-500/10 border-amber-500/20">
            ⚠ {candles} candles — SMA estimates
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4 animate-fade-in">
        {/* LEFT — sticky decision column */}
        <div className="space-y-3 lg:sticky lg:top-[100px] lg:self-start">
          <StockDecisionHero
            ticker={ticker}
            price={data.price || data.quote?.c || 0}
            analysis={{ ...analysis, changePercent: data.changePercent }}
            meta={data.meta}
            onTrack={() => {
              if (suggestions?.[0] && onTrack) {
                const sug = suggestions[0];
                fetch('/api/tracker', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    ticker,
                    type: sug.type === 'BUY' ? 'STOCK_BUY' : 'STOCK_SELL',
                    strategy: sug.strategy,
                    entryPrice: data.price || data.quote?.c,
                    confidence: sug.confidence || 0,
                    reasoning: sug.reasoning || [],
                    evidencePacket: data,
                  }),
                })
                  .then(r => r.json())
                  .then(result => onTrack(result.success, result.success ? `✓ Tracking ${ticker}` : result.error));
              }
            }}
            onViewEvidence={onViewEvidence}
            onTrade={onTrade ? () => onTrade(
              ticker,
              data.price || data.quote?.c || 0,
              data.meta?.tradeDecision?.action || 'BUY',
              1,
            ) : undefined}
          />
          <EarningsWidget ticker={ticker} />
          <StockScoreBreakdown analysis={analysis} />
        </div>

        {/* RIGHT — scrollable analysis column */}
        <div className="space-y-4">
          {/* Price chart — rendered when at least some candle data is available */}
          {(data.priceHistory?.length > 5) && (
            <StockChart
              priceHistory={data.priceHistory}
              ticker={ticker}
            />
          )}
          <NarrativeCard
            ticker={ticker}
            price={data.price || 0}
            changePercent={data.changePercent || 0}
            analysis={analysis}
            technicals={technicals}
          />

          {data.portfolioContext && (
            <PortfolioContextAlert portfolioContext={data.portfolioContext} />
          )}

          {data?.meta?.warnings?.technicals && (
            <div className="p-4 rounded-2xl border border-amber-500/30 bg-amber-500/5">
              <h3 className="text-sm font-semibold text-amber-300 mb-1">Limited technical data</h3>
              <p className="text-xs text-slate-300">{data.meta.warnings.technicals}</p>
              {data?.meta?.priceHistory && (
                <p className="text-[11px] text-slate-400 mt-1">
                  Candles: <span className="font-mono">{data.meta.priceHistory.candles}</span> · Source: <span className="font-mono">{data.meta.priceHistory.source}</span>
                </p>
              )}
            </div>
          )}

          {(!news?.headlines || news.headlines.length === 0) && data?.meta?.warnings?.news && (
            <div className="p-4 rounded-2xl border border-amber-500/30 bg-amber-500/5">
              <h3 className="text-sm font-semibold text-amber-300 mb-1">News unavailable</h3>
              <p className="text-xs text-slate-300">{data.meta.warnings.news}</p>
              <p className="text-xs text-slate-400 mt-1">
                Set <span className="font-mono">FINNHUB_API_KEY</span> in Vercel and redeploy.
              </p>
            </div>
          )}

          {news?.headlines?.length > 0 && (
            <div className="p-4 rounded-2xl border border-slate-700/50 bg-slate-800/30">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-white">Recent News</h3>
                <button onClick={onViewEvidence} className="text-xs text-slate-300 hover:text-white underline underline-offset-2">
                  View in Evidence
                </button>
              </div>
              <div className="space-y-2">
                {news.headlines.slice(0, 8).map((item: any, i: number) => (
                  <div key={i} className="p-3 rounded-xl bg-slate-900/40 border border-slate-700/40">
                    <div className="text-sm text-white">{item.headline || item.title || 'Headline'}</div>
                    <div className="mt-1 text-xs text-slate-400 flex items-center gap-2">
                      <span>{item.source || ''}</span>
                      <span className="opacity-50">·</span>
                      <span>{(() => {
                        const dt = item.datetime;
                        if (!dt) return '';
                        if (typeof dt === 'number') return new Date(dt * 1000).toLocaleDateString();
                        const d = new Date(dt);
                        return isNaN(d.getTime()) ? '' : d.toLocaleDateString();
                      })()}</span>
                      {item.url && (
                        <>
                          <span className="opacity-50">·</span>
                          <a className="underline underline-offset-2 hover:text-white" href={item.url} target="_blank" rel="noreferrer">Open</a>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <ConsensusSourcesList
            fundamentals={fundamentals}
            technicals={technicals}
            news={news}
            analysts={analysts}
            chartPatterns={chartPatterns}
          />

          <ChartPatternCard chartPatterns={chartPatterns} />

          {suggestions && suggestions.length > 0 && (
            <div className="p-4 rounded-2xl border border-slate-700/50 bg-slate-800/30">
              <h3 className="text-sm font-semibold text-white mb-3">Recommendations</h3>
              <div className="space-y-2">
                {suggestions.slice(0, 3).map((sug: any, i: number) => (
                  <div key={i} className={`p-3 rounded-xl border ${
                    sug.type === 'BUY'  ? 'border-emerald-500/30 bg-emerald-500/5' :
                    sug.type === 'SELL' ? 'border-red-500/30 bg-red-500/5' :
                    'border-amber-500/30 bg-amber-500/5'
                  } transition-all duration-200`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-white">{sug.strategy}</span>
                      {sug.confidence && (
                        <span className="text-xs px-2 py-0.5 rounded bg-slate-700 text-slate-300">
                          {sug.confidence}% confidence
                        </span>
                      )}
                    </div>
                    {sug.reasoning?.slice(0, 2).map((r: string, j: number) => (
                      <p key={j} className="text-xs text-slate-400">• {r}</p>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ── StocksTab ─────────────────────────────────────────────────────────────────

export function StocksTab({
  data,
  loading,
  ticker,
  onTrack,
  onViewEvidence,
  onTrade,
  onSearch,
}: {
  data: any;
  loading: boolean;
  ticker: string;
  onTrack?: (success: boolean, message: string) => void;
  onViewEvidence?: () => void;
  onTrade?: (symbol: string, price: number, action: 'BUY' | 'SELL' | 'HOLD', quantity: number) => void;
  onSearch?: (symbol: string) => void;
}) {
  const [outlookFilter, setOutlookFilter] = useState<'all' | 'bullish' | 'bearish'>('all');
  const [setupFilter, setSetupFilter]     = useState('all');
  const [setupsData, setSetupsData]       = useState<any>(null);
  const [setupsLoading, setSetupsLoading] = useState(true);
  const [lastUpdated, setLastUpdated]     = useState<Date | null>(null);
  const [searchInput, setSearchInput]     = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  const fetchSetups = async () => {
    setSetupsLoading(true);
    try {
      const res = await fetch('/api/stock-setups');
      const d   = await res.json();
      setSetupsData(d);
      setLastUpdated(new Date());
    } catch { /* silently ignore */ }
    setSetupsLoading(false);
  };

  useEffect(() => {
    fetchSetups();
    const interval = setInterval(fetchSetups, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Pre-fill search box if a ticker is already loaded via global search
  useEffect(() => {
    if (ticker) setSearchInput(ticker);
  }, [ticker]);

  const displayed = useMemo(() => {
    let list: any[] = setupsData?.setups ?? [];
    if (outlookFilter !== 'all') list = list.filter(r => r.setup.outlook === outlookFilter);
    if (setupFilter  !== 'all') list = list.filter(r => r.setup.id    === setupFilter);
    return list;
  }, [setupsData, outlookFilter, setupFilter]);

  const secAgo = lastUpdated ? Math.round((Date.now() - lastUpdated.getTime()) / 1000) : null;

  const handleDeepDiveSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const sym = searchInput.trim().toUpperCase();
    if (sym && onSearch) onSearch(sym);
  };

  return (
    <div className="space-y-5 animate-fade-in">

      {/* ═══════════════════════════════════════════════════════════
          SECTION 1 — SETUP SCANNER
      ══════════════════════════════════════════════════════════ */}

      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-base font-bold text-white">Stock Setup Scanner</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            35 stocks · {secAgo != null ? `updated ${secAgo}s ago` : 'loading…'}
          </p>
        </div>
        <button
          onClick={fetchSetups}
          disabled={setupsLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 bg-slate-700/60 hover:bg-slate-700 transition disabled:opacity-50"
        >
          <RefreshCw size={12} className={setupsLoading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Outlook filter */}
      <div className="flex gap-2 flex-wrap">
        {[
          { id: 'all',     label: 'All Setups' },
          { id: 'bullish', label: '📈 Bullish'  },
          { id: 'bearish', label: '📉 Bearish'  },
        ].map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setOutlookFilter(id as 'all' | 'bullish' | 'bearish')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              outlookFilter === id
                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                : 'text-slate-400 bg-slate-800/40 border border-slate-700/40 hover:text-slate-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Setup type pills */}
      <div className="flex gap-1.5 flex-wrap">
        {SETUP_TYPES.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setSetupFilter(id)}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
              setupFilter === id
                ? 'bg-slate-600 text-white'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Summary line */}
      {!setupsLoading && setupsData && (
        <p className="text-xs text-slate-500">
          {displayed.length} setup{displayed.length !== 1 ? 's' : ''} found
          {displayed.length > 0 && ` · Strongest: ${displayed[0].setup.name} on ${displayed[0].ticker}`}
        </p>
      )}

      {/* Setup cards */}
      {setupsLoading ? (
        <LoadingSpinner />
      ) : displayed.length === 0 ? (
        <div className="text-center py-12 text-slate-500 text-sm">
          No setups match current filters
        </div>
      ) : (
        <div className="space-y-2">
          {displayed.map((r: any) => (
            <StockSetupCard key={r.ticker} result={r} />
          ))}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
          DIVIDER
      ══════════════════════════════════════════════════════════ */}
      <div className="relative py-2">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-slate-700/50" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="px-4 text-slate-500 bg-[#0a0f1e]">── Full Stock Analysis ──</span>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          SECTION 2 — DEEP DIVE
      ══════════════════════════════════════════════════════════ */}

      {/* Search bar */}
      <form onSubmit={handleDeepDiveSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          <input
            ref={searchRef}
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value.toUpperCase())}
            placeholder="Search ticker for deep analysis…"
            className="w-full pl-8 pr-4 py-2 rounded-lg text-sm bg-slate-800/60 border border-slate-700/50 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <button
          type="submit"
          disabled={!searchInput.trim()}
          className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Analyze
        </button>
      </form>

      {/* Deep dive content */}
      {loading && <LoadingSpinner />}

      {!loading && !data && (
        <p className="text-slate-500 text-center py-12 text-sm">
          Enter a ticker symbol above to run a full analysis
        </p>
      )}

      {!loading && data?.error && (
        <div className="p-6 rounded-2xl border border-red-500/30 bg-red-500/5 animate-fade-in">
          <h3 className="text-lg font-semibold text-red-400 mb-3 flex items-center gap-1.5">
            <AlertTriangle size={16} /> {data.error}
          </h3>
          {(Array.isArray(data.instructions)
            ? data.instructions
            : data.instructions ? [String(data.instructions)] : []
          ).map((i: string, idx: number) => (
            <p key={idx} className="text-xs text-slate-400">• {i}</p>
          ))}
        </div>
      )}

      {!loading && data && !data.error && (
        <DeepDiveContent
          data={data}
          ticker={ticker}
          onTrack={onTrack}
          onViewEvidence={onViewEvidence}
          onTrade={onTrade}
        />
      )}
    </div>
  );
}
