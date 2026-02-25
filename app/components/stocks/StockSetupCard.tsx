'use client';
import React, { useState } from 'react';
import {
  ChevronDown, ChevronRight, CheckCircle2, AlertTriangle,
  TrendingUp, TrendingDown, Users, BarChart2, Activity,
} from 'lucide-react';
import Badge from '@/app/components/core/Badge';

// ── Visual helpers ────────────────────────────────────────────────────────────

type ConfidenceLabel = 'VERY_HIGH' | 'HIGH' | 'MEDIUM';

function stripeClass(score: number): string {
  if (score >= 80) return 'border-l-amber-400';
  if (score >= 65) return 'border-l-blue-500';
  return 'border-l-slate-500';
}

function confidenceVariant(label: ConfidenceLabel): 'bullish' | 'info' | 'neutral' {
  if (label === 'VERY_HIGH') return 'bullish';
  if (label === 'HIGH') return 'info';
  return 'neutral';
}

function statusVariant(s: string): 'bullish' | 'bearish' | 'warning' | 'info' {
  if (s === 'BREAKOUT' || s === 'CONFIRMED') return 'bullish';
  if (s === 'BREAKDOWN') return 'bearish';
  if (s === 'FORMING') return 'warning';
  return 'info';
}

// ── Conviction ring (replaces old ConfluenceRing — shows composite score) ─────

function ConvictionRing({ score }: { score: number }) {
  const r      = 15;
  const circ   = 2 * Math.PI * r;
  const filled = (score / 100) * circ;
  const color  = score >= 80 ? '#f59e0b' : score >= 65 ? '#3b82f6' : '#64748b';
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" className="flex-shrink-0">
      <circle cx="20" cy="20" r={r} fill="none" stroke="#1e293b" strokeWidth="4" />
      <circle
        cx="20" cy="20" r={r} fill="none" stroke={color} strokeWidth="4"
        strokeDasharray={`${filled} ${circ - filled}`}
        strokeLinecap="round" transform="rotate(-90 20 20)"
        style={{ transition: 'stroke-dasharray 0.7s ease-out' }}
      />
      <text x="20" y="24" textAnchor="middle" fontSize="9" fontWeight="800" fill={color}>{score}</text>
    </svg>
  );
}

// ── Mini signal bar ───────────────────────────────────────────────────────────

function SignalBar({
  label, score, icon: Icon, color = 'blue',
}: {
  label: string; score: number; icon: React.ElementType; color?: string;
}) {
  const colorMap: Record<string, { bar: string; text: string }> = {
    amber:  { bar: 'bg-amber-500',   text: 'text-amber-400'   },
    blue:   { bar: 'bg-blue-500',    text: 'text-blue-400'    },
    emerald:{ bar: 'bg-emerald-500', text: 'text-emerald-400' },
    violet: { bar: 'bg-violet-500',  text: 'text-violet-400'  },
    cyan:   { bar: 'bg-cyan-500',    text: 'text-cyan-400'    },
  };
  const { bar, text } = colorMap[color] ?? colorMap.blue;
  return (
    <div className="flex items-center gap-2">
      <Icon size={11} className={`${text} flex-shrink-0`} />
      <span className="text-[10px] text-slate-400 w-28 flex-shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <div className={`h-full ${bar} rounded-full`} style={{ width: `${score}%`, transition: 'width 0.6s ease' }} />
      </div>
      <span className={`text-[10px] font-bold ${text} w-7 text-right flex-shrink-0`}>{score}</span>
    </div>
  );
}

// ── RS Rating badge ───────────────────────────────────────────────────────────

