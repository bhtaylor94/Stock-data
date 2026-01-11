import React, { useState } from 'react';

export function OptionsSetupCard({ 
  setup,
  onTrack
}: { 
  setup: any;
  onTrack?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  
  const contract = setup.contract || {};
  const score = setup.score || 0;
  const maxScore = setup.maxScore || 12;
  
  return (
    <div className="p-4 rounded-xl border border-slate-700/50 bg-slate-800/30 hover:border-slate-600/50 transition">
      {/* Header Row */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between mb-2"
      >
        <div className="flex items-center gap-2">
          <span className="font-bold text-white">{setup.strategy || 'Option Strategy'}</span>
          <span className={`text-xs px-2 py-0.5 rounded ${
            score >= 9 ? 'bg-emerald-500/20 text-emerald-400' :
            score >= 6 ? 'bg-blue-500/20 text-blue-400' :
            'bg-amber-500/20 text-amber-400'
          }`}>
            {score}/{maxScore}
          </span>
        </div>
        <span className="text-slate-400">{expanded ? '▼' : '▶'}</span>
      </button>

      {/* Quick Stats */}
      <div className="grid grid-cols-4 gap-2 text-xs mb-2">
        <div>
          <p className="text-slate-400">Strike</p>
          <p className="font-bold text-white">${contract.strike}</p>
        </div>
        <div>
          <p className="text-slate-400">DTE</p>
          <p className="font-bold text-white">{contract.dte}d</p>
        </div>
        <div>
          <p className="text-slate-400">Delta</p>
          <p className="font-bold text-white">{contract.delta?.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-slate-400">Ask</p>
          <p className="font-bold text-emerald-400">${contract.ask?.toFixed(2)}</p>
        </div>
      </div>

      {/* Evidence Badges */}
      <div className="flex flex-wrap gap-1 mb-2">
        {setup.reasoning?.slice(0, 3).map((reason: string, i: number) => (
          <span key={i} className="text-xs px-2 py-0.5 rounded bg-slate-700 text-slate-300">
            {reason}
          </span>
        ))}
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className="mt-3 pt-3 border-t border-slate-700/50 space-y-2">
          {/* Greeks */}
          <div className="grid grid-cols-4 gap-2 text-xs">
            <div className="p-2 rounded bg-slate-900/50">
              <p className="text-slate-400">Gamma</p>
              <p className="text-white">{contract.gamma?.toFixed(3) || 'N/A'}</p>
            </div>
            <div className="p-2 rounded bg-slate-900/50">
              <p className="text-slate-400">Theta</p>
              <p className="text-red-400">{contract.theta?.toFixed(2) || 'N/A'}</p>
            </div>
            <div className="p-2 rounded bg-slate-900/50">
              <p className="text-slate-400">Vega</p>
              <p className="text-white">{contract.vega?.toFixed(2) || 'N/A'}</p>
            </div>
            <div className="p-2 rounded bg-slate-900/50">
              <p className="text-slate-400">IV</p>
              <p className="text-white">{contract.impliedVolatility?.toFixed(0)}%</p>
            </div>
          </div>

          {/* All Reasoning */}
          {setup.reasoning?.length > 3 && (
            <div className="space-y-1">
              {setup.reasoning.slice(3).map((reason: string, i: number) => (
                <p key={i} className="text-xs text-slate-400">• {reason}</p>
              ))}
            </div>
          )}

          {/* Track Button */}
          {onTrack && (
            <button
              onClick={onTrack}
              className="w-full px-3 py-2 rounded-lg bg-blue-500/20 text-blue-400 text-sm font-medium hover:bg-blue-500/30 transition"
            >
              📌 Track This Setup
            </button>
          )}
        </div>
      )}

      {/* Liquidity Warning */}
      {contract.bidAskSpread > 0.2 && (
        <p className="mt-2 text-xs text-amber-400">⚠️ Wide bid-ask spread - low liquidity</p>
      )}
    </div>
  );
}
