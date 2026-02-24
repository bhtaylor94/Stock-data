'use client';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Newspaper, RefreshCw, ExternalLink, TrendingUp, TrendingDown, Zap, CalendarDays } from 'lucide-react';
import type { MarketEvent, NewsItem } from '@/app/api/news-feed/route';

// ── Types from flow-scan ───────────────────────────────────────────────────────

interface FlowSignal {
  ticker: string;
  currentPrice: number;
  strike: number;
  type: 'call' | 'put';
  expiration: string;
  dte: number;
  mark: number;
  premium: number;
  volume: number;
  openInterest: number;
  volumeOIRatio: number;
  iv: number;
  delta: number;
  score: number;
  reasons: string[];
  alertLabel: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  try {
    return new Date(iso + 'T12:00:00Z').toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
    });
  } catch { return iso; }
}

function fmtAge(ts: number): string {
  const diffMs = Date.now() - ts * 1000;
  const h = Math.floor(diffMs / 3_600_000);
  if (h >= 24) return `${Math.floor(h / 24)}d ago`;
  if (h >= 1) return `${h}h ago`;
  const m = Math.floor(diffMs / 60_000);
  return `${m}m ago`;
}

function fmtPremium(p: number): string {
  if (p >= 1_000_000) return `$${(p / 1_000_000).toFixed(1)}M`;
  if (p >= 1_000) return `$${(p / 1_000).toFixed(0)}K`;
  return `$${p.toFixed(0)}`;
}

function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + 'T00:00:00Z');
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

function getNearbyEvents(expDate: string, events: MarketEvent[], rangedays = 5): MarketEvent[] {
  return events.filter(e => {
    const diff = Math.abs(daysUntil(e.date) - daysUntil(expDate));
    return diff <= rangedays;
  });
}

