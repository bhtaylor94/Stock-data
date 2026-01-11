import React from 'react';

export function OptionsDecisionHero({ 
  ticker,
  meta,
  suggestions,
  onViewEvidence
}: { 
  ticker: string;
  meta: any;
  suggestions?: any[];
  onViewEvidence?: () => void;
}) {
  const action = meta?.tradeDecision?.action || 'NO_TRADE';
  const confidence = meta?.tradeDecision?.confidence || 0;
  const rationale = meta?.tradeDecision?.rationale || [];
  
  const topSuggestion = suggestions?.[0];
  const strategy = topSuggestion?.strategy || 'No clear setup';
  
  return (
    <div className="sticky top-0 z-10 p-5 rounded-2xl bg-gradient-to-br from-slate-800/95 to-slate-900/95 backdrop-blur-sm border border-slate-700/50 shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-white">{ticker} Options</h1>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-xs text-slate-400">
              {meta?.asOf && new Date(meta.asOf).toLocaleTimeString()} • {meta?.responseTimeMs}ms
            </p>
            {/* Data Source Badge */}
            <span className="text-xs px-2 py-0.5 rounded flex items-center gap-1 bg-emerald-500/20 text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
              SCHWAB
            </span>
          </div>
        </div>
        
        {/* Freshness Badge */}
        <div className={`px-3 py-1.5 rounded-lg ${
          meta?.isStale ? 'bg-amber-500/10 border border-amber-500/30' : 'bg-emerald-500/10 border border-emerald-500/30'
        }`}>
          <span className={`text-xs font-medium ${meta?.isStale ? 'text-amber-400' : 'text-emerald-400'}`}>
            {meta?.isStale ? '⏱️ Stale' : '✓ Fresh'}
          </span>
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
