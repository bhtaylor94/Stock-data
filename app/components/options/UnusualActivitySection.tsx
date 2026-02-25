import React from 'react';
import { Bookmark, Shield, Target, TrendingUp, TrendingDown, AlertTriangle, RefreshCw } from 'lucide-react';
import Badge from '@/app/components/core/Badge';

// ── Alert type chip ─────────────────────────────────────────────────────────
type AlertType = 'GOLDEN_SWEEP' | 'SWEEP' | 'BLOCK' | 'UNUSUAL_VOLUME' | 'REPEATED_HIT';
type AggressionProxy = 'AA' | 'A' | 'M' | 'B' | 'BB';

function alertTypeChip(alertType: AlertType) {
  const map: Record<AlertType, { label: string; cls: string }> = {
    GOLDEN_SWEEP:   { label: 'Golden Sweep',   cls: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
    SWEEP:          { label: 'Sweep',           cls: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
    BLOCK:          { label: 'Block',           cls: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30' },
    UNUSUAL_VOLUME: { label: 'Unusual Vol',     cls: 'bg-slate-500/20 text-slate-300 border-slate-500/30' },
    REPEATED_HIT:   { label: 'Repeat Flow',     cls: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  };
  const { label, cls } = map[alertType] ?? { label: alertType, cls: 'bg-slate-500/20 text-slate-300 border-slate-500/30' };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold ${cls}`}>{label}</span>
  );
}

function aggressionPill(proxy: AggressionProxy) {
  const map: Record<AggressionProxy, { label: string; cls: string }> = {
    AA: { label: 'AA — Lifted Ask+', cls: 'bg-emerald-500/20 text-emerald-400' },
    A:  { label: 'A — Ask Side',     cls: 'bg-emerald-500/10 text-emerald-500' },
    M:  { label: 'M — Mid',          cls: 'bg-slate-500/20 text-slate-400' },
    B:  { label: 'B — Bid Side',     cls: 'bg-red-500/10 text-red-400' },
    BB: { label: 'BB — Hit Bid',     cls: 'bg-red-500/20 text-red-500' },
  };
  const { label, cls } = map[proxy] ?? { label: proxy, cls: 'bg-slate-500/20 text-slate-400' };
  return (
    <span className={`text-xs px-2 py-0.5 rounded font-mono font-semibold ${cls}`}>{label}</span>
  );
}

// ── UOA score color ──────────────────────────────────────────────────────────
function scoreColor(score: number): string {
  if (score >= 75) return 'text-amber-400';
  if (score >= 55) return 'text-blue-400';
  if (score >= 35) return 'text-slate-300';
  return 'text-slate-500';
}

// ── Individual card ──────────────────────────────────────────────────────────
function UnusualActivityCard({
  activity,
  onTrack,
}: {
  activity: any;
  onTrack?: (contract: any) => void;
}) {
  const score: number = activity.uoaScore ?? activity.confidence ?? 0;
  const alertType: AlertType = activity.alertType ?? 'UNUSUAL_VOLUME';
  const proxy: AggressionProxy = activity.aggressionProxy ?? 'M';
  const sentiment: string = activity.sentiment ?? 'NEUTRAL';
  const tradeType: string = activity.tradeType ?? 'UNCERTAIN';
  const isHedge = activity.hedgeDiscountApplied ?? (tradeType === 'LIKELY_HEDGE');
  const isRepeat = activity.isRepeatFlow ?? false;
  const consecutiveDays: number = activity.consecutiveDays ?? 0;

  const borderColor =
    sentiment === 'BULLISH' ? 'border-l-emerald-500' :
    sentiment === 'BEARISH' ? 'border-l-red-500' :
    'border-l-slate-500';

  return (
    <div className={`rounded-xl border border-slate-700/50 bg-slate-800/20 border-l-4 ${borderColor}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 px-4 py-3">
        <div className="flex-1 min-w-0">
          {/* Strike / Type / Expiration */}
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <span className="text-base font-bold text-white">
              ${activity.strike} {activity.type?.toUpperCase()}
            </span>
            <span className="text-xs text-slate-400 font-mono">{activity.expiration ?? `${activity.dte}d`}</span>
            {alertTypeChip(alertType)}
            {isRepeat && consecutiveDays >= 2 && (
              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-400 border border-purple-500/25">
                <RefreshCw size={9} />{consecutiveDays}d streak
              </span>
            )}
          </div>

          {/* Sentiment + aggression + trade type */}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge
              text={sentiment}
              variant={sentiment === 'BULLISH' ? 'bullish' : sentiment === 'BEARISH' ? 'bearish' : 'neutral'}
            />
            {aggressionPill(proxy)}
            {isHedge ? (
              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-purple-500/10 text-purple-400">
                <Shield size={9} />Hedge
              </span>
            ) : tradeType === 'DIRECTIONAL' ? (
              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-blue-500/10 text-blue-400">
                <Target size={9} />Directional
              </span>
            ) : null}
          </div>
        </div>

        {/* UOA Score */}
        <div className="flex-shrink-0 text-right">
          <p className={`text-2xl font-bold leading-tight ${scoreColor(score)}`}>{score}</p>
          <p className="text-xs text-slate-500">UOA score</p>
          {activity.tier && (
            <p className={`text-xs font-semibold mt-0.5 ${scoreColor(score)}`}>{activity.tier}</p>
          )}
        </div>
      </div>

      {/* Hedge discount warning */}
      {isHedge && (
        <div className="mx-4 mb-3 px-2.5 py-2 rounded-lg bg-purple-500/8 border border-purple-500/20">
          <p className="text-xs text-purple-400 flex items-center gap-1.5">
            <Shield size={10} />
            Hedge discount applied — score reduced. Likely portfolio protection, not directional.
          </p>
        </div>
      )}

      {/* Metrics grid */}
      <div className="grid grid-cols-5 gap-1.5 px-4 pb-3 text-xs">
        <div className="p-2 rounded-lg bg-slate-900/50 text-center">
          <p className="stat-label">Vol</p>
          <p className="font-bold text-amber-400">{activity.metrics?.volume?.toLocaleString() ?? activity.volume?.toLocaleString()}</p>
        </div>
        <div className="p-2 rounded-lg bg-slate-900/50 text-center">
          <p className="stat-label">OI</p>
          <p className="font-bold text-white">{activity.metrics?.openInterest?.toLocaleString() ?? activity.openInterest?.toLocaleString()}</p>
        </div>
        <div className="p-2 rounded-lg bg-slate-900/50 text-center">
          <p className="stat-label">Vol/OI</p>
          <p className="font-bold text-orange-400">{(activity.metrics?.volumeOIRatio ?? activity.volumeOIRatio)?.toFixed(1)}x</p>
        </div>
        <div className="p-2 rounded-lg bg-slate-900/50 text-center">
          <p className="stat-label">DTE</p>
          <p className="font-bold text-white">{activity.dte}d</p>
        </div>
        <div className="p-2 rounded-lg bg-slate-900/50 text-center">
          <p className="stat-label">Premium</p>
          <p className="font-bold text-emerald-400">
            {activity.metrics?.premium
              ? activity.metrics.premium >= 1e6
                ? `$${(activity.metrics.premium / 1e6).toFixed(1)}M`
                : `$${(activity.metrics.premium / 1e3).toFixed(0)}K`
              : 'N/A'}
          </p>
        </div>
      </div>

      {/* Signals */}
      {activity.signals?.length > 0 && (
        <div className="flex flex-wrap gap-1 px-4 pb-3">
          {activity.signals.slice(0, 4).map((sig: string) => (
            <span key={sig} className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700/50">
              {sig}
            </span>
          ))}
        </div>
      )}

      {/* Insider signals */}
      {activity.insiderSignals?.length > 0 && activity.insiderProbability !== 'UNLIKELY' && (
        <div className="mx-4 mb-3 p-2.5 rounded-lg bg-red-500/5 border border-red-500/20">
          <p className="text-xs text-red-400 font-medium mb-1 flex items-center gap-1.5">
            <AlertTriangle size={10} /> Insider Probability: {activity.insiderProbability}
          </p>
          {activity.insiderSignals.slice(0, 2).map((sig: string) => (
            <p key={sig} className="text-xs text-slate-400">• {sig}</p>
          ))}
        </div>
      )}

      {/* Track button */}
      {onTrack && (
        <div className="px-4 pb-3">
          <button
            onClick={() => onTrack(activity)}
            className="btn-ghost w-full justify-center gap-1.5 text-xs"
          >
            <Bookmark size={11} />Track This Activity
          </button>
        </div>
      )}
    </div>
  );
}

// ── Section ──────────────────────────────────────────────────────────────────
export function UnusualActivitySection({
  activities,
  onTrack,
}: {
  activities: any[];
  onTrack?: (contract: any) => void;
}) {
  if (!activities || activities.length === 0) return null;

  const extremeCount = activities.filter(a => (a.uoaScore ?? 0) >= 75 || a.alertType === 'GOLDEN_SWEEP').length;

  return (
    <div className="p-5 rounded-2xl border border-slate-700/50 bg-slate-800/20">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-white">Smart Money Flow</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {activities.length} unusual signal{activities.length !== 1 ? 's' : ''} detected
            {extremeCount > 0 && ` · ${extremeCount} high-conviction`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {activities.some(a => a.sentiment === 'BULLISH') && (
            <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <TrendingUp size={10} />Bull Flow
            </span>
          )}
          {activities.some(a => a.sentiment === 'BEARISH') && (
            <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-red-500/10 text-red-400 border border-red-500/20">
              <TrendingDown size={10} />Bear Flow
            </span>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {activities.slice(0, 5).map((activity) => (
          <UnusualActivityCard key={activity.optionSymbol} activity={activity} onTrack={onTrack} />
        ))}
      </div>
    </div>
  );
}
