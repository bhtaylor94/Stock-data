'use client';

import React, { useState, useEffect } from 'react';

interface PortfolioGreeks {
  totalDelta: number;
  totalGamma: number;
  totalTheta: number;
  totalVega: number;
  positionBreakdown: any[];
  hedgingSuggestions: any[];
  riskMetrics: {
    directionalRisk: 'HIGH' | 'MEDIUM' | 'LOW';
    volatilityRisk: 'HIGH' | 'MEDIUM' | 'LOW';
    timeDecayPerDay: number;
    gammaRisk: 'HIGH' | 'MEDIUM' | 'LOW';
  };
}

export function PortfolioGreeksDashboard() {
  const [greeks, setGreeks] = useState<PortfolioGreeks | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchGreeks() {
      try {
        setLoading(true);
        const res = await fetch('/api/portfolio/greeks');
        const data = await res.json();
        setGreeks(data);
      } catch (error) {
        console.error('Failed to fetch portfolio Greeks:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchGreeks();
    
    // Refresh every 60 seconds
    const interval = setInterval(fetchGreeks, 60000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="p-6 rounded-2xl border border-slate-700/50 bg-slate-800/30">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-slate-700 rounded w-1/3"></div>
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-24 bg-slate-700 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!greeks) {
    return <div className="text-slate-400">Failed to load Greeks</div>;
  }

  const getRiskColor = (risk: string) => {
    switch(risk) {
      case 'HIGH': return 'text-red-400 bg-red-500/20 border-red-500/30';
      case 'MEDIUM': return 'text-yellow-400 bg-yellow-500/20 border-yellow-500/30';
      case 'LOW': return 'text-emerald-400 bg-emerald-500/20 border-emerald-500/30';
      default: return 'text-slate-400 bg-slate-500/20 border-slate-500/30';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-5 rounded-2xl border border-purple-500/30 bg-gradient-to-br from-purple-500/10 to-pink-500/5">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-3xl">📊</span>
          <div>
            <h2 className="text-2xl font-bold text-white">Portfolio Greeks</h2>
            <p className="text-sm text-slate-400">Institutional risk management</p>
          </div>
        </div>
      </div>

      {/* Total Greeks */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-5 rounded-xl border border-blue-500/30 bg-blue-500/10">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-400">Delta</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400">
              Directional
            </span>
          </div>
          <div className={`text-3xl font-bold ${greeks.totalDelta > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {greeks.totalDelta > 0 ? '+' : ''}{greeks.totalDelta.toFixed(0)}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {Math.abs(greeks.totalDelta) > 200 ? 'High bias' : Math.abs(greeks.totalDelta) > 100 ? 'Moderate bias' : 'Neutral'}
          </p>
        </div>

        <div className="p-5 rounded-xl border border-amber-500/30 bg-amber-500/10">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-400">Gamma</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400">
              Curvature
            </span>
          </div>
          <div className="text-3xl font-bold text-amber-400">
            {greeks.totalGamma > 0 ? '+' : ''}{greeks.totalGamma.toFixed(1)}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Delta change rate
          </p>
        </div>

        <div className="p-5 rounded-xl border border-red-500/30 bg-red-500/10">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-400">Theta</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400">
              Time Decay
            </span>
          </div>
          <div className="text-3xl font-bold text-red-400">
            {greeks.totalTheta > 0 ? '+' : ''}${Math.abs(greeks.totalTheta).toFixed(0)}/day
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {greeks.totalTheta > 0 ? 'Earning' : 'Losing'} time value
          </p>
        </div>

        <div className="p-5 rounded-xl border border-purple-500/30 bg-purple-500/10">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-400">Vega</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400">
              Volatility
            </span>
          </div>
          <div className="text-3xl font-bold text-purple-400">
            {greeks.totalVega > 0 ? '+' : ''}{greeks.totalVega.toFixed(0)}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            IV sensitivity
          </p>
        </div>
      </div>

      {/* Risk Metrics */}
      <div className="p-5 rounded-xl border border-slate-700/50 bg-slate-800/30">
        <h3 className="text-lg font-semibold text-white mb-4">Risk Assessment</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-slate-400 mb-2">Directional Risk</p>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getRiskColor(greeks.riskMetrics.directionalRisk)}`}>
              {greeks.riskMetrics.directionalRisk}
            </span>
          </div>
          <div>
            <p className="text-xs text-slate-400 mb-2">Gamma Risk</p>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getRiskColor(greeks.riskMetrics.gammaRisk)}`}>
              {greeks.riskMetrics.gammaRisk}
            </span>
          </div>
          <div>
            <p className="text-xs text-slate-400 mb-2">Volatility Risk</p>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getRiskColor(greeks.riskMetrics.volatilityRisk)}`}>
              {greeks.riskMetrics.volatilityRisk}
            </span>
          </div>
          <div>
            <p className="text-xs text-slate-400 mb-2">Daily Decay</p>
            <span className="text-white font-bold">
              ${Math.abs(greeks.riskMetrics.timeDecayPerDay).toFixed(0)}
            </span>
          </div>
        </div>
      </div>

      {/* Hedging Suggestions */}
      {greeks.hedgingSuggestions.length > 0 && (
        <div className="p-5 rounded-xl border border-emerald-500/30 bg-emerald-500/10">
          <h3 className="text-lg font-semibold text-white mb-4">🎯 Hedging Suggestions</h3>
          <div className="space-y-3">
            {greeks.hedgingSuggestions.map((suggestion, i) => (
              <div key={i} className="p-4 rounded-lg bg-slate-900/50 border border-slate-700/50">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-semibold text-white">{suggestion.action}</p>
                    <p className="text-sm text-slate-300 mt-1">{suggestion.reasoning}</p>
                  </div>
                  <span className="text-xs px-2 py-1 rounded bg-emerald-500/20 text-emerald-400">
                    Δ → {suggestion.resultingDelta.toFixed(0)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Position Breakdown */}
      <div className="p-5 rounded-xl border border-slate-700/50 bg-slate-800/30">
        <h3 className="text-lg font-semibold text-white mb-4">Position Breakdown</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400 border-b border-slate-700/50">
                <th className="text-left py-2 px-2">Position</th>
                <th className="text-right py-2 px-2">Quantity</th>
                <th className="text-right py-2 px-2">Delta</th>
                <th className="text-right py-2 px-2">Gamma</th>
                <th className="text-right py-2 px-2">Theta</th>
                <th className="text-right py-2 px-2">Vega</th>
              </tr>
            </thead>
            <tbody>
              {greeks.positionBreakdown.map((pos, i) => (
                <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-700/20">
                  <td className="py-2 px-2 font-mono font-medium text-white">{pos.symbol}</td>
                  <td className="text-right py-2 px-2 font-mono text-slate-300">{pos.quantity}</td>
                  <td className={`text-right py-2 px-2 font-mono font-bold ${pos.contribution.delta > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {pos.contribution.delta > 0 ? '+' : ''}{pos.contribution.delta.toFixed(0)}
                  </td>
                  <td className="text-right py-2 px-2 font-mono text-amber-400">
                    {pos.contribution.gamma.toFixed(1)}
                  </td>
                  <td className="text-right py-2 px-2 font-mono text-red-400">
                    {pos.contribution.theta.toFixed(0)}
                  </td>
                  <td className="text-right py-2 px-2 font-mono text-purple-400">
                    {pos.contribution.vega.toFixed(0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
