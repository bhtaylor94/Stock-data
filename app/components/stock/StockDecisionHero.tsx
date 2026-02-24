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
  const changePercent: number | undefined = (analysis as any)?.changePercent;

  const priceColor = changePercent !== undefined && changePercent !== null
    ? (changePercent >= 0 ? 'text-emerald-400' : 'text-red-400')
    : 'text-emerald-400';

  const scoreColor =
    score >= 14 ? 'bg-emerald-400' :
    score >= 11 ? 'bg-blue-400' :
    score >= 7  ? 'bg-amber-400' : 'bg-red-400';

  const scoreText =
    score >= 14 ? 'text-emerald-400' :
    score >= 11 ? 'text-blue-400' :
    score >= 7  ? 'text-amber-400' : 'text-red-400';

  const isStale = meta?.isStale;

  return (
    <div className="p-4 rounded-2xl border backdrop-blur-sm"
         style={{ background: 'rgba(15,23,42,0.85)', borderColor: 'var(--border)' }}>

      {/* Row 1: Ticker + company name + freshness badge */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-baseline gap-2 min-w-0">
          <h1 className="text-2xl font-bold text-white leading-tight flex-shrink-0">{ticker}</h1>
          <p className="text-xs text-slate-400 truncate">{companyName}</p>
        </div>
        {meta?.asOf && (
          <div className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-lg border flex-shrink-0 ${
            isStale
              ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
              : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
          }`}>
            {isStale ? <Clock size={9} /> : <CheckCircle2 size={9} />}
            {isStale ? 'Stale' : 'Live'}
          </div>
        )}
      </div>

      {/* Row 2: Price + change% + rating badge + confidence */}
      <div className="flex items-center gap-2 flex-wrap mb-2">
        <span className={`text-2xl font-bold leading-tight ${priceColor}`}>
          ${price?.toFixed(2) || 'N/A'}
        </span>
        {changePercent !== undefined && changePercent !== null && (
          <span className={`text-sm font-semibold ${changePercent >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {changePercent >= 0 ? '+' : ''}{changePercent.toFixed(2)}%
          </span>
        )}
        <Badge text={rating.replace('_', ' ')} variant={ratingToBadgeVariant(rating)} />
        <span className={`text-xs font-semibold ${
          confidenceTier === 'HIGH' ? 'text-emerald-400' :
          confidenceTier === 'MED'  ? 'text-blue-400' : 'text-slate-400'
        }`}>{confidence}% conf</span>
      </div>

      {/* Row 3: Score bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="stat-label">Score</span>
          <span className={`text-xs font-bold ${scoreText}`}>{score}/{maxScore}</span>
        </div>
        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-700 ease-out ${scoreColor}`}
            style={{ width: `${(score / maxScore) * 100}%` }}
          />
        </div>
      </div>

      {/* Row 4: Action buttons */}
      {action !== 'NO_TRADE' && (
        <div className="flex gap-1.5">
          {onTrack && (
            <button onClick={onTrack} className="btn-primary flex-1 justify-center gap-1 py-1.5 text-xs">
              <Bookmark size={11} />
              Track
            </button>
          )}
          {onTrade && (
            <button
              onClick={onTrade}
              className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg font-semibold text-xs transition-all ${
                action === 'BUY'
                  ? 'bg-emerald-500 hover:brightness-110 text-white'
                  : action === 'SELL'
                    ? 'bg-red-500 hover:brightness-110 text-white'
                    : 'bg-slate-700 hover:bg-slate-600 text-white'
              }`}
            >
              {action === 'BUY' ? <TrendingUp size={11} /> : action === 'SELL' ? <TrendingDown size={11} /> : null}
              {action === 'BUY' ? 'Buy' : action === 'SELL' ? 'Sell' : 'Trade'}
            </button>
          )}
          {onViewEvidence && (
            <button onClick={onViewEvidence} className="btn-ghost gap-1 py-1.5 text-xs">
              <BookOpen size={11} />
              Evidence
            </button>
          )}
        </div>
      )}

      {/* NO_TRADE warning */}
      {action === 'NO_TRADE' && (
        <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30">
          <p className="text-xs font-medium text-amber-400 flex items-center gap-1.5">
            <AlertTriangle size={11} />
            No Trade Recommended
          </p>
          <p className="text-xs text-slate-400 mt-0.5">
            {meta?.tradeDecision?.rationale?.[0] || 'Conditions not favorable'}
          </p>
          {onViewEvidence && (
            <button onClick={onViewEvidence} className="btn-ghost gap-1 py-1 text-xs mt-1.5">
              <BookOpen size={10} />
              Evidence
            </button>
          )}
        </div>
      )}
    </div>
  );
}
