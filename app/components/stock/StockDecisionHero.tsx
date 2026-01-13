import React from 'react';
import { COMPANY_NAMES } from '@/lib/companyNames';

export function StockDecisionHero({ 
  ticker, 
  price, 
  analysis, 
  meta,
  onTrack,
  onViewEvidence
}: { 
  ticker: string;
  price: number;
  analysis: any;
  meta: any;
  onTrack?: () => void;
  onViewEvidence?: () => void;
}) {
  const rating = analysis?.combined?.rating || 'HOLD';
  const score = analysis?.combined?.score || 0;
  const maxScore = analysis?.combined?.maxScore || 18;
  const confidence = meta?.tradeDecision?.confidence || 0;
  const confidenceTier = meta?.tradeDecision?.confidenceBucket || 'N/A';
  const action = meta?.tradeDecision?.action || 'HOLD';
  const companyName = COMPANY_NAMES[ticker] || ticker;
  
  // Get price change from parent (passed through from API response)
  const priceChange = (analysis as any)?.changePercent;
  
  return (
    <div className="sticky top-0 z-10 p-5 rounded-2xl bg-gradient-to-br from-slate-800/95 to-slate-900/95 backdrop-blur-sm border border-slate-700/50 shadow-xl">
      {/* Ticker + Price Row */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          {/* Ticker - Large and Bold */}
          <h1 className="text-4xl font-bold text-white leading-tight">{ticker}</h1>
          {/* Company Name - Smaller, underneath ticker */}
          <p className="text-sm text-slate-400 mt-1 mb-3">{companyName}</p>
          {/* Price - Balanced size with percentage change */}
          <div className="flex items-baseline gap-3">
            <p className="text-4xl font-bold text-emerald-400 leading-tight">
              ${price?.toFixed(2) || 'N/A'}
            </p>
            {/* Percentage Change - Green if up, Red if down */}
            {priceChange !== undefined && priceChange !== null && (
              <span className={`text-xl font-semibold ${
                priceChange >= 0 ? 'text-emerald-400' : 'text-red-400'
              }`}>
                {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}%
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {meta?.source || 'Live'} • {meta?.asOf && new Date(meta.asOf).toLocaleTimeString()}
          </p>
        </div>
        
        {/* Freshness Badge */}
        {meta?.asOf && (
          <div className={`text-xs px-2 py-1 rounded ${
            meta.isStale ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'
          }`}>
            {meta.isStale ? '⏱️ Stale' : '✓ Fresh'} • {meta.responseTimeMs}ms
          </div>
        )}
      </div>

      {/* Recommendation + Confidence */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className={`p-3 rounded-xl border ${
          rating === 'STRONG_BUY' ? 'border-emerald-500/40 bg-emerald-500/10' :
          rating === 'BUY' ? 'border-blue-500/40 bg-blue-500/10' :
          rating === 'HOLD' ? 'border-amber-500/40 bg-amber-500/10' :
          'border-red-500/40 bg-red-500/10'
        }`}>
          <p className="text-xs text-slate-400 mb-1">Recommendation</p>
          <p className={`text-lg font-bold ${
            rating === 'STRONG_BUY' ? 'text-emerald-400' :
            rating === 'BUY' ? 'text-blue-400' :
            rating === 'HOLD' ? 'text-amber-400' : 'text-red-400'
          }`}>
            {rating.replace('_', ' ')}
          </p>
        </div>
        
        <div className="p-3 rounded-xl border border-slate-700 bg-slate-800/30">
          <p className="text-xs text-slate-400 mb-1">Confidence</p>
          <div className="flex items-baseline gap-2">
            <p className="text-lg font-bold text-white">{confidence}%</p>
            <span className={`text-xs px-1.5 py-0.5 rounded ${
              confidenceTier === 'HIGH' ? 'bg-emerald-500/20 text-emerald-400' :
              confidenceTier === 'MED' ? 'bg-blue-500/20 text-blue-400' :
              'bg-slate-500/20 text-slate-400'
            }`}>{confidenceTier}</span>
          </div>
        </div>
      </div>

      {/* Score Bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-slate-400">Analysis Score</span>
          <span className={`text-sm font-bold ${
            score >= 14 ? 'text-emerald-400' :
            score >= 11 ? 'text-blue-400' :
            score >= 7 ? 'text-amber-400' : 'text-red-400'
          }`}>{score}/{maxScore}</span>
        </div>
        <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
          <div 
            className={`h-full transition-all ${
              score >= 14 ? 'bg-emerald-400' :
              score >= 11 ? 'bg-blue-400' :
              score >= 7 ? 'bg-amber-400' : 'bg-red-400'
            }`}
            style={{ width: `${(score / maxScore) * 100}%` }}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        {action !== 'NO_TRADE' && onTrack && (
          <button
            onClick={onTrack}
            className="flex-1 px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white font-medium transition"
          >
            📌 Track Position
          </button>
        )}
        {onViewEvidence && (
          <button 
            onClick={onViewEvidence}
            className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white transition"
          >
            📊 View Evidence
          </button>
        )}
      </div>

      {/* NO_TRADE Warning */}
      {action === 'NO_TRADE' && (
        <div className="mt-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
          <p className="text-sm font-medium text-amber-400 mb-1">⚠️ No Trade Recommended</p>
          <p className="text-xs text-slate-400">
            {meta?.tradeDecision?.rationale?.[0] || 'Conditions not favorable'}
          </p>
        </div>
      )}
    </div>
  );
}
