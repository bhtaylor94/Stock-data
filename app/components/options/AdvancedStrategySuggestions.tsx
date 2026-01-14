'use client';

import React, { useState, useEffect } from 'react';

interface StrategyLeg {
  action: 'BUY' | 'SELL';
  optionType: 'CALL' | 'PUT';
  strike: number;
  expiration: string;
  quantity: number;
  premium: number;
}

interface Strategy {
  name: string;
  type: 'IRON_CONDOR' | 'BUTTERFLY' | 'CALENDAR' | 'VERTICAL' | 'DIAGONAL';
  outlook: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  complexity: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
  legs: StrategyLeg[];
  analysis: {
    maxProfit: number;
    maxLoss: number;
    breakeven: number[];
    probabilityOfProfit: number;
    ivRankRecommendation: string;
  };
  reasoning: string[];
  confidence: number;
}

export function AdvancedStrategySuggestions({ 
  ticker, 
  currentPrice 
}: { 
  ticker: string; 
  currentPrice: number;
}) {
  const [selectedType, setSelectedType] = useState<'ALL' | 'NEUTRAL' | 'BULLISH' | 'BEARISH'>('ALL');
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStrategies() {
      try {
        setLoading(true);
        const res = await fetch(`/api/options/flow/${ticker}`);
        const data = await res.json();
        
        if (data.strategies) {
          setStrategies(data.strategies);
        }
      } catch (error) {
        console.error('Failed to fetch strategies:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchStrategies();
    
    // Refresh every 60 seconds
    const interval = setInterval(fetchStrategies, 60000);
    return () => clearInterval(interval);
  }, [ticker, currentPrice]);

  const filteredStrategies = selectedType === 'ALL' 
    ? strategies 
    : strategies.filter(s => s.outlook === selectedType);

  if (loading) {
    return (
      <div className="p-6 rounded-2xl border border-slate-700/50 bg-slate-800/30">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-slate-700 rounded w-1/4"></div>
          <div className="h-32 bg-slate-700 rounded"></div>
        </div>
      </div>
    );
  }

  const getOutlookColor = (outlook: string) => {
    switch(outlook) {
      case 'BULLISH': return 'text-emerald-400 bg-emerald-500/20';
      case 'BEARISH': return 'text-red-400 bg-red-500/20';
      case 'NEUTRAL': return 'text-blue-400 bg-blue-500/20';
      default: return 'text-slate-400 bg-slate-500/20';
    }
  };

  const getComplexityColor = (complexity: string) => {
    switch(complexity) {
      case 'BEGINNER': return 'text-green-400';
      case 'INTERMEDIATE': return 'text-yellow-400';
      case 'ADVANCED': return 'text-red-400';
      default: return 'text-slate-400';
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="p-4 rounded-xl border border-indigo-500/30 bg-indigo-500/10">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🎯</span>
            <div>
              <h3 className="text-lg font-semibold text-white">Advanced Strategy Suggestions</h3>
              <p className="text-xs text-slate-400">Greeks-optimized multi-leg strategies</p>
            </div>
          </div>
        </div>

        {/* Filter Buttons */}
        <div className="flex gap-2">
          {['ALL', 'NEUTRAL', 'BULLISH', 'BEARISH'].map((type) => (
            <button
              key={type}
              onClick={() => setSelectedType(type as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                selectedType === type
                  ? 'bg-indigo-500 text-white'
                  : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700'
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Strategy Cards */}
      <div className="space-y-4">
        {filteredStrategies.map((strategy, i) => (
          <div
            key={i}
            className="p-5 rounded-xl border border-slate-700/50 bg-slate-800/30 hover:border-indigo-500/30 transition"
          >
            {/* Strategy Header */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h4 className="text-lg font-bold text-white">{strategy.name}</h4>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getOutlookColor(strategy.outlook)}`}>
                    {strategy.outlook}
                  </span>
                  <span className={`text-xs font-medium ${getComplexityColor(strategy.complexity)}`}>
                    {strategy.complexity}
                  </span>
                </div>
                <p className="text-xs text-slate-400">{strategy.analysis.ivRankRecommendation}</p>
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-400">Confidence</div>
                <div className="text-xl font-bold text-indigo-400">{strategy.confidence}%</div>
              </div>
            </div>

            {/* Legs */}
            <div className="mb-4 p-3 rounded-lg bg-slate-900/50">
              <p className="text-xs text-slate-400 mb-2 font-medium">Strategy Legs:</p>
              <div className="space-y-1">
                {strategy.legs.map((leg, j) => (
                  <div key={j} className="flex items-center justify-between text-sm">
                    <span className={leg.action === 'BUY' ? 'text-emerald-400' : 'text-red-400'}>
                      {leg.action} {leg.quantity} {leg.optionType} ${leg.strike}
                    </span>
                    <span className="text-slate-400 text-xs">
                      @ ${leg.premium.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Analysis Grid */}
            <div className="grid grid-cols-4 gap-3 mb-4 p-3 rounded-lg bg-slate-900/50">
              <div>
                <p className="text-xs text-slate-400">Max Profit</p>
                <p className="text-sm font-bold text-emerald-400">
                  ${strategy.analysis.maxProfit}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Max Loss</p>
                <p className="text-sm font-bold text-red-400">
                  ${strategy.analysis.maxLoss}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Breakeven</p>
                <p className="text-sm font-bold text-white">
                  ${strategy.analysis.breakeven[0].toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Win Rate</p>
                <p className="text-sm font-bold text-indigo-400">
                  {strategy.analysis.probabilityOfProfit}%
                </p>
              </div>
            </div>

            {/* Reasoning */}
            <div className="space-y-1 mb-4">
              {strategy.reasoning.map((reason, j) => (
                <p key={j} className="text-xs text-slate-300 flex items-start gap-2">
                  <span className="text-indigo-500 mt-0.5">→</span>
                  {reason}
                </p>
              ))}
            </div>

            {/* Action Button */}
            <button className="w-full py-2 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-400 border border-indigo-500/30 font-medium text-sm transition">
              Execute {strategy.name}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
