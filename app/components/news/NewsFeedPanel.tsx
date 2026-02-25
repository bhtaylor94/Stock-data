'use client';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Newspaper, RefreshCw, ExternalLink, TrendingUp, TrendingDown,
  Zap, CalendarDays, Sparkles, X, ChevronRight,
} from 'lucide-react';
import type { MarketEvent, NewsItem } from '@/app/api/news-feed/route';
import { getPlaybook, type EventPlaybook } from '@/lib/eventPlaybooks';

// ── Types ──────────────────────────────────────────────────────────────────────

interface FlowSignal {
  ticker: string;
  strike: number;
  type: 'call' | 'put';
  expiration: string;
  premium: number;
  dte: number;
  score: number;
  alertLabel: string;
}

type TabId = 'insights' | 'news' | 'calendar';

// ── Helpers ────────────────────────────────────────────────────────────────────

function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((new Date(dateStr + 'T00:00:00Z').getTime() - today.getTime()) / 86_400_000);
}

function fmtMonthDay(iso: string): string {
  return new Date(iso + 'T12:00:00Z').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', timeZone: 'UTC',
  });
}

function fmtFullDate(iso: string): string {
  return new Date(iso + 'T12:00:00Z').toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  });
}

function fmtNewsTime(ts: number): string {
  if (!ts) return '';
  const d = new Date(ts * 1000);
  const diffMs = Date.now() - d.getTime();
  const h = Math.floor(diffMs / 3_600_000);
  if (h < 1) { const m = Math.floor(diffMs / 60_000); return m < 1 ? 'Just now' : `${m}m ago`; }
  if (h < 24) return `${h}h ago`;
  if (h < 48) return 'Yesterday';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function fmtPremium(p: number): string {
  if (p >= 1_000_000) return `$${(p / 1_000_000).toFixed(1)}M`;
  if (p >= 1_000) return `$${(p / 1_000).toFixed(0)}K`;
  return `$${p.toFixed(0)}`;
}

function getDuLabel(du: number): string {
  if (du < 0) return `${Math.abs(du)}d ago`;
  if (du === 0) return 'Today';
  if (du === 1) return 'Tomorrow';
  return `in ${du}d`;
}

const EVENT_STYLE: Record<MarketEvent['type'], { dot: string; badge: string }> = {
  quarterly_opex: { dot: 'bg-amber-400',   badge: 'text-amber-300  bg-amber-500/15  border-amber-500/25'  },
  opex:           { dot: 'bg-blue-400',    badge: 'text-blue-300   bg-blue-500/15   border-blue-500/25'   },
  economic:       { dot: 'bg-emerald-400', badge: 'text-emerald-300 bg-emerald-500/15 border-emerald-500/25' },
  earnings:       { dot: 'bg-purple-400',  badge: 'text-purple-300 bg-purple-500/15 border-purple-500/25' },
};

const STRATEGY_STYLE: Record<string, string> = {
  bullish: 'border-l-emerald-500 bg-emerald-500/5',
  bearish: 'border-l-red-500 bg-red-500/5',
  neutral: 'border-l-blue-500 bg-blue-500/5',
  warning: 'border-l-amber-500 bg-amber-500/5',
};

const STRATEGY_LABEL: Record<string, string> = {
  bullish: 'text-emerald-400',
  bearish: 'text-red-400',
  neutral: 'text-blue-400',
  warning: 'text-amber-400',
};

function getNearby(expDate: string, events: MarketEvent[], range = 5): MarketEvent[] {
  const expDu = daysUntil(expDate);
  return events.filter(e => Math.abs(daysUntil(e.date) - expDu) <= range);
}

// ── PlaybookCard ──────────────────────────────────────────────────────────────

function PlaybookCard({
  playbook,
  eventLabel,
  onClose,
}: {
  playbook: EventPlaybook;
  eventLabel: string;
  onClose: () => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-600/50 bg-slate-900/80 overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-slate-700/50 bg-slate-800/40">
        <div className="flex items-center gap-2">
          <span className="text-xl">{playbook.emoji}</span>
          <div>
            <p className="text-[12px] font-bold text-white leading-tight">{playbook.title}</p>
            <p className="text-[10px] text-slate-500 mt-0.5 truncate max-w-[260px]">{eventLabel}</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="flex-shrink-0 p-1 rounded-md text-slate-500 hover:text-white hover:bg-slate-700 transition-colors"
        >
          <X size={13} />
        </button>
      </div>

      <div className="px-4 py-3 space-y-3">
        {/* What is it */}
        <div>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">What is it?</p>
          <p className="text-[12px] text-slate-300 leading-relaxed">{playbook.whatIsIt}</p>
        </div>

        {/* Typical behavior */}
        <div>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Typical Market Behavior</p>
          <p className="text-[12px] text-slate-400 leading-relaxed">{playbook.typicalBehavior}</p>
        </div>

        {/* Strategies */}
        <div>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Trading Strategies</p>
          <div className="space-y-2">
            {playbook.strategies.map((s) => (
              <div
                key={s.name}
                className={`rounded-lg border-l-2 px-3 py-2 ${STRATEGY_STYLE[s.type] ?? STRATEGY_STYLE.neutral}`}
              >
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className={`text-[10px] font-bold uppercase tracking-wide ${STRATEGY_LABEL[s.type] ?? STRATEGY_LABEL.neutral}`}>
                    {s.type}
                  </span>
                  <span className="text-[11px] font-semibold text-slate-200">{s.name}</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-snug">{s.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="px-4 py-2 border-t border-slate-800/60">
        <p className="text-[10px] text-slate-600">Educational purposes only. Not financial advice.</p>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function NewsFeedPanel({ onSelectTicker }: { onSelectTicker?: (t: string) => void }) {
  const [flowSignals, setFlowSignals] = useState<FlowSignal[]>([]);
  const [events, setEvents] = useState<MarketEvent[]>([]);
  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
  const [generalNews, setGeneralNews] = useState<NewsItem[]>([]);
  const [insight, setInsight] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  const [activeTab, setActiveTab] = useState<TabId>('insights');
  const [tickerFilter, setTickerFilter] = useState('ALL');
  const [selectedPlaybook, setSelectedPlaybook] = useState<{ playbook: EventPlaybook; label: string } | null>(null);
  const [expandedCalEvent, setExpandedCalEvent] = useState<string | null>(null); // key = `${date}-${label}`

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(t);
  }, []);

  const load = useCallback(async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      const flowRes = await fetch(force ? '/api/flow-scan?force=1' : '/api/flow-scan');
      if (!flowRes.ok) throw new Error('Flow scan failed');
      const fd = await flowRes.json();
      const signals: FlowSignal[] = fd.signals ?? [];
      setFlowSignals(signals);

      const tickers = [...new Set(signals.map(s => s.ticker))].join(',')
        || 'SPY,QQQ,NVDA,TSLA,AAPL,AMD';

      const flowSummary = signals.slice(0, 6)
        .map(s => `${s.ticker} $${s.strike} ${s.type.toUpperCase()} exp ${s.expiration} ${s.alertLabel} (${fmtPremium(s.premium)})`)
        .join('; ');

      const nUrl = `/api/news-feed?tickers=${tickers}&flowSummary=${encodeURIComponent(flowSummary)}${force ? '&force=1' : ''}`;
      const nRes = await fetch(nUrl);
      if (!nRes.ok) throw new Error('News feed failed');
      const nd = await nRes.json();

      setEvents(nd.events ?? []);
      setNewsItems(nd.newsItems ?? []);
      setGeneralNews(nd.generalNews ?? []);
      setInsight(nd.insight ?? null);
      setUpdatedAt(nd.generatedAt ?? null);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const ageSeconds = updatedAt ? Math.floor((now - new Date(updatedAt).getTime()) / 1000) : null;

  // Derive ticker sentiment from flow signals
  const tickerSentiment = useMemo<Record<string, 'bullish' | 'bearish' | 'mixed'>>(() => {
    const m: Record<string, 'bullish' | 'bearish' | 'mixed'> = {};
    for (const s of flowSignals) {
      const cur = m[s.ticker];
      const dir = s.type === 'call' ? 'bullish' : 'bearish';
      m[s.ticker] = !cur ? dir : cur !== dir ? 'mixed' : cur;
    }
    return m;
  }, [flowSignals]);

  // Flow clusters by expiration, sorted by total premium
  const flowClusters = useMemo(() => {
    const map: Record<string, FlowSignal[]> = {};
    for (const s of flowSignals) (map[s.expiration] ??= []).push(s);
    return Object.entries(map)
      .map(([date, sigs]) => ({
        date,
        sigs,
        totalPremium: sigs.reduce((sum, s) => sum + s.premium, 0),
        calls: sigs.filter(s => s.type === 'call').length,
        puts: sigs.filter(s => s.type === 'put').length,
        tickers: [...new Set(sigs.map(s => s.ticker))],
        nearby: getNearby(date, events),
      }))
      .sort((a, b) => b.totalPremium - a.totalPremium)
      .slice(0, 5);
  }, [flowSignals, events]);

  const flowTickers = useMemo(() => [...new Set(flowSignals.map(s => s.ticker))], [flowSignals]);

  // Combined news for the News tab
  const filteredNews = useMemo(() => {
    if (tickerFilter === 'ALL') {
      // Show general market news first, then company news
      return [...generalNews, ...newsItems];
    }
    if (tickerFilter === 'MARKET') return generalNews;
    return newsItems.filter(n => n.ticker === tickerFilter);
  }, [newsItems, generalNews, tickerFilter]);

  const calGroups = useMemo(() => ({
    thisWeek:  events.filter(e => daysUntil(e.date) <= 7),
    nextWeek:  events.filter(e => { const d = daysUntil(e.date); return d > 7 && d <= 14; }),
    later:     events.filter(e => daysUntil(e.date) > 14),
  }), [events]);

  const TABS = [
    { id: 'insights' as TabId, label: 'Flow Insights', Icon: Zap },
    { id: 'news'     as TabId, label: 'News',           Icon: Newspaper },
    { id: 'calendar' as TabId, label: 'Calendar',       Icon: CalendarDays },
  ];

  function handleEventClick(event: MarketEvent) {
    const playbook = getPlaybook(event);
    if (!playbook) return;
    const key = `${event.date}-${event.label}`;
    if (selectedPlaybook?.label === event.label) {
      setSelectedPlaybook(null);
    } else {
      setSelectedPlaybook({ playbook, label: event.label });
      setExpandedCalEvent(key);
    }
  }

  return (
    <div className="space-y-3 max-w-3xl">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-white flex items-center gap-1.5">
            <Newspaper size={14} className="text-blue-400" />
            News & Events
          </h2>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border font-medium text-emerald-400 bg-emerald-500/10 border-emerald-500/20">
              ✓ Finnhub · AI
            </span>
            {ageSeconds != null && (
              <span className="text-xs text-slate-500">updated {ageSeconds}s ago</span>
            )}
          </div>
        </div>
        <button
          onClick={() => load(true)}
          className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700 transition-colors"
          title="Force refresh"
        >
          <RefreshCw size={12} className={`text-slate-400 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error && (
        <p className="text-xs text-red-400 px-3 py-2 rounded-lg bg-red-500/5 border border-red-500/20">{error}</p>
      )}

      {/* ── Events strip (always visible) ── */}
      {events.length > 0 && (
        <div className="overflow-x-auto scrollbar-none pb-0.5">
          <div className="flex items-center gap-2 min-w-max">
            <span className="text-[10px] font-medium text-slate-600 uppercase tracking-wider flex-shrink-0 pr-1">
              Upcoming
            </span>
            {events.slice(0, 20).map((e, i) => {
              const s = EVENT_STYLE[e.type] ?? EVENT_STYLE.opex;
              const du = daysUntil(e.date);
              const label = e.label.length > 24 ? e.label.slice(0, 24) + '…' : e.label;
              const hasPlaybook = !!getPlaybook(e);
              const isSelected = selectedPlaybook?.label === e.label;
              return (
                <button
                  key={`${e.date}-${e.label}`}
                  onClick={() => handleEventClick(e)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-medium flex-shrink-0 transition-all ${s.badge} ${
                    hasPlaybook
                      ? isSelected
                        ? 'ring-1 ring-offset-1 ring-offset-slate-900 ring-white/30 brightness-125'
                        : 'hover:brightness-125 cursor-pointer'
                      : 'cursor-default'
                  }`}
                  title={hasPlaybook ? 'Click to learn what to do during this event' : undefined}
                >
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${s.dot}`} />
                  {label}
                  <span className="opacity-50 text-[10px]">{du === 0 ? 'today' : `${du}d`}</span>
                  {hasPlaybook && <ChevronRight size={9} className="opacity-40" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Playbook card (appears below events strip) ── */}
      {selectedPlaybook && (
        <PlaybookCard
          playbook={selectedPlaybook.playbook}
          eventLabel={selectedPlaybook.label}
          onClose={() => setSelectedPlaybook(null)}
        />
      )}

      {/* ── Tab bar ── */}
      <div className="flex gap-1 p-1 rounded-xl bg-slate-800/60 border border-slate-700/50">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[11px] font-semibold rounded-lg transition-all ${
              activeTab === id
                ? 'bg-slate-700 text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <Icon size={11} />
            {label}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && newsItems.length === 0 && (
        <div className="flex items-center justify-center py-14">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
          FLOW INSIGHTS TAB
      ═══════════════════════════════════════════════════════════ */}
      {activeTab === 'insights' && !loading && (
        <div className="space-y-3">

          {/* AI insight card */}
          {insight && (
            <div className="rounded-2xl border border-blue-500/20 bg-gradient-to-br from-blue-950/40 to-slate-900/60 p-4">
              <div className="flex items-center gap-1.5 mb-2.5">
                <Sparkles size={13} className="text-blue-400" />
                <span className="text-[11px] font-bold text-blue-400 uppercase tracking-wider">
                  AI Market Context
                </span>
              </div>
              <p className="text-[13px] text-slate-200 leading-relaxed">{insight}</p>
            </div>
          )}

          {/* Flow clusters */}
          {flowClusters.length === 0 && (
            <p className="text-xs text-slate-500 text-center py-8">No active flow signals — check back during market hours</p>
          )}

          {flowClusters.map(({ date, calls, puts, totalPremium, tickers, nearby }) => {
            const putDom = puts > calls;
            const mixed = calls > 0 && puts > 0 && Math.abs(calls - puts) <= 1;
            const dirColor  = mixed ? 'text-slate-300' : putDom ? 'text-red-400' : 'text-emerald-400';
            const cardBorder = mixed ? 'border-slate-700/50' : putDom ? 'border-red-500/20' : 'border-emerald-500/20';
            const cardBg     = mixed ? 'bg-slate-800/20'     : putDom ? 'bg-red-500/5'       : 'bg-emerald-500/5';
            const badgeCls   = mixed
              ? 'bg-slate-700 text-slate-300'
              : putDom
              ? 'bg-red-500/20 text-red-300 border border-red-500/30'
              : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30';
            const du = daysUntil(date);

            return (
              <div key={date} className={`rounded-2xl border overflow-hidden ${cardBorder} ${cardBg}`}>
                {/* Date + direction */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
                  <div>
                    <p className="text-[15px] font-bold text-white tracking-tight">
                      {fmtFullDate(date)}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {du <= 0 ? 'Expired' : du === 1 ? 'Expires tomorrow' : `Expires in ${du} days`}
                    </p>
                  </div>
                  <div className={`px-3 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1 ${badgeCls}`}>
                    {mixed ? (
                      <span>MIXED</span>
                    ) : putDom ? (
                      <><TrendingDown size={11} /> PUTS</>
                    ) : (
                      <><TrendingUp size={11} /> CALLS</>
                    )}
                  </div>
                </div>

                <div className="px-4 py-3 space-y-3">
                  {/* Stats row */}
                  <div className="flex items-center gap-3 text-[12px] flex-wrap">
                    <span className={`font-bold ${dirColor}`}>{fmtPremium(totalPremium)} flow</span>
                    <span className="text-slate-600">·</span>
                    {puts > 0 && <span className="text-red-400">{puts} put{puts !== 1 ? 's' : ''}</span>}
                    {puts > 0 && calls > 0 && <span className="text-slate-700">/</span>}
                    {calls > 0 && <span className="text-emerald-400">{calls} call{calls !== 1 ? 's' : ''}</span>}
                  </div>

                  {/* Tickers */}
                  <div className="flex flex-wrap gap-1.5">
                    {tickers.map(t => (
                      <button
                        key={t}
                        onClick={() => onSelectTicker?.(t)}
                        className="text-[11px] font-bold font-mono px-2 py-0.5 rounded-md bg-slate-700/80 text-slate-300 hover:bg-blue-600 hover:text-white transition-colors"
                      >
                        {t}
                      </button>
                    ))}
                  </div>

                  {/* Nearby events */}
                  <div>
                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                      Catalysts within ±5 days
                    </p>
                    {nearby.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {nearby.map((e, i) => {
                          const s = EVENT_STYLE[e.type] ?? EVENT_STYLE.opex;
                          const edu = daysUntil(e.date);
                          const hasPlaybook = !!getPlaybook(e);
                          return (
                            <button
                              key={`${e.date}-${e.label}`}
                              onClick={() => handleEventClick(e)}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-medium transition-all ${s.badge} ${hasPlaybook ? 'hover:brightness-125' : 'cursor-default'}`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${s.dot}`} />
                              {e.label}
                              <span className="opacity-50">({getDuLabel(edu)})</span>
                              {hasPlaybook && <ChevronRight size={9} className="opacity-40" />}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-[11px] text-slate-600 italic">
                        No major scheduled events near this expiration
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
          NEWS TAB
      ═══════════════════════════════════════════════════════════ */}
      {activeTab === 'news' && !loading && (
        <div className="space-y-3">

          {/* Ticker filter pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
            {/* ALL */}
            <button
              onClick={() => setTickerFilter('ALL')}
              className={`flex-shrink-0 px-3 py-1 text-[11px] font-bold rounded-full border transition-colors ${
                tickerFilter === 'ALL'
                  ? 'bg-blue-600 border-blue-500 text-white'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white hover:border-slate-600'
              }`}
            >
              ALL
              <span className="ml-1 opacity-60 text-[9px]">
                {generalNews.length + newsItems.length}
              </span>
            </button>

            {/* MARKET (general news) */}
            {generalNews.length > 0 && (
              <button
                onClick={() => setTickerFilter('MARKET')}
                className={`flex-shrink-0 px-3 py-1 text-[11px] font-bold rounded-full border transition-colors ${
                  tickerFilter === 'MARKET'
                    ? 'bg-blue-600 border-blue-500 text-white'
                    : 'bg-slate-800/60 border-slate-600/50 text-slate-400 hover:text-white hover:border-slate-500'
                }`}
              >
                🌐 Market
                <span className="ml-1 opacity-60 text-[9px]">{generalNews.length}</span>
              </button>
            )}

            {/* Flow tickers */}
            {flowTickers.map(t => {
              const sent = tickerSentiment[t];
              const active = tickerFilter === t;
              const activeCls = active ? 'bg-blue-600 border-blue-500 text-white' : (
                sent === 'bullish' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:border-emerald-400' :
                sent === 'bearish' ? 'bg-red-500/10 border-red-500/30 text-red-400 hover:border-red-400' :
                'bg-slate-800 border-slate-700 text-slate-400 hover:text-white hover:border-slate-600'
              );
              return (
                <button
                  key={t}
                  onClick={() => setTickerFilter(t)}
                  className={`flex-shrink-0 px-3 py-1 text-[11px] font-bold rounded-full border transition-colors ${activeCls}`}
                >
                  {t}
                  <span className="ml-1 opacity-60 text-[9px]">
                    {newsItems.filter(n => n.ticker === t).length}
                  </span>
                </button>
              );
            })}
          </div>

          {/* News count */}
          {filteredNews.length > 0 && (
            <p className="text-[10px] text-slate-600">
              {filteredNews.length} article{filteredNews.length !== 1 ? 's' : ''}
              {tickerFilter === 'MARKET' ? ' · general market news'
                : tickerFilter !== 'ALL' ? ` for ${tickerFilter}`
                : ` across ${(new Set(newsItems.map(n => n.ticker))).size} companies + market news`}
              {' '}· last 7 days
            </p>
          )}

          {filteredNews.length === 0 && (
            <div className="py-12 text-center">
              <Newspaper size={24} className="mx-auto text-slate-700 mb-2" />
              <p className="text-xs text-slate-500">No recent news{tickerFilter !== 'ALL' ? ` for ${tickerFilter}` : ''}</p>
              <p className="text-[11px] text-slate-600 mt-1">Finnhub API key required</p>
            </div>
          )}

          {/* News cards */}
          <div className="space-y-px rounded-2xl border border-slate-700/40 overflow-hidden">
            {filteredNews.map((n) => {
              const sent = n.ticker === 'MARKET' ? undefined : tickerSentiment[n.ticker];
              const bar =
                sent === 'bullish' ? 'bg-emerald-500' :
                sent === 'bearish' ? 'bg-red-500' :
                n.ticker === 'MARKET' ? 'bg-blue-500' :
                'bg-slate-600';

              return (
                <div
                  key={n.url ?? n.headline}
                  className="flex bg-slate-800/20 hover:bg-slate-800/50 transition-colors"
                >
                  {/* Left accent bar */}
                  <div className={`w-[3px] flex-shrink-0 self-stretch ${bar}`} />

                  <div className="flex items-start gap-3 px-3 py-3 flex-1 min-w-0">
                    {/* Ticker badge */}
                    {n.ticker === 'MARKET' ? (
                      <span className="flex-shrink-0 mt-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400 border border-blue-500/20">
                        MKT
                      </span>
                    ) : (
                      <button
                        onClick={() => onSelectTicker?.(n.ticker)}
                        className="flex-shrink-0 mt-0.5 text-[10px] font-bold font-mono px-1.5 py-0.5 rounded bg-slate-700 text-slate-300 hover:bg-blue-600 hover:text-white transition-colors"
                      >
                        {n.ticker}
                      </button>
                    )}

                    {/* Headline + meta */}
                    <div className="flex-1 min-w-0">
                      {n.url ? (
                        <a
                          href={n.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group flex items-start gap-1"
                        >
                          <span className="text-[13px] font-semibold text-slate-200 group-hover:text-white leading-snug line-clamp-2">
                            {n.headline}
                          </span>
                          <ExternalLink size={9} className="flex-shrink-0 mt-1 text-slate-700 group-hover:text-slate-400 transition-colors" />
                        </a>
                      ) : (
                        <p className="text-[13px] font-semibold text-slate-200 leading-snug line-clamp-2">
                          {n.headline}
                        </p>
                      )}
                      <p className="mt-1 text-[10px] text-slate-500">
                        <span className="font-medium text-slate-400">{n.source}</span>
                        {n.datetime > 0 && (
                          <>
                            <span className="mx-1 text-slate-700">·</span>
                            {fmtNewsTime(n.datetime)}
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
          CALENDAR TAB
      ═══════════════════════════════════════════════════════════ */}
      {activeTab === 'calendar' && !loading && (
        <div className="space-y-3">

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-2">
            {(Object.entries(EVENT_STYLE) as [MarketEvent['type'], (typeof EVENT_STYLE)[keyof typeof EVENT_STYLE]][]).map(([type, s]) => (
              <span key={type} className={`inline-flex items-center gap-1.5 text-[10px] font-medium px-2 py-0.5 rounded-full border ${s.badge}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                {type === 'quarterly_opex' ? 'Quarterly OpEx'
                  : type === 'opex'         ? 'Monthly OpEx'
                  : type === 'economic'     ? 'Economic Data'
                  :                          'Earnings'}
              </span>
            ))}
            <span className="text-[10px] text-slate-600 ml-1">· Tap any row to learn what to do</span>
          </div>

          {/* Grouped calendar */}
          {[
            { label: 'This Week',  data: calGroups.thisWeek },
            { label: 'Next Week',  data: calGroups.nextWeek },
            { label: 'Coming Up',  data: calGroups.later    },
          ].filter(g => g.data.length > 0).map(({ label, data }) => (
            <div key={label} className="rounded-2xl border border-slate-700/50 bg-slate-800/20 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-slate-700/40 bg-slate-800/30">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">{label}</p>
              </div>
              <div className="divide-y divide-slate-800/60">
                {data.map((e, i) => {
                  const s = EVENT_STYLE[e.type] ?? EVENT_STYLE.opex;
                  const du = daysUntil(e.date);
                  const playbook = getPlaybook(e);
                  const key = `${e.date}-${e.label}`;
                  const isExpanded = expandedCalEvent === key;

                  return (
                    <div key={key}>
                      <button
                        onClick={() => {
                          if (!playbook) return;
                          if (isExpanded) {
                            setExpandedCalEvent(null);
                            setSelectedPlaybook(null);
                          } else {
                            setExpandedCalEvent(key);
                            setSelectedPlaybook({ playbook, label: e.label });
                          }
                        }}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                          playbook ? 'hover:bg-slate-700/30 cursor-pointer' : 'cursor-default'
                        } ${isExpanded ? 'bg-slate-700/20' : ''}`}
                      >
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${s.dot}`} />
                        <span className="text-[12px] font-semibold text-slate-400 w-16 flex-shrink-0 tabular-nums">
                          {fmtMonthDay(e.date)}
                        </span>
                        <span className="text-[12px] text-slate-200 flex-1 min-w-0 text-left">
                          {e.label}
                        </span>
                        {e.impact === 'high' && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/20 flex-shrink-0">
                            HIGH
                          </span>
                        )}
                        <span className={`text-[11px] font-medium flex-shrink-0 ${s.badge.split(' ')[0]}`}>
                          {getDuLabel(du)}
                        </span>
                        {playbook && (
                          <ChevronRight
                            size={12}
                            className={`flex-shrink-0 text-slate-600 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                          />
                        )}
                      </button>

                      {/* Inline playbook expansion */}
                      {isExpanded && playbook && (
                        <div className="px-4 pb-3">
                          <div className="rounded-xl border border-slate-700/50 bg-slate-900/60 overflow-hidden">
                            <div className="px-3 py-2 border-b border-slate-800/60">
                              <p className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                                <span>{playbook.emoji}</span>
                                {playbook.title}
                              </p>
                            </div>
                            <div className="px-3 py-2 space-y-2">
                              <p className="text-[11px] text-slate-400 leading-relaxed">{playbook.whatIsIt}</p>
                              <div className="border-t border-slate-800/60 pt-2">
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">Typical Behavior</p>
                                <p className="text-[11px] text-slate-400 leading-relaxed">{playbook.typicalBehavior}</p>
                              </div>
                              <div className="border-t border-slate-800/60 pt-2">
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">Trading Strategies</p>
                                <div className="space-y-1.5">
                                  {playbook.strategies.map((strat, si) => (
                                    <div
                                      key={si}
                                      className={`rounded-lg border-l-2 px-2.5 py-1.5 ${STRATEGY_STYLE[strat.type] ?? STRATEGY_STYLE.neutral}`}
                                    >
                                      <div className="flex items-center gap-1.5 mb-0.5">
                                        <span className={`text-[9px] font-bold uppercase tracking-wide ${STRATEGY_LABEL[strat.type] ?? STRATEGY_LABEL.neutral}`}>
                                          {strat.type}
                                        </span>
                                        <span className="text-[11px] font-semibold text-slate-200">{strat.name}</span>
                                      </div>
                                      <p className="text-[11px] text-slate-400 leading-snug">{strat.description}</p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {events.length === 0 && (
            <div className="py-12 text-center">
              <CalendarDays size={24} className="mx-auto text-slate-700 mb-2" />
              <p className="text-xs text-slate-500">No upcoming events · Finnhub API key required</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
