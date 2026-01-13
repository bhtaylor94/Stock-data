// app/components/stock/StockDecisionHeroStreaming.tsx
// Enhanced version with real-time streaming price updates

'use client';

import React, { useEffect, useState } from 'react';
import { COMPANY_NAMES } from '@/lib/companyNames';
import { useRealtimePrice } from '@/app/hooks/useRealtimePrice';
import { StreamingBadge } from '@/app/components/core/StreamingIndicator';

export function StockDecisionHeroStreaming({ 
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
  // Use real-time streaming if available, fall back to initial price
  const { price: streamPrice, isStreaming } = useRealtimePrice(ticker, initialPrice);
  
  // Use streaming price if available, otherwise use initial
  const currentPrice = streamPrice?.price || initialPrice;
  const priceChange = streamPrice?.change || (analysis as any)?.change || 0;
  const priceChangePercent = streamPrice?.changePercent || (analysis as any)?.changePercent || 0;

  const rating = analysis?.combined?.rating || 'HOLD';
  const score = analysis?.combined?.score || 0;
  const maxScore = analysis?.combined?.maxScore || 18;
  const confidence = meta?.tradeDecision?.confidence || 0;
  const confidenceTier = meta?.tradeDecision?.confidenceBucket || 'N/A';
  const action = meta?.tradeDecision?.action || 'HOLD';
  const companyName = COMPANY_NAMES[ticker] || ticker;

  // Flash effect when price changes
  const [priceFlash, setPriceFlash] = useState<'up' | 'down' | null>(null);
  
  useEffect(() => {
    if (streamPrice && streamPrice.price !== initialPrice) {
      setPriceFlash(streamPrice.change > 0 ? 'up' : 'down');
      const timer = setTimeout(() => setPriceFlash(null), 300);
      return () => clearTimeout(timer);
    }
  }, [streamPrice?.price]);
  
  return (
    <div className="sticky top-0 z-10 p-5 rounded-2xl bg-gradient-to-br from-slate-800/95 to-slate-900/95 backdrop-blur-sm border border-slate-700/50 shadow-xl">
      {/* Ticker + Price Row */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          {/* Ticker - Large and Bold */}
          <div className="flex items-center gap-3">
            <h1 className="text-4xl font-bold text-white leading-tight">{ticker}</h1>
            <StreamingBadge />
          </div>
          
          {/* Company Name - Smaller, underneath ticker */}
          <p className="text-sm text-slate-400 mt-1 mb-3">{companyName}</p>
          
          {/* Price - With streaming animation */}
          <div className="flex items-baseline gap-3">
            <p className={`text-4xl font-bold leading-tight transition-all duration-300 ${
              priceFlash === 'up' ? 'text-emerald-300 scale-105' :
              priceFlash === 'down' ? 'text-red-300 scale-105' :
              'text-emerald-400'
            }`}>
              ${currentPrice?.toFixed(2) || 'N/A'}
            </p>
            
            {/* Percentage Change - Green if up, Red if down */}
            {priceChangePercent !== undefined && priceChangePercent !== null && (
              <span className={`text-xl font-semibold ${
                priceChangePercent >= 0 ? 'text-emerald-400' : 'text-red-400'
              }`}>
                {priceChangePercent >= 0 ? '+' : ''}{priceChangePercent.toFixed(2)}%
              </span>
            )}
          </div>
          
          <p className="text-xs text-slate-500 mt-1">
            {isStreaming ? (
              <>
                <span className="text-emerald-400">● Live</span> • Updated {streamPrice ? new Date(streamPrice.lastUpdate).toLocaleTimeString() : 'now'}
              </>
            ) : (
              <>
                {meta?.source || 'Quote'} • {meta?.asOf && new Date(meta.asOf).toLocaleTimeString()}
              </>
            )}
          </p>
          
          {/* Bid/Ask Spread - Only show when streaming */}
          {isStreaming && streamPrice && (
            <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
              <span>Bid: <span className="text-blue-400">${streamPrice.bid.toFixed(2)}</span></span>
              <span>Ask: <span className="text-red-400">${streamPrice.ask.toFixed(2)}</span></span>
              <span>Vol: <span className="text-slate-300">{(streamPrice.volume / 1000000).toFixed(2)}M</span></span>
            </div>
          )}
        </div>
        
        {/* Freshness Badge */}
        {meta?.asOf && !isStreaming && (
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
      <div className="mb-4 p-3 rounded-xl border border-slate-700 bg-slate-800/30">
        <div className="flex justify-between items-baseline mb-2">
          <p className="text-xs text-slate-400">Overall Score</p>
          <p className="text-sm font-bold text-white">{score}/{maxScore} ({Math.round((score / maxScore) * 100)}%)</p>
        </div>
        <div className="w-full h-2 rounded-full bg-slate-700 overflow-hidden">
          <div 
            className={`h-full rounded-full transition-all duration-500 ${
              (score / maxScore) >= 0.8 ? 'bg-emerald-500' :
              (score / maxScore) >= 0.6 ? 'bg-blue-500' :
              (score / maxScore) >= 0.4 ? 'bg-amber-500' : 'bg-red-500'
            }`}
            style={{ width: `${Math.min(100, (score / maxScore) * 100)}%` }}
          />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2">
        {onTrack && (
          <button
            onClick={onTrack}
            className="flex-1 px-4 py-2.5 rounded-lg bg-slate-700 hover:bg-slate-600 border border-slate-600 text-white font-medium text-sm transition-all duration-200 hover:scale-105"
          >
            📌 Track
          </button>
        )}
        
        {onTrade && (action === 'BUY' || action === 'STRONG_BUY' || action === 'SELL') && (
          <button
            onClick={onTrade}
            className={`flex-1 px-4 py-2.5 rounded-lg font-medium text-sm transition-all duration-200 hover:scale-105 ${
              action === 'BUY' || action === 'STRONG_BUY'
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-500'
                : 'bg-red-600 hover:bg-red-500 text-white border border-red-500'
            }`}
          >
            {action === 'BUY' || action === 'STRONG_BUY' ? '💰 Buy Now' : '💸 Sell Now'}
          </button>
        )}
        
        {onViewEvidence && (
          <button
            onClick={onViewEvidence}
            className="flex-1 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 border border-blue-500 text-white font-medium text-sm transition-all duration-200 hover:scale-105"
          >
            📊 Evidence
          </button>
        )}
      </div>
    </div>
  );
}
