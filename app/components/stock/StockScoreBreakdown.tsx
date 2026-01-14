import React from 'react';
import { TipLabel } from '../core/Tooltip';

export function StockScoreBreakdown({ analysis }: { analysis: any }) {
  const fundScore = analysis?.fundamental?.score || 0;
  const techScore = analysis?.technical?.score || 0;
  const fundMax = 9;
  const techMax = 9;
  
  return (
    <div className="p-4 rounded-2xl border border-slate-700/50 bg-slate-800/30">
      <h3 className="text-sm font-semibold text-white mb-3">Score Breakdown</h3>
      
      <div className="grid grid-cols-2 gap-3">
        {/* Fundamental */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <TipLabel labelKey="STOCK_SCORE" iconClassName="h-3 w-3 text-slate-500">
              <span className="text-xs text-slate-400">Fundamental</span>
            </TipLabel>
            <span className={`text-xs font-bold ${
              fundScore >= 7 ? 'text-emerald-400' :
              fundScore >= 5 ? 'text-blue-400' : 'text-amber-400'
            }`}>{fundScore}/{fundMax}</span>
          </div>
          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div 
              className={`h-full ${
                fundScore >= 7 ? 'bg-emerald-400' :
                fundScore >= 5 ? 'bg-blue-400' : 'bg-amber-400'
              }`}
              style={{ width: `${(fundScore / fundMax) * 100}%` }}
            />
          </div>
        </div>
        
        {/* Technical */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <TipLabel labelKey="TREND" iconClassName="h-3 w-3 text-slate-500">
              <span className="text-xs text-slate-400">Technical</span>
            </TipLabel>
            <span className={`text-xs font-bold ${
              techScore >= 7 ? 'text-emerald-400' :
              techScore >= 5 ? 'text-blue-400' : 'text-amber-400'
            }`}>{techScore}/{techMax}</span>
          </div>
          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div 
              className={`h-full ${
                techScore >= 7 ? 'bg-emerald-400' :
                techScore >= 5 ? 'bg-blue-400' : 'bg-amber-400'
              }`}
              style={{ width: `${(techScore / techMax) * 100}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
