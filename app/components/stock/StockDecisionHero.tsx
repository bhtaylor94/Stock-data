import React from 'react';
import { DataFreshnessIndicator } from '../core/DataFreshnessIndicator';

export function StockDecisionHero({ 
  ticker, 
  price, 
  analysis, 
  meta,
  dataSource,
  onTrack,
  onViewEvidence,
  onRefresh
}: { 
  ticker: string;
  price: number;
  analysis: any;
  meta: any;
  dataSource?: string;
  onTrack?: () => void;
  onViewEvidence?: () => void;
  onRefresh?: () => void;
}) {
  const rating = analysis?.combined?.rating || 'HOLD';
  const score = analysis?.combined?.score || 0;
  const maxScore = analysis?.combined?.maxScore || 18;
  const confidence = meta?.tradeDecision?.confidence || 0;
  const confidenceTier = meta?.tradeDecision?.confidenceBucket || 'N/A';
  const action = meta?.tradeDecision?.action || 'HOLD';
  
  return (
    <div className="sticky top-0 z-10 p-5 rounded-2xl bg-gradient-to-br from-slate-800/95 to-slate-900/95 backdrop-blur-sm border border-slate-700/50 shadow-xl">
      {/* PROMINENT DATA FRESHNESS INDICATOR - CRITICAL FOR TRUST */}
      <div className="mb-4">
        <DataFreshnessIndicator 
          meta={meta}
          dataSource={dataSource}
          onRefresh={onRefresh}
        />
      </div>
      
      {/* Ticker + Price Row */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-1">{ticker}</h1>
          <p className="text-3xl font-bold text-emerald-400">
            ${price?.toFixed(2) || 'N/A'}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-xs text-slate-400">
              Response: {meta?.responseTimeMs}ms
            </p>
          </div>
        </div>
        
        {/* Response Time Badge */}
        {meta?.responseTimeMs && (
          <div className="text-xs px-2 py-1 rounded bg-slate-700/50 text-slate-300">
            {meta.responseTimeMs}ms response
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

      {/* Entry Points Info (if tradeable) */}
      {action !== 'NO_TRADE' && rating !== 'SELL' && rating !== 'STRONG_SELL' && (
        <div className="mb-3 p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
          <p className="text-xs text-slate-400 mb-2">Suggested Entry Points</p>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div>
              <p className="text-slate-500">Entry</p>
              <p className="text-white font-bold">${price?.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-slate-500">Target</p>
              <p className="text-emerald-400 font-bold">${(price * 1.10).toFixed(2)}</p>
            </div>
            <div>
              <p className="text-slate-500">Stop</p>
              <p className="text-red-400 font-bold">${(price * 0.95).toFixed(2)}</p>
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            💡 Target: +10% • Stop Loss: -5% • Default: 100 shares
          </p>
        </div>
      )}

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