function eventStyle(type: MarketEvent['type']): { dot: string; pill: string } {
  switch (type) {
    case 'quarterly_opex': return { dot: 'bg-amber-400',   pill: 'bg-amber-500/15 text-amber-300 border-amber-500/25' };
    case 'opex':           return { dot: 'bg-blue-400',    pill: 'bg-blue-500/15 text-blue-300 border-blue-500/25' };
    case 'economic':       return { dot: 'bg-emerald-400', pill: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25' };
    case 'earnings':       return { dot: 'bg-purple-400',  pill: 'bg-purple-500/15 text-purple-300 border-purple-500/25' };
    default:               return { dot: 'bg-slate-400',   pill: 'bg-slate-700 text-slate-300 border-slate-600' };
  }
}

// ── Main component ─────────────────────────────────────────────────────────────

export function NewsFeedPanel({ onSelectTicker }: { onSelectTicker?: (t: string) => void }) {
  const [flowSignals, setFlowSignals] = useState<FlowSignal[]>([]);
  const [events, setEvents] = useState<MarketEvent[]>([]);
  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
  const [insight, setInsight] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(t);
  }, []);

  const load = useCallback(async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      // Step 1: get current flow signals (force-busts cache when user clicks refresh)
      const flowRes = await fetch(force ? '/api/flow-scan?force=1' : '/api/flow-scan');
      if (!flowRes.ok) throw new Error('Flow scan failed');
      const flowData = await flowRes.json();
      const signals: FlowSignal[] = flowData.signals ?? [];
      setFlowSignals(signals);

      // Step 2: build tickers + flow summary for AI context
      const tickers = [...new Set(signals.map(s => s.ticker))].join(',') ||
        'SPY,QQQ,NVDA,TSLA,AAPL,AMD';

      const flowSummary = signals
        .slice(0, 6)
        .map(s =>
          `${s.ticker} $${s.strike} ${s.type.toUpperCase()} exp ${s.expiration} ` +
          `${s.alertLabel} (${fmtPremium(s.premium)} premium)`
        )
        .join('; ');

      // Step 3: fetch news + events + AI insight (force-busts cache too)
      const newsUrl = `/api/news-feed?tickers=${tickers}` +
        `&flowSummary=${encodeURIComponent(flowSummary)}` +
        (force ? '&force=1' : '');
      const newsRes = await fetch(newsUrl);
      if (!newsRes.ok) throw new Error('News feed failed');
      const newsData = await newsRes.json();

      setEvents(newsData.events ?? []);
      setNewsItems(newsData.newsItems ?? []);
      setInsight(newsData.insight ?? null);
      setGeneratedAt(newsData.generatedAt ?? null);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load news');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const ageSeconds = generatedAt
    ? Math.floor((now - new Date(generatedAt).getTime()) / 1000)
    : null;

  // Group flow signals by expiration date, sorted by total premium
  const flowByDate = useMemo(() => {
    const map: Record<string, FlowSignal[]> = {};
    for (const s of flowSignals) {
      (map[s.expiration] ??= []).push(s);
    }
    return Object.entries(map)
      .map(([date, sigs]) => ({
        date,
        signals: sigs,
        totalPremium: sigs.reduce((sum, s) => sum + s.premium, 0),
        callCount: sigs.filter(s => s.type === 'call').length,
        putCount: sigs.filter(s => s.type === 'put').length,
        nearbyEvents: getNearbyEvents(date, events),
      }))
      .sort((a, b) => b.totalPremium - a.totalPremium)
      .slice(0, 5);
  }, [flowSignals, events]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-white flex items-center gap-1.5">
            <Newspaper size={14} className="text-blue-400" />
            News & Events
          </h2>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {FINNHUB_BADGE}
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
        <div className="p-3 rounded-xl border border-red-500/20 bg-red-500/5 text-xs text-red-400">
          {error}
        </div>
      )}

      {loading && !events.length && <LoadingSkeleton />}

      {/* ── AI Insight ── */}
      {insight && (
        <div className="p-4 rounded-2xl border border-blue-500/20 bg-blue-500/5">
          <p className="text-[11px] text-blue-400 font-semibold uppercase tracking-wide flex items-center gap-1 mb-2">
            <Zap size={10} />
            AI Market Context
          </p>
          <p className="text-sm text-slate-300 leading-relaxed">{insight}</p>
        </div>
      )}

      {/* ── Flow + Events ("Why this date?") ── */}
      {flowByDate.length > 0 && (
        <div className="rounded-2xl border border-slate-700/50 bg-slate-800/20 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-slate-700/40">
            <h3 className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Zap size={11} className="text-amber-400" />
              Flow Expiration Analysis
            </h3>
            <p className="text-[10px] text-slate-500 mt-0.5">
              Why are traders positioning at these dates?
            </p>
          </div>
          <div className="divide-y divide-slate-800/50">
            {flowByDate.map(({ date, signals, totalPremium, callCount, putCount, nearbyEvents }) => {
              const dominant = putCount > callCount ? 'puts' : callCount > putCount ? 'calls' : 'mixed';
              const dominantColor = dominant === 'puts' ? 'text-red-400' : dominant === 'calls' ? 'text-emerald-400' : 'text-slate-300';
              const du = daysUntil(date);

              return (
                <div key={date} className="px-4 py-3">
                  {/* Date header */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white">{fmtDate(date)}</span>
                      <span className="text-[10px] text-slate-500">{du}d away</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px]">
                      {putCount > 0 && (
                        <span className="flex items-center gap-0.5 text-red-400 font-semibold">
                          <TrendingDown size={10} /> {putCount} put{putCount !== 1 ? 's' : ''}
                        </span>
                      )}
                      {putCount > 0 && callCount > 0 && <span className="text-slate-600">·</span>}
                      {callCount > 0 && (
                        <span className="flex items-center gap-0.5 text-emerald-400 font-semibold">
                          <TrendingUp size={10} /> {callCount} call{callCount !== 1 ? 's' : ''}
                        </span>
                      )}
                      <span className="text-slate-500 ml-1">{fmtPremium(totalPremium)} total</span>
                    </div>
                  </div>

                  {/* Dominant signal description */}
                  <p className="text-[11px] mb-2">
                    <span className={`font-semibold ${dominantColor}`}>
                      {dominant === 'puts' ? 'Put' : dominant === 'calls' ? 'Call' : 'Mixed'} dominance
                    </span>
                    {' '}across{' '}
                    <span className="text-slate-300">{[...new Set(signals.map(s => s.ticker))].join(', ')}</span>
                  </p>

                  {/* Nearby events */}
                  {nearbyEvents.length > 0 ? (
                    <div>
                      <p className="text-[10px] text-slate-500 mb-1.5">Nearby catalysts (±5 days):</p>
                      <div className="flex flex-wrap gap-1.5">
                        {nearbyEvents.map((e, i) => {
                          const style = eventStyle(e.type);
                          const du2 = daysUntil(e.date);
                          return (
                            <span
                              key={i}
                              className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border ${style.pill}`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                              {e.label}
                              <span className="opacity-60">({du2 > 0 ? `in ${du2}d` : du2 === 0 ? 'today' : `${Math.abs(du2)}d ago`})</span>
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <p className="text-[10px] text-slate-600 italic">No major scheduled events near this date</p>
                  )}

                  {/* Top signal tickers (clickable) */}
                  <div className="flex flex-wrap gap-1 mt-2">
                    {[...new Set(signals.map(s => s.ticker))].map(t => (
                      <button
                        key={t}
                        onClick={() => onSelectTicker?.(t)}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white transition-colors font-mono"
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Events Calendar ── */}
      {events.length > 0 && (
        <div className="rounded-2xl border border-slate-700/50 bg-slate-800/20 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-slate-700/40">
            <h3 className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <CalendarDays size={11} className="text-blue-400" />
              Upcoming Market Events
            </h3>
          </div>
          {/* Legend */}
          <div className="px-4 py-2 border-b border-slate-800/40 flex items-center gap-3 flex-wrap">
            {[
              { type: 'quarterly_opex' as const, label: 'Quarterly OpEx' },
              { type: 'opex' as const,           label: 'Monthly OpEx' },
              { type: 'economic' as const,        label: 'Economic' },
            ].map(({ type, label }) => {
              const s = eventStyle(type);
              return (
                <span key={type} className="flex items-center gap-1 text-[10px] text-slate-500">
                  <span className={`w-2 h-2 rounded-full ${s.dot}`} />
                  {label}
                </span>
              );
            })}
          </div>
          <div className="p-3 space-y-1.5 max-h-72 overflow-y-auto">
            {events.map((e, i) => {
              const style = eventStyle(e.type);
              const du = daysUntil(e.date);
              return (
                <div key={i} className="flex items-center gap-2.5">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${style.dot}`} />
                  <span className="text-[11px] text-slate-500 w-20 flex-shrink-0 font-mono">
                    {new Date(e.date + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}
                  </span>
                  <span className="text-[11px] text-slate-300 flex-1 min-w-0 truncate">{e.label}</span>
                  <span className="text-[10px] text-slate-600 flex-shrink-0">
                    {du === 0 ? 'Today' : du === 1 ? 'Tomorrow' : `${du}d`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── News Feed ── */}
      {newsItems.length > 0 && (
        <div className="rounded-2xl border border-slate-700/50 bg-slate-800/20 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-slate-700/40">
            <h3 className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Newspaper size={11} className="text-slate-400" />
              Recent News (Flow Tickers)
            </h3>
          </div>
          <div className="divide-y divide-slate-800/50 max-h-[480px] overflow-y-auto">
            {newsItems.map((n, i) => (
              <div key={i} className="px-4 py-3 hover:bg-slate-800/30 transition-colors">
                <div className="flex items-start gap-2">
                  <button
                    onClick={() => onSelectTicker?.(n.ticker)}
                    className="text-[10px] font-bold font-mono px-1.5 py-0.5 rounded bg-slate-700 text-slate-300 hover:bg-blue-600 hover:text-white transition-colors flex-shrink-0 mt-0.5"
                  >
                    {n.ticker}
                  </button>
                  <div className="flex-1 min-w-0">
                    {n.url ? (
                      <a
                        href={n.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-slate-200 hover:text-white leading-snug flex items-start gap-1 group"
                      >
                        <span className="flex-1">{n.headline}</span>
                        <ExternalLink size={9} className="flex-shrink-0 mt-0.5 text-slate-600 group-hover:text-slate-400" />
                      </a>
                    ) : (
                      <p className="text-xs text-slate-200 leading-snug">{n.headline}</p>
                    )}
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-slate-600">{n.source}</span>
                      {n.datetime > 0 && (
                        <span className="text-[10px] text-slate-600">{fmtAge(n.datetime)}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && !error && events.length === 0 && newsItems.length === 0 && (
        <div className="p-8 text-center">
          <p className="text-xs text-slate-500">No events or news available</p>
          <p className="text-[11px] text-slate-600 mt-1">Finnhub API key required for news data</p>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

const FINNHUB_BADGE = (
  <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border font-medium text-emerald-400 bg-emerald-500/10 border-emerald-500/20">
    ✓ Finnhub + AI
  </span>
);

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map(i => (
        <div key={i} className="p-4 rounded-2xl border border-slate-700/30 bg-slate-800/20 animate-pulse space-y-2">
          <div className="h-3 bg-slate-700/60 rounded w-32" />
          <div className="h-4 bg-slate-700/40 rounded w-full" />
          <div className="h-4 bg-slate-700/40 rounded w-3/4" />
        </div>
      ))}
    </div>
  );
}
