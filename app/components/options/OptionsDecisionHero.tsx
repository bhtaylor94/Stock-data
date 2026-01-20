import React from 'react';
import { COMPANY_NAMES } from '@/lib/companyNames';

export function OptionsDecisionHero({ 
  ticker,
  currentPrice,
  meta,
  suggestions,
  onViewEvidence,
  priceChange
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
  const rationale = meta?.tradeDecision?.rationale || [];
  const companyName = COMPANY_NAMES[ticker] || ticker;
  
  const topSuggestion = suggestions?.[0];
  const strategy = topSuggestion?.strategy || 'No clear setup';
  
  return (
    <div className="sticky top-0 z-10 p-5 rounded-2xl bg-gradient-to-br from-slate-800/95 to-slate-900/95 backdrop-blur-sm border border-slate-700/50 shadow-xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          {/* Ticker - Large and Bold */}
          <h1 className="text-4xl font-bold text-white leading-tight">{ticker}</h1>
          {/* Company Name - Smaller, underneath ticker */}
          <p className="text-sm text-slate-400 mt-1 mb-3">{companyName}</p>
          {/* Price - Balanced size with percentage change */}
          {currentPrice && (
            <div className="flex items-baseline gap-3">
              <p className="text-4xl font-bold text-emerald-400 leading-tight">
                ${currentPrice.toFixed(2)}
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
          )}
          <p className="text-xs text-slate-500 mt-1">
            Options • {meta?.asOf && new Date(meta.asOf).toLocaleTimeString()} • {meta?.responseTimeMs}ms
          </p>
        </div>
        
        {/* Live Badge */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs text-emerald-400 font-medium">LIVE DATA</span>
        </div>
      </div>

      {/* Decision */}
      <div className={`p-4 rounded-xl border ${
        action === 'NO_TRADE' 
          ? 'border-slate-600/40 bg-slate-900/40' 
          : 'border-emerald-500/30 bg-emerald-500/5'
      }`}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-slate-400">Trade Decision</span>
          {action !== 'NO_TRADE' && (
            <span className={`text-xs px-2 py-0.5 rounded ${
              confidence >= 75 ? 'bg-emerald-500/20 text-emerald-400' :
              confidence >= 60 ? 'bg-blue-500/20 text-blue-400' :
              'bg-amber-500/20 text-amber-400'
            }`}>
              {confidence}% Confidence
            </span>
          )}
        </div>
        
        <p className={`text-lg font-bold mb-1 ${
          action === 'NO_TRADE' ? 'text-slate-400' : 'text-emerald-400'
        }`}>
          {action === 'NO_TRADE' ? 'No Trade Recommended' : action}
        </p>
        
        {action !== 'NO_TRADE' && (
          <p className="text-sm text-slate-300">{strategy}</p>
        )}
      </div>

      {/* Rationale (compact) */}
      {rationale.length > 0 && (
        <div className="mt-3 space-y-1">
          {rationale.slice(0, 3).map((r: string, i: number) => (
            <p key={i} className="text-xs text-slate-400">• {r}</p>
          ))}
        </div>
      )}

      {/* Actions */}
      {action !== 'NO_TRADE' && topSuggestion && (
        <div className="mt-3 flex gap-2">
          <button className="flex-1 px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white font-medium transition">
            📌 Track Setup
          </button>
          {onViewEvidence && (
            <button 
              onClick={onViewEvidence}
              className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white transition"
            >
              📊 View Evidence
            </button>
          )}
        </div>
      )}
    </div>
  );
}
