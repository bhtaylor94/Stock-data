import React from 'react';

export function ChartPatternCard({ chartPatterns }: { chartPatterns: any }) {
  if (!chartPatterns) return null;
  
  const pattern = chartPatterns.confirmed?.[0] || chartPatterns.forming?.[0];
  const isConfirmed = !!chartPatterns.confirmed?.[0];
  
  if (!pattern) {
    return (
      <div className="p-4 rounded-2xl border border-slate-700/50 bg-slate-800/30">
        <h3 className="text-sm font-semibold text-white mb-2">📐 Chart Pattern</h3>
        <p className="text-sm text-slate-400">No clear pattern detected</p>
      </div>
    );
  }
  
  return (
    <div className={`p-4 rounded-2xl border ${
      isConfirmed 
        ? 'border-emerald-500/40 bg-emerald-500/5' 
        : 'border-amber-500/40 bg-amber-500/5'
    }`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white">📐 Chart Pattern</h3>
        <span className={`text-xs px-2 py-0.5 rounded ${
          isConfirmed 
            ? 'bg-emerald-500/20 text-emerald-400' 
            : 'bg-amber-500/20 text-amber-400'
        }`}>
          {isConfirmed ? 'CONFIRMED' : 'FORMING'}
        </span>
      </div>
      
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xl">{pattern.type === 'BULLISH' ? '📈' : '📉'}</span>
        <div className="flex-1">
          <p className="font-bold text-white">{pattern.name}</p>
          <p className="text-xs text-slate-400">
            {isConfirmed ? pattern.statusReason : `Watching for breakout`}
          </p>
        </div>
        <span className="text-sm font-bold text-white">{pattern.confidence}%</span>
      </div>
      
      {isConfirmed && (
        <div className="grid grid-cols-3 gap-2 mt-3">
          {pattern.target && (
            <div className="p-2 rounded bg-slate-800/50">
              <p className="text-xs text-slate-400">Target</p>
              <p className="text-sm font-bold text-emerald-400">{pattern.target}</p>
            </div>
          )}
          {pattern.stopLoss && (
            <div className="p-2 rounded bg-slate-800/50">
              <p className="text-xs text-slate-400">Stop</p>
              <p className="text-sm font-bold text-red-400">{pattern.stopLoss}</p>
            </div>
          )}
          {(pattern.upside || pattern.downside) && (
            <div className="p-2 rounded bg-slate-800/50">
              <p className="text-xs text-slate-400">{pattern.upside ? 'Upside' : 'Downside'}</p>
              <p className={`text-sm font-bold ${pattern.upside ? 'text-emerald-400' : 'text-red-400'}`}>
                {pattern.upside || pattern.downside}%
              </p>
            </div>
          )}
        </div>
      )}
      
      {chartPatterns.patternBonus !== 0 && chartPatterns.patternBonus !== undefined && (
        <p className={`mt-2 text-xs ${chartPatterns.patternBonus > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
          {chartPatterns.patternBonus > 0 ? '+' : ''}{chartPatterns.patternBonus}% confidence adjustment
        </p>
      )}
    </div>
  );
}
