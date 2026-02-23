import React from 'react';
import { CheckCircle2, Clock, BookOpen, TrendingUp, TrendingDown, Bookmark, AlertTriangle } from 'lucide-react';
import { COMPANY_NAMES } from '@/lib/companyNames';
import Badge from '@/app/components/core/Badge';

type BadgeVariant = 'bullish' | 'bearish' | 'neutral' | 'info';

function ratingToBadgeVariant(rating: string): BadgeVariant {
  if (rating === 'STRONG_BUY' || rating === 'BUY') return 'bullish';
  if (rating === 'STRONG_SELL' || rating === 'SELL') return 'bearish';
  return 'neutral';
}

export function StockDecisionHero({
  ticker,
  price,
  analysis,
  meta,
  onTrack,
  onViewEvidence,
  onTrade,
}: {
  ticker: string;
  price: number;
  analysis: any;
  meta: any;
  onTrack?: () => void;
  onViewEvidence?: () => void;
  onTrade?: () => void;
}) {
  const rating = analysis?.combined?.rating || 'HOLD';
  const score = analysis?.combined?.score || 0;
  const maxScore = analysis?.combined?.maxScore || 18;
  const confidence = meta?.tradeDecision?.confidence || 0;
  const confidenceTier = meta?.tradeDecision?.confidenceBucket || 'N/A';
  const action = meta?.tradeDecision?.action || 'HOLD';
  const companyName = COMPANY_NAMES[ticker] || ticker;
  const priceChange = (analysis as any)?.changePercent;

  const scoreColor =
    score >= 14 ? 'bg-emerald-400' :
    score >= 11 ? 'bg-blue-400' :
    score >= 7  ? 'bg-amber-400' : 'bg-red-400';

  const scoreText =
    score >= 14 ? 'text-emerald-400' :
    score >= 11 ? 'text-blue-400' :
    score >= 7  ? 'text-amber-400' : 'text-red-400';

  return (
    <div className="p-5 rounded-2xl border backdrop-blur-sm"
         style={{ background: 'rgba(15,23,42,0.85)', borderColor: 'var(--border)' }}>
      {/* Ticker + Price Row */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h1 className="text-4xl font-bold text-white leading-tight">{ticker}</h1>
          <p className="text-sm text-slate-400 mt-0.5 mb-3">{companyName}</p>
          <div className="flex items-baseline gap-3">
            <p className="text-4xl font-bold text-emerald-400 leading-tight">
              ${price?.toFixed(2) || 'N/A'}
            </p>
            {priceChange !== undefined && priceChange !== null && (
              <span className={`text-xl font-semibold ${priceChange >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}%
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {meta?.source || 'Live'} · {meta?.asOf && new Date(meta.asOf).toLocaleTimeString()}
          </p>
        </div>

        {/* Freshness badge */}
        {meta?.asOf && (
          <div className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg border ${
            meta.isStale
              ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
              : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
          }`}>
            {meta.isStale
              ? <Clock size={11} />
              : <CheckCircle2 size={11} />}
            {meta.isStale ? 'Stale' : 'Fresh'} · {meta.responseTimeMs}ms
          </div>
        )}
      </div>

      {/* Recommendation + Confidence */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="p-3 rounded-xl border" style={{ borderColor: 'var(--border)', background: 'rgba(15,23,42,0.5)' }}>
          <p className="stat-label mb-1">Recommendation</p>
          <Badge text={rating.replace('_', ' ')} variant={ratingToBadgeVariant(rating)} />
        </div>

        <div className="p-3 rounded-xl border" style={{ borderColor: 'var(--border)', background: 'rgba(15,23,42,0.5)' }}>
          <p className="stat-label mb-1">Confidence</p>
          <div className="flex items-baseline gap-2">
            <p className="text-lg font-bold text-white">{confidence}%</p>
            <Badge
              text={confidenceTier}
              variant={confidenceTier === 'HIGH' ? 'bullish' : confidenceTier === 'MED' ? 'info' : 'neutral'}
            />
          </div>
        </div>
      </div>

      {/* Score bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="stat-label">Analysis Score</span>
          <span className={`text-sm font-bold ${scoreText}`}>{score}/{maxScore}</span>
        </div>
        <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-700 ease-out ${scoreColor}`}
            style={{ width: `${(score / maxScore) * 100}%` }}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        {action !== 'NO_TRADE' && onTrack && (
          <button onClick={onTrack} className="btn-primary flex-1 justify-center gap-1.5">
            <Bookmark size={13} />
            Track Position
          </button>
        )}
        {onTrade && action !== 'NO_TRADE' && (
          <button
            onClick={onTrade}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
              action === 'BUY'
                ? 'bg-emerald-500 hover:brightness-110 text-white'
                : action === 'SELL'
                  ? 'bg-red-500 hover:brightness-110 text-white'
                  : 'bg-slate-700 hover:bg-slate-600 text-white'
            }`}
          >
            {action === 'BUY' ? <TrendingUp size={13} /> : action === 'SELL' ? <TrendingDown size={13} /> : null}
            {action === 'BUY' ? 'Buy Now' : action === 'SELL' ? 'Sell Now' : 'Trade'}
          </button>
        )}
        {onViewEvidence && (
          <button onClick={onViewEvidence} className="btn-ghost gap-1.5">
            <BookOpen size={13} />
            Evidence
          </button>
        )}
      </div>

      {/* NO_TRADE Warning */}
      {action === 'NO_TRADE' && (
        <div className="mt-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
          <p className="text-sm font-medium text-amber-400 mb-1 flex items-center gap-1.5">
            <AlertTriangle size={13} />
            No Trade Recommended
          </p>
          <p className="text-xs text-slate-400">
            {meta?.tradeDecision?.rationale?.[0] || 'Conditions not favorable'}
          </p>
        </div>
      )}
    </div>
  );
}
