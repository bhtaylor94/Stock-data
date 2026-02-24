'use client';
import React, { useState } from 'react';
import {
  TrendingUp, TrendingDown, Shield, ChevronDown, ChevronRight,
  Bookmark, AlertTriangle, RefreshCw,
} from 'lucide-react';
import Badge from '@/app/components/core/Badge';

// ── Types ─────────────────────────────────────────────────────────────────────
type AlertType = 'GOLDEN_SWEEP' | 'SWEEP' | 'BLOCK' | 'UNUSUAL_VOLUME' | 'REPEATED_HIT';

interface FlowActivity {
  alertType?: string;
  strike: number;
  type: string;
  expiration?: string;
  dte?: number;
  uoaScore?: number;
  isHedge?: boolean;
  hedgeDiscountApplied?: boolean;
  signals?: string[];
  premiumFormatted?: string;
  sentiment?: string;
  tradeType?: string;
  aggressionProxy?: string;
  isRepeatFlow?: boolean;
  consecutiveDays?: number;
  insiderSignals?: string[];
  insiderProbability?: string;
  tier?: string;
  metrics?: {
    volume?: number;
    openInterest?: number;
    volumeOIRatio?: number;
    premium?: number;
  };
  volume?: number;
  openInterest?: number;
  volumeOIRatio?: number;
  delta?: number;
  confidence?: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function alertChipCls(alertType: string): string {
  switch (alertType) {
    case 'GOLDEN_SWEEP': return 'text-amber-400 bg-amber-500/15 border-amber-500/30';
    case 'SWEEP':        return 'text-blue-400 bg-blue-500/15 border-blue-500/30';
    case 'BLOCK':        return 'text-indigo-400 bg-indigo-500/15 border-indigo-500/30';
    case 'REPEATED_HIT': return 'text-purple-400 bg-purple-500/15 border-purple-500/30';
    default:             return 'text-slate-400 bg-slate-700/20 border-slate-600/30';
  }
}

function alertLabel(alertType: string): string {
  switch (alertType) {
    case 'GOLDEN_SWEEP': return 'Golden Sweep';
    case 'SWEEP':        return 'Sweep';
    case 'BLOCK':        return 'Block';
    case 'REPEATED_HIT': return 'Repeat Flow';
    case 'UNUSUAL_VOLUME': return 'Unusual Vol';
    default: return alertType.replace(/_/g, ' ');
  }
}

function scoreColor(score: number): string {
  if (score >= 75) return 'text-amber-400';
  if (score >= 55) return 'text-blue-400';
  if (score >= 35) return 'text-slate-300';
  return 'text-slate-500';
}

function formatPremium(raw?: number): string {
  if (!raw) return 'N/A';
  if (raw >= 1e6) return `$${(raw / 1e6).toFixed(1)}M`;
  if (raw >= 1e3) return `$${(raw / 1e3).toFixed(0)}K`;
  return `$${raw.toFixed(0)}`;
}

function aggregatePremium(activities: FlowActivity[]): { bullish: number; bearish: number } {
  let bullish = 0;
  let bearish = 0;
  for (const a of activities) {
    const prem = a.metrics?.premium ?? 0;
    if (a.sentiment === 'BULLISH') bullish += prem;
    else if (a.sentiment === 'BEARISH') bearish += prem;
    else {
      // Infer from type if sentiment not set
      const isCall = a.type?.toLowerCase() === 'call';
      if (isCall) bullish += prem;
      else bearish += prem;
    }
  }
  return { bullish, bearish };
}

// ── Expanded detail panel ─────────────────────────────────────────────────────
function ExpandedDetail({
  activity,
  onTrack,
}: {
  activity: FlowActivity;
  onTrack?: (activity: FlowActivity) => void;
}) {
  const isHedge = activity.hedgeDiscountApplied ?? activity.tradeType === 'LIKELY_HEDGE';
  const vol = activity.metrics?.volume ?? activity.volume;
  const oi = activity.metrics?.openInterest ?? activity.openInterest;
  const volOI = activity.metrics?.volumeOIRatio ?? activity.volumeOIRatio;

  return (
    <div className="px-3 pb-3 pt-1 border-t border-slate-800/60 space-y-2">
      {/* Metrics grid */}
      <div className="grid grid-cols-5 gap-1.5 text-xs">
        <div className="p-2 rounded-lg bg-slate-900/60 text-center">
          <p className="text-slate-500 text-[10px] uppercase tracking-wide">Vol</p>
          <p className="font-bold text-amber-400">{vol?.toLocaleString() ?? '—'}</p>
        </div>
        <div className="p-2 rounded-lg bg-slate-900/60 text-center">
          <p className="text-slate-500 text-[10px] uppercase tracking-wide">OI</p>
          <p className="font-bold text-white">{oi?.toLocaleString() ?? '—'}</p>
        </div>
        <div className="p-2 rounded-lg bg-slate-900/60 text-center">
          <p className="text-slate-500 text-[10px] uppercase tracking-wide">Vol/OI</p>
          <p className="font-bold text-orange-400">{volOI?.toFixed(1) ?? '—'}x</p>
        </div>
        <div className="p-2 rounded-lg bg-slate-900/60 text-center">
          <p className="text-slate-500 text-[10px] uppercase tracking-wide">DTE</p>
          <p className="font-bold text-white">{activity.dte ?? '—'}d</p>
        </div>
        <div className="p-2 rounded-lg bg-slate-900/60 text-center">
          <p className="text-slate-500 text-[10px] uppercase tracking-wide">Delta</p>
          <p className="font-bold text-slate-300">{activity.delta?.toFixed(2) ?? '—'}</p>
        </div>
      </div>

      {/* Signal chips */}
      {activity.signals && activity.signals.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {activity.signals.slice(0, 5).map((sig, i) => (
            <span key={i} className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700/50">
              {sig}
            </span>
          ))}
        </div>
      )}

      {/* Hedge warning */}
      {isHedge && (
        <div className="px-2.5 py-2 rounded-lg bg-purple-500/8 border border-purple-500/20">
          <p className="text-xs text-purple-400 flex items-center gap-1.5">
            <Shield size={10} />
            Hedge discount applied — likely portfolio protection, not directional.
          </p>
        </div>
      )}

      {/* Insider signals */}
      {activity.insiderSignals && activity.insiderSignals.length > 0 &&
        activity.insiderProbability !== 'UNLIKELY' && (
        <div className="px-2.5 py-2 rounded-lg bg-red-500/5 border border-red-500/20">
          <p className="text-xs text-red-400 font-medium mb-1 flex items-center gap-1.5">
            <AlertTriangle size={10} /> Insider Probability: {activity.insiderProbability}
          </p>
          {activity.insiderSignals.slice(0, 2).map((sig, i) => (
            <p key={i} className="text-xs text-slate-400">• {sig}</p>
          ))}
        </div>
      )}

      {/* Track button */}
      {onTrack && (
        <button
          onClick={() => onTrack(activity)}
          className="btn-ghost w-full justify-center gap-1.5 text-xs"
        >
          <Bookmark size={11} /> Track This Activity
        </button>
      )}
    </div>
  );
}

