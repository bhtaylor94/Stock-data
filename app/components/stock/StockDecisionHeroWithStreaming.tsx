import React from 'react';
import { COMPANY_NAMES } from '@/lib/companyNames';
import { useRealtimePrice } from '../../hooks/useRealtimePrice';
import { StreamingBadge } from '../core/StreamingIndicator';

export function StockDecisionHeroWithStreaming({ 
  ticker, 
  price: initialPrice, 
  analysis, 
  meta,
  onTrack,
  onViewEvidence,
  onTrade
}: { 
  ticker: string;
  price: number;
  analysis: any;
  meta: any;
  onTrack?: () => void;
  onViewEvidence?: () => void;
  onTrade?: () => void;
}) {
  // Use streaming price if available, fall back to initial
  const { price: streamingData, isStreaming } = useRealtimePrice(ticker, initialPrice);
  const price = streamingData?.price || initialPrice;
  const change = streamingData?.change || 0;
  const changePercent = streamingData?.changePercent || (analysis as any)?.changePercent || 0;
  
  const rating = analysis?.combined?.rating || 'HOLD';
  const score = analysis?.combined?.score || 0;
  const maxScore = analysis?.combined?.maxScore || 18;
  const confidence = meta?.tradeDecision?.confidence || 0;
  const confidenceTier = meta?.tradeDecision?.confidenceBucket || 'N/A';
  const action = meta?.tradeDecision?.action || 'HOLD';
  const companyName = COMPANY_NAMES[ticker] || ticker;
  
  const ratingColor = 
    rating === 'STRONG_BUY' || rating === 'BUY' ? 'emerald' :
    rating === 'SELL' || rating === 'STRONG_SELL' ? 'red' :
    rating === 'HOLD' ? 'amber' : 'slate';

  const actionColor = 
    action === 'STRONG_BUY' || action === 'BUY' ? 'emerald' :
    action === 'SELL' || action === 'STRONG_SELL' ? 'red' :
    action === 'HOLD' ? 'amber' :
    action === 'NO_TRADE' ? 'slate' : 'slate';

  return (
    <div className={`p-6 rounded-2xl border border-${actionColor}-500/30 bg-gradient-to-br from-${actionColor}-500/10 to-${actionColor}-600/5`}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h2 className="text-3xl font-bold text-white">{ticker}</h2>
            {isStreaming && <StreamingBadge />}
          </div>
          <p className="text-slate-400 text-sm">{companyName}</p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold text-white">
            ${price.toFixed(2)}
          </div>
          <div className={`text-sm font-medium ${changePercent >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {changePercent >= 0 ? '+' : ''}{changePercent.toFixed(2)}%
            {change !== 0 && ` (${change >= 0 ? '+' : ''}$${Math.abs(change).toFixed(2)})`}
          </div>
          {isStreaming && streamingData && (
            <div className="text-xs text-slate-500 mt-1">
              Bid ${streamingData.bid?.toFixed(2)} / Ask ${streamingData.ask?.toFixed(2)}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className={`p-4 rounded-xl border border-${ratingColor}-500/30 bg-${ratingColor}-500/10`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-400">Model Rating</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700 text-slate-300">
              {score}/{maxScore}
            </span>
          </div>
          <div className={`text-2xl font-bold text-${ratingColor}-400`}>
            {rating.replace('_', ' ')}
          </div>
          {rating === 'STRONG_BUY' && <div className="text-xs text-emerald-400 mt-1">⭐⭐⭐⭐⭐</div>}
          {rating === 'BUY' && <div className="text-xs text-emerald-400 mt-1">⭐⭐⭐⭐</div>}
          {rating === 'HOLD' && <div className="text-xs text-amber-400 mt-1">⭐⭐⭐</div>}
          {rating === 'SELL' && <div className="text-xs text-red-400 mt-1">⭐⭐</div>}
          {rating === 'STRONG_SELL' && <div className="text-xs text-red-400 mt-1">⭐</div>}
        </div>

        <div className={`p-4 rounded-xl border border-${actionColor}-500/30 bg-${actionColor}-500/10`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-400">Trade Decision</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700 text-slate-300">
              {confidence}% {confidenceTier}
            </span>
          </div>
          <div className={`text-2xl font-bold text-${actionColor}-400`}>
            {action === 'NO_TRADE' ? 'NO TRADE' : action.replace('_', ' ')}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            {action === 'NO_TRADE' ? 'Quality gates not met' : `${confidence}% confidence`}
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        {onTrack && (
          <button
            onClick={onTrack}
            className="flex-1 py-3 rounded-xl bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border border-blue-500/30 font-medium transition"
          >
            📌 Track
          </button>
        )}
        {onViewEvidence && (
          <button
            onClick={onViewEvidence}
            className="flex-1 py-3 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 border border-purple-500/30 font-medium transition"
          >
            🔍 Evidence
          </button>
        )}
        {onTrade && action !== 'NO_TRADE' && (
          <button
            onClick={onTrade}
            className={`flex-1 py-3 rounded-xl bg-${actionColor}-500/20 hover:bg-${actionColor}-500/30 text-${actionColor}-400 border border-${actionColor}-500/30 font-medium transition`}
          >
            💰 {action === 'BUY' || action === 'STRONG_BUY' ? 'Buy Now' : action === 'SELL' || action === 'STRONG_SELL' ? 'Sell Now' : 'Trade'}
          </button>
        )}
      </div>
    </div>
  );
}
