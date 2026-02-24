import React from 'react';
import { Bookmark, BarChart2, CheckCircle2, Clock } from 'lucide-react';
import { COMPANY_NAMES } from '@/lib/companyNames';
import Badge from '@/app/components/core/Badge';

type BadgeVariant = 'bullish' | 'bearish' | 'neutral' | 'info';

function actionVariant(action: string): BadgeVariant {
  if (action === 'BUY' || action === 'CALL') return 'bullish';
  if (action === 'SELL' || action === 'PUT') return 'bearish';
  if (action === 'NO_TRADE') return 'neutral';
  return 'info';
}

export function OptionsDecisionHero({
  ticker,
  currentPrice,
  meta,
  suggestions,
  onViewEvidence,
  priceChange,
}: {
  ticker: string;
  currentPrice?: number;
  meta: any;
  suggestions?: any[];
  onViewEvidence?: () => void;
  priceChange?: number;
}) {
  const action = meta?.tradeDecision?.action || 'NO_TRADE';
  const confidence = meta?.tradeDecision?.confidence || 0;
  const companyName = COMPANY_NAMES[ticker] || ticker;
  const topSuggestion = suggestions?.[0];
  const strategy = topSuggestion?.strategy || '';
  const isStale = meta?.isStale;

  return (
    <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-800/95 to-slate-900/95 backdrop-blur-sm border border-slate-700/50 shadow-xl">

      {/* Row 1: Ticker + company + live badge */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-baseline gap-2 min-w-0">
          <h1 className="text-2xl font-bold text-white leading-tight flex-shrink-0">{ticker}</h1>
          <p className="text-xs text-slate-400 truncate">{companyName}</p>
        </div>
        <div className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-lg border flex-shrink-0 ${
          isStale
            ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
            : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
        }`}>
          {isStale ? <Clock size={9} /> : <CheckCircle2 size={9} />}
          {isStale ? 'Stale' : 'Live'}
        </div>
      </div>

      {/* Row 2: Price + change% + action badge + confidence */}
      {currentPrice && (
        <div className="flex items-center gap-2 flex-wrap mb-2">
          <span className="text-2xl font-bold text-white leading-tight">
            ${currentPrice.toFixed(2)}
          </span>
          {priceChange !== undefined && priceChange !== null && (
            <span className={`text-sm font-semibold ${priceChange >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}%
            </span>
          )}
          {action !== 'NO_TRADE' && (
            <Badge text={action} variant={actionVariant(action)} />
          )}
          {action !== 'NO_TRADE' && confidence > 0 && (
            <span className={`text-xs font-semibold ${
              confidence >= 75 ? 'text-emerald-400' :
              confidence >= 60 ? 'text-blue-400' : 'text-amber-400'
            }`}>{confidence}% conf</span>
          )}
        </div>
      )}

      {/* Row 3: Strategy name (if trade recommended) */}
      {action !== 'NO_TRADE' && strategy && (
        <p className="text-xs text-slate-300 mb-2 truncate">{strategy}</p>
      )}

      {/* Row 4: No-trade message or action buttons */}
      {action === 'NO_TRADE' ? (
        <p className="text-xs text-slate-500 mb-2">No trade recommended</p>
      ) : topSuggestion && (
        <div className="flex gap-1.5 mb-1">
          <button className="btn-primary flex-1 justify-center gap-1 py-1.5 text-xs">
            <Bookmark size={11} />Track Setup
          </button>
          {onViewEvidence && (
            <button onClick={onViewEvidence} className="btn-ghost gap-1 py-1.5 text-xs">
              <BarChart2 size={11} />Evidence
            </button>
          )}
        </div>
      )}

      {/* Options label */}
      <p className="text-[10px] text-slate-600">
        Options · {meta?.asOf && new Date(meta.asOf).toLocaleTimeString()} · {meta?.responseTimeMs}ms
      </p>
    </div>
  );
}