function RSBadge({ rating, label }: { rating: number; label: string }) {
  const cl = label === 'LEADER'  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
           : label === 'STRONG'  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
           : label === 'AVERAGE' ? 'bg-slate-700/60 text-slate-400 border-slate-600/50'
           :                       'bg-red-500/15 text-red-400 border-red-500/30';
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${cl}`}>
      RS {rating}
    </span>
  );
}

// ── Block activity indicator ──────────────────────────────────────────────────

function BlockActivityChip({ signal, accumDays, distribDays }: {
  signal: string; accumDays: number; distribDays: number;
}) {
  if (signal === 'ACCUMULATION') {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-500/8 border border-emerald-500/20">
        <Activity size={10} className="text-emerald-400 flex-shrink-0" />
        <span className="text-[11px] text-emerald-300 font-medium">
          {accumDays} stealth accumulation day{accumDays !== 1 ? 's' : ''} detected
        </span>
      </div>
    );
  }
  if (signal === 'DISTRIBUTION') {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-red-500/8 border border-red-500/20">
        <Activity size={10} className="text-red-400 flex-shrink-0" />
        <span className="text-[11px] text-red-300 font-medium">
          {distribDays} stealth distribution day{distribDays !== 1 ? 's' : ''} detected
        </span>
      </div>
    );
  }
  return null;
}

// ── Short ratio indicator ─────────────────────────────────────────────────────

function ShortRatioChip({ ratio }: { ratio: number }) {
  const pct  = (ratio * 100).toFixed(0);
  const high = ratio > 0.55;
  const low  = ratio < 0.40;
  if (!high && !low) return null;
  return (
    <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium border ${
      high ? 'bg-red-500/8 border-red-500/20 text-red-300'
           : 'bg-blue-500/8 border-blue-500/20 text-blue-300'
    }`}>
      <TrendingDown size={10} className="flex-shrink-0" />
      {pct}% short-sale ratio (FINRA) — {high ? 'heavy short pressure' : 'low short activity'}
    </div>
  );
}

// ── Main card ─────────────────────────────────────────────────────────────────

