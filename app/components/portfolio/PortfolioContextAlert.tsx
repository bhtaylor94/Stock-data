import React from 'react';

interface PortfolioContextAlertProps {
  portfolioContext: any;
}

export function PortfolioContextAlert({ portfolioContext }: PortfolioContextAlertProps) {
  if (!portfolioContext || !portfolioContext.hasPosition && portfolioContext.warnings.length === 0) {
    return null;
  }

  const { position, warnings, suggestions, portfolioScore, portfolioMaxScore } = portfolioContext;
  
  // Filter out buying power warnings if user has $0 (makes no sense to show them)
  const buyingPower = portfolioContext.buyingPower || 0;
  const relevantWarnings = warnings.filter((w: string) => {
    // Hide "insufficient buying power" warnings when user literally has $0
    if (buyingPower === 0 && (w.includes('insufficient') || w.includes('Cannot afford') || w.includes('Buying Power'))) {
      return false;
    }
    return true;
  });
  
  const relevantSuggestions = suggestions.filter((s: string) => {
    // Hide purchase suggestions when user has $0
    if (buyingPower === 0 && (s.includes('Cannot afford') || s.includes('at current price'))) {
      return false;
    }
    return true;
  });

  return (
    <div className="space-y-3">
      {/* Portfolio Score */}
      {portfolioScore !== undefined && (
        <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-blue-400">Portfolio Context Score</span>
            <span className="text-lg font-bold text-white">
              +{portfolioScore}/{portfolioMaxScore}
            </span>
          </div>
          <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
            <div 
              className="h-full bg-blue-500 rounded-full transition-all" 
              style={{ width: `${(portfolioScore / portfolioMaxScore) * 100}%` }} 
            />
          </div>
        </div>
      )}

      {/* Position Info */}
      {position && (
        <div className={`p-4 rounded-xl border ${
          position.unrealizedPLPercent >= 0 
            ? 'bg-emerald-500/10 border-emerald-500/30' 
            : 'bg-red-500/10 border-red-500/30'
        }`}>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">📊</span>
            <span className="font-semibold text-white">Existing Position</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <p className="text-slate-400">Quantity</p>
              <p className="font-bold text-white">{position.quantity} shares</p>
            </div>
            <div>
              <p className="text-slate-400">Avg Cost</p>
              <p className="font-bold text-white">${position.avgCost.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-slate-400">Current Value</p>
              <p className="font-bold text-white">${position.marketValue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
            </div>
            <div>
              <p className="text-slate-400">P&L</p>
              <p className={`font-bold ${position.unrealizedPLPercent >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {position.unrealizedPLPercent >= 0 ? '+' : ''}{position.unrealizedPLPercent.toFixed(2)}%
              </p>
            </div>
            <div className="col-span-2">
              <p className="text-slate-400">Portfolio Allocation</p>
              <p className="font-bold text-white">{position.portfolioPercent.toFixed(1)}% of portfolio</p>
            </div>
          </div>
        </div>
      )}

      {/* Warnings */}
      {relevantWarnings && relevantWarnings.length > 0 && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">⚠️</span>
            <span className="font-semibold text-amber-400">Portfolio Alerts</span>
          </div>
          <div className="space-y-2">
            {relevantWarnings.map((warning: string, i: number) => (
              <p key={i} className="text-sm text-slate-300 flex items-start gap-2">
                <span className="text-slate-500 mt-0.5">•</span>
                {warning}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Suggestions */}
      {relevantSuggestions && relevantSuggestions.length > 0 && (
        <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/30">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">💡</span>
            <span className="font-semibold text-blue-400">Smart Recommendations</span>
          </div>
          <div className="space-y-2">
            {relevantSuggestions.map((suggestion: string, i: number) => (
              <p key={i} className="text-sm text-slate-300 flex items-start gap-2">
                <span className="text-blue-500 mt-0.5">→</span>
                {suggestion}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