// ── Tape row ──────────────────────────────────────────────────────────────────
function TapeRow({
  activity,
  expanded,
  onToggle,
  onTrack,
}: {
  activity: FlowActivity;
  expanded: boolean;
  onToggle: () => void;
  onTrack?: (activity: FlowActivity) => void;
}) {
  const isCall = activity.type?.toLowerCase() === 'call';
  const alertType = activity.alertType ?? 'UNUSUAL_VOLUME';
  const score = activity.uoaScore ?? activity.confidence ?? 0;
  const isHedge = activity.hedgeDiscountApplied ?? activity.tradeType === 'LIKELY_HEDGE';
  const isRepeat = activity.isRepeatFlow ?? false;
  const prem = activity.metrics?.premium ?? 0;

  return (
    <div className={`transition-colors ${isCall ? 'hover:bg-emerald-500/5' : 'hover:bg-red-500/5'}`}>
      {/* Main row — ~44px */}
      <button
        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left"
        onClick={onToggle}
      >
        {/* Direction icon */}
        {isCall
          ? <TrendingUp size={13} className="text-emerald-400 flex-shrink-0" />
          : <TrendingDown size={13} className="text-red-400 flex-shrink-0" />}

        {/* Strike + type */}
        <span className="text-xs font-bold text-white font-mono flex-shrink-0">
          ${activity.strike} {activity.type?.toUpperCase()}
        </span>

        {/* Expiration */}
        <span className="text-xs text-slate-500 flex-shrink-0">
          {activity.expiration ?? (activity.dte != null ? `${activity.dte}d` : '—')}
        </span>

        {/* Alert chip */}
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border flex-shrink-0 ${alertChipCls(alertType)}`}>
          {alertLabel(alertType)}
        </span>

        {/* Repeat flow streak */}
        {isRepeat && (activity.consecutiveDays ?? 0) >= 2 && (
          <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-purple-500/15 text-purple-400 border border-purple-500/25 flex-shrink-0">
            <RefreshCw size={8} />{activity.consecutiveDays}d
          </span>
        )}

        {/* Hedge icon */}
        {isHedge && <Shield size={10} className="text-slate-500 flex-shrink-0" />}

        {/* Spacer */}
        <span className="flex-1" />

        {/* Premium */}
        {prem > 0 && (
          <span className={`text-xs font-semibold flex-shrink-0 ${isCall ? 'text-emerald-400' : 'text-red-400'}`}>
            {formatPremium(prem)}
          </span>
        )}

        {/* Score */}
        {score > 0 && (
          <span className={`text-xs font-bold w-6 text-right flex-shrink-0 ${scoreColor(score)}`}>
            {score}
          </span>
        )}

        {/* Expand chevron */}
        <span className="flex-shrink-0 text-slate-600">
          {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </span>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <ExpandedDetail activity={activity} onTrack={onTrack} />
      )}
    </div>
  );
}

// ── SmartFlowSection (main export) ────────────────────────────────────────────
export function SmartFlowSection({
  activities,
  onTrack,
}: {
  activities: FlowActivity[];
  onTrack?: (activity: FlowActivity) => void;
}) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  if (!activities || activities.length === 0) return null;

  const extremeCount = activities.filter(
    a => (a.uoaScore ?? 0) >= 75 || a.alertType === 'GOLDEN_SWEEP'
  ).length;

  const { bullish, bearish } = aggregatePremium(activities);
  const net = bullish - bearish;
  const total = bullish + bearish;

  const displayed = activities.slice(0, 8);

  return (
    <div className="rounded-2xl border border-slate-700/50 bg-slate-800/20 overflow-hidden">
      {/* ── Header ── */}
      <div className="px-4 pt-4 pb-3 space-y-3">
        {/* Title row */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-white">Smart Money Flow</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {activities.length} signal{activities.length !== 1 ? 's' : ''}
              {extremeCount > 0 && ` · ${extremeCount} high-conviction`}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            {activities.some(a => a.sentiment === 'BULLISH' || a.type?.toLowerCase() === 'call') && (
              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <TrendingUp size={10} />Bull
              </span>
            )}
            {activities.some(a => a.sentiment === 'BEARISH' || a.type?.toLowerCase() === 'put') && (
              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">
                <TrendingDown size={10} />Bear
              </span>
            )}
          </div>
        </div>

        {/* Aggregate sentiment bar */}
        {total > 0 && (
          <div className="space-y-1.5">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="px-2 py-1.5 rounded-lg bg-emerald-500/8 border border-emerald-500/20">
                <p className="text-[10px] text-slate-500 uppercase tracking-wide">Call Flow</p>
                <p className="text-xs font-bold text-emerald-400">{formatPremium(bullish)}</p>
              </div>
              <div className="px-2 py-1.5 rounded-lg bg-red-500/8 border border-red-500/20">
                <p className="text-[10px] text-slate-500 uppercase tracking-wide">Put Flow</p>
                <p className="text-xs font-bold text-red-400">{formatPremium(bearish)}</p>
              </div>
              <div className={`px-2 py-1.5 rounded-lg border ${
                net > 0
                  ? 'bg-emerald-500/8 border-emerald-500/20'
                  : net < 0
                    ? 'bg-red-500/8 border-red-500/20'
                    : 'bg-slate-700/20 border-slate-600/30'
              }`}>
                <p className="text-[10px] text-slate-500 uppercase tracking-wide">Net Flow</p>
                <p className={`text-xs font-bold ${net > 0 ? 'text-emerald-400' : net < 0 ? 'text-red-400' : 'text-slate-400'}`}>
                  {net >= 0 ? '+' : ''}{formatPremium(Math.abs(net))}
                  {net > 0 ? ' ↑' : net < 0 ? ' ↓' : ''}
                </p>
              </div>
            </div>
            {/* Proportional bar */}
            <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden flex">
              <div
                className="h-full bg-emerald-500 transition-all duration-500"
                style={{ width: `${(bullish / total) * 100}%` }}
              />
              <div
                className="h-full bg-red-500 transition-all duration-500"
                style={{ width: `${(bearish / total) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* ── Tape rows ── */}
      <div className="divide-y divide-slate-800/60">
        {displayed.map((activity, i) => (
          <TapeRow
            key={i}
            activity={activity}
            expanded={expandedIndex === i}
            onToggle={() => setExpandedIndex(expandedIndex === i ? null : i)}
            onTrack={onTrack}
          />
        ))}
      </div>

      {activities.length > 8 && (
        <div className="px-4 py-2 border-t border-slate-800/60">
          <p className="text-xs text-slate-500 text-center">
            +{activities.length - 8} more signals
          </p>
        </div>
      )}
    </div>
  );
}