export function StockSetupCard({ result }: { result: any }) {
  const [expanded, setExpanded] = useState(false);

  const {
    ticker, price, changePct, sector, rsRating, rsLabel,
    volProfile, avwap, blockActivity, shortRatio,
    setup, insider, earnings, conviction, convictionLabel,
  } = result;

  const rrNum  = parseFloat((setup.riskReward ?? '').replace('1:', ''));
  const rrGood = !isNaN(rrNum) && rrNum >= 2;

  // Conviction label for the outer badge (using convictionLabel already computed server-side)
  const cvLabel: ConfidenceLabel = convictionLabel ?? setup.confidenceLabel;

  return (
    <div className={`rounded-xl border border-slate-700/50 bg-slate-800/30 border-l-4 ${stripeClass(conviction ?? setup.confidence)} overflow-hidden`}>

      {/* ── Header (always visible) ── */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-700/20 transition-colors text-left"
      >
        <ConvictionRing score={conviction ?? setup.confidence} />

        <div className="flex-1 min-w-0">
          {/* Row 1: setup name + key badges */}
          <div className="flex items-center gap-1.5 flex-wrap mb-1">
            <span className="font-semibold text-sm text-white">
              {setup.emoji} {setup.name}
            </span>
            <Badge text={cvLabel.replace('_', ' ')} variant={confidenceVariant(cvLabel)} dot />
            <Badge text={setup.status} variant={statusVariant(setup.status)} />
            {rsRating != null && <RSBadge rating={rsRating} label={rsLabel ?? 'AVERAGE'} />}
          </div>
          {/* Row 2: ticker + price + outlook + sector */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-sm text-white font-mono">{ticker}</span>
            <span className={`text-xs font-medium ${changePct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              ${price.toFixed(2)} ({changePct >= 0 ? '+' : ''}{changePct.toFixed(2)}%)
            </span>
            <Badge
              text={setup.outlook === 'bullish' ? 'Bullish' : 'Bearish'}
              variant={setup.outlook === 'bullish' ? 'bullish' : 'bearish'}
            />
            {sector && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700/60 text-slate-400">{sector}</span>
            )}
          </div>
        </div>

        {expanded
          ? <ChevronDown size={14} className="text-slate-400 flex-shrink-0" />
          : <ChevronRight size={14} className="text-slate-400 flex-shrink-0" />}
      </button>

      {/* ── Expanded body ── */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-slate-700/30 space-y-4 pt-3">

          {/* ── CONVICTION STACK ── */}
          <div>
            <p className="stat-label mb-2">Conviction Stack</p>
            <div className="space-y-1.5 p-3 rounded-lg bg-slate-900/50 border border-slate-700/40">
              <SignalBar
                label="Setup Pattern"
                score={setup.confidence}
                icon={BarChart2}
                color="amber"
              />
              <SignalBar
                label="RS Rating"
                score={rsRating ?? 50}
                icon={TrendingUp}
                color="blue"
              />
              <SignalBar
                label="Insider Activity"
                score={insider?.score ?? 50}
                icon={Users}
                color="emerald"
              />
              <SignalBar
                label="Block Activity"
                score={blockActivity?.score ?? 50}
                icon={Activity}
                color="violet"
              />
              <SignalBar
                label="Earnings Quality"
                score={earnings?.score ?? 50}
                icon={TrendingUp}
                color="cyan"
              />
              {/* Total */}
              <div className="pt-1.5 border-t border-slate-700/50 flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Conviction Score</span>
                <span className={`text-sm font-bold ${
                  (conviction ?? 50) >= 80 ? 'text-amber-400' :
                  (conviction ?? 50) >= 65 ? 'text-blue-400' : 'text-slate-400'
                }`}>{conviction ?? setup.confidence}/100</span>
              </div>
            </div>
          </div>

          {/* ── SETUP CRITERIA ── */}
          <div>
            <p className="stat-label mb-1.5">Setup Criteria</p>
            <div className="space-y-1">
              {(setup.criteria ?? []).map((c: string, i: number) => (
                <div key={i} className="flex items-start gap-1.5">
                  <CheckCircle2 size={11} className="text-emerald-400 mt-0.5 flex-shrink-0" />
                  <span className="text-xs text-slate-300">{c}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── ACTION LEVELS ── */}
          <div>
            <p className="stat-label mb-1.5">Action Levels</p>
            <div className="grid grid-cols-3 gap-2">
              <div className="p-2.5 rounded-lg bg-emerald-500/5 border border-emerald-500/20 text-center">
                <p className="text-[10px] text-emerald-400 font-semibold uppercase tracking-wide mb-0.5">Entry</p>
                <p className="text-sm font-bold text-emerald-400">${setup.entry.toFixed(2)}</p>
              </div>
              <div className="p-2.5 rounded-lg bg-red-500/5 border border-red-500/20 text-center">
                <p className="text-[10px] text-red-400 font-semibold uppercase tracking-wide mb-0.5">Stop</p>
                <p className="text-sm font-bold text-red-400">${setup.stop.toFixed(2)}</p>
              </div>
              <div className="p-2.5 rounded-lg bg-blue-500/5 border border-blue-500/20 text-center">
                <p className="text-[10px] text-blue-400 font-semibold uppercase tracking-wide mb-0.5">Target</p>
                <p className="text-sm font-bold text-blue-400">${setup.target.toFixed(2)}</p>
              </div>
            </div>
          </div>

          {/* ── VOLUME PROFILE + VWAP ── */}
          {volProfile && (
            <div>
              <p className="stat-label mb-1.5">Volume Profile — Key Levels</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2.5 rounded-lg bg-slate-900/50 border border-slate-700/40 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wide">POC</span>
                    <span className="text-xs font-bold text-amber-400">${volProfile.poc.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wide">VAH</span>
                    <span className="text-xs font-bold text-emerald-400">${volProfile.valueAreaHigh.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wide">VAL</span>
                    <span className="text-xs font-bold text-red-400">${volProfile.valueAreaLow.toFixed(2)}</span>
                  </div>
                </div>
                {avwap != null && (
                  <div className="p-2.5 rounded-lg bg-slate-900/50 border border-slate-700/40 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-slate-500 uppercase tracking-wide">AVWAP (20d)</span>
                      <span className="text-xs font-bold text-violet-400">${avwap.toFixed(2)}</span>
                    </div>
                    <p className="text-[10px] text-slate-600 leading-tight mt-1">
                      Anchored VWAP is a dynamic mean-reversion level used by institutional desks
                    </p>
                  </div>
                )}
              </div>
              <p className="text-[10px] text-slate-600 mt-1">
                POC = price magnet · VAH/VAL = 70% of 90d volume traded between these levels
              </p>
            </div>
          )}

          {/* ── BLOCK / INSTITUTIONAL ACTIVITY ── */}
          {blockActivity && blockActivity.signal !== 'NEUTRAL' && (
            <div>
              <p className="stat-label mb-1.5">Block / Institutional Activity</p>
              <BlockActivityChip
                signal={blockActivity.signal}
                accumDays={blockActivity.accumDays}
                distribDays={blockActivity.distribDays}
              />
              <p className="text-[10px] text-slate-600 mt-1">
                High-volume, tight-range candles — institutional footprint without moving the market
              </p>
            </div>
          )}

          {/* ── FINRA SHORT SALE RATIO ── */}
          {shortRatio != null && (
            <div>
              <p className="stat-label mb-1.5">Short-Sale Activity (FINRA RegSHO)</p>
              <ShortRatioChip ratio={shortRatio} />
              {shortRatio >= 0.40 && shortRatio <= 0.55 && (
                <p className="text-[10px] text-slate-600 mt-1">
                  {(shortRatio * 100).toFixed(0)}% short-sale ratio — neutral range
                </p>
              )}
            </div>
          )}

          {/* ── INSIDER ACTIVITY ── */}
          {insider && (insider.buys90d > 0 || insider.clusterBuy || insider.seniorBuy) && (
            <div>
              <p className="stat-label mb-1.5">Insider Transactions (90d)</p>
              <div className="p-2.5 rounded-lg bg-slate-900/50 border border-slate-700/40 space-y-1">
                {insider.buys90d > 0 && (
                  <div className="flex items-center gap-2">
                    <Users size={10} className="text-emerald-400 flex-shrink-0" />
                    <span className="text-xs text-slate-300">
                      {insider.buys90d} open-market purchase{insider.buys90d !== 1 ? 's' : ''}
                      {insider.totalValue > 0 && ` · $${insider.totalValue >= 1e6
                        ? `${(insider.totalValue / 1e6).toFixed(1)}M`
                        : `${(insider.totalValue / 1e3).toFixed(0)}K`} total`}
                    </span>
                  </div>
                )}
                {insider.clusterBuy && (
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={10} className="text-amber-400 flex-shrink-0" />
                    <span className="text-xs text-amber-300 font-medium">Cluster buy — 3+ insiders in 30 days</span>
                  </div>
                )}
                {insider.seniorBuy && (
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={10} className="text-amber-400 flex-shrink-0" />
                    <span className="text-xs text-amber-300 font-medium">C-suite open-market purchase</span>
                  </div>
                )}
                {insider.lastBuyDaysAgo != null && (
                  <p className="text-[10px] text-slate-500">Last buy: {insider.lastBuyDaysAgo}d ago</p>
                )}
              </div>
            </div>
          )}

          {/* ── EARNINGS QUALITY ── */}
          {earnings && earnings.beatRate != null && (
            <div>
              <p className="stat-label mb-1.5">Earnings Quality</p>
              <div className="grid grid-cols-3 gap-2">
                <div className="p-2 rounded-lg bg-slate-900/50 border border-slate-700/40 text-center">
                  <p className="text-[10px] text-slate-500 mb-0.5">Beat Rate</p>
                  <p className={`text-xs font-bold ${earnings.beatRate >= 0.75 ? 'text-emerald-400' : earnings.beatRate >= 0.5 ? 'text-amber-400' : 'text-red-400'}`}>
                    {Math.round(earnings.beatRate * 100)}%
                  </p>
                </div>
                <div className="p-2 rounded-lg bg-slate-900/50 border border-slate-700/40 text-center">
                  <p className="text-[10px] text-slate-500 mb-0.5">Est. Trend</p>
                  <p className={`text-xs font-bold ${earnings.estimateTrend === 'RISING' ? 'text-emerald-400' : earnings.estimateTrend === 'FALLING' ? 'text-red-400' : 'text-slate-400'}`}>
                    {earnings.estimateTrend === 'RISING' ? '↑ Rising' : earnings.estimateTrend === 'FALLING' ? '↓ Falling' : '→ Flat'}
                  </p>
                </div>
                <div className="p-2 rounded-lg bg-slate-900/50 border border-slate-700/40 text-center">
                  <p className="text-[10px] text-slate-500 mb-0.5">Last Surprise</p>
                  <p className={`text-xs font-bold ${(earnings.lastSurprisePct ?? 0) > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {earnings.lastSurprisePct != null
                      ? `${earnings.lastSurprisePct > 0 ? '+' : ''}${earnings.lastSurprisePct.toFixed(1)}%`
                      : '—'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ── R:R + Hold + Disclaimer ── */}
          <div className="flex items-center gap-4 flex-wrap pt-1 border-t border-slate-700/30">
            <div className="flex items-center gap-1.5">
              <span className="stat-label">R:R</span>
              <span className={`text-xs font-bold ${rrGood ? 'text-emerald-400' : 'text-slate-300'}`}>
                {setup.riskReward}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="stat-label">Hold</span>
              <span className="text-xs text-slate-300">{setup.holdPeriod}</span>
            </div>
          </div>

          <p className="text-[10px] text-slate-600 flex items-center gap-1">
            <AlertTriangle size={9} />
            Educational only. Always use a stop-loss. Not financial advice.
          </p>
        </div>
      )}
    </div>
  );
}
