'use client';

import React, { useState } from 'react';

export function BacktestRunner() {
  const [assetType, setAssetType] = useState<'STOCK' | 'OPTION'>('STOCK');
  const [strategy, setStrategy] = useState('AI_SIGNALS');
  const [ticker, setTicker] = useState('AAPL');
  const [startDate, setStartDate] = useState('2024-01-01');
  const [endDate, setEndDate] = useState('2025-01-01');
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const stockStrategies = [
    { value: 'AI_SIGNALS', label: '🤖 AI Signals', desc: '12 investors consensus' },
    { value: 'BUY_HOLD', label: '💎 Buy & Hold', desc: 'Long-term holding' },
    { value: 'MOMENTUM', label: '📈 Momentum', desc: 'Trend following' },
    { value: 'MEAN_REVERSION', label: '↩️ Mean Reversion', desc: 'Buy dips' },
  ];

  const optionStrategies = [
    { value: 'IRON_CONDOR', label: '🦅 Iron Condor', desc: 'Neutral strategy' },
    { value: 'BUTTERFLY', label: '🦋 Butterfly', desc: 'Range-bound' },
    { value: 'VERTICAL', label: '📊 Vertical Spread', desc: 'Directional' },
    { value: 'CALENDAR', label: '📅 Calendar', desc: 'Time decay' },
  ];

  const currentStrategies = assetType === 'STOCK' ? stockStrategies : optionStrategies;

  const runBacktest = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/backtest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetType,
          strategy,
          ticker: ticker.toUpperCase(),
          startDate,
          endDate,
          entry: assetType === 'STOCK'
            ? { aiSignal: 'STRONG_BUY', minConfidence: 75 }
            : { ivRank: { min: 50 }, daysToExpiration: 45 },
          exit: assetType === 'STOCK'
            ? { aiSignal: 'SELL', profitTarget: 0.15, stopLoss: -0.08 }
            : { profitTarget: 0.5, stopLoss: -2.0, daysToExpiration: 21 },
        }),
      });

      const data = await res.json();
      setResults(data);
    } catch (error) {
      console.error('Backtest error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-5 rounded-2xl border border-green-500/30 bg-gradient-to-br from-green-500/10 to-emerald-500/5">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-3xl">📈</span>
          <div>
            <h2 className="text-2xl font-bold text-white">Strategy Backtester</h2>
            <p className="text-sm text-slate-400">Validate strategies before risking capital</p>
          </div>
        </div>

        {/* Asset Type Toggle */}
        <div className="flex gap-2">
          <button
            onClick={() => {
              setAssetType('STOCK');
              setStrategy('AI_SIGNALS');
            }}
            className={`flex-1 py-3 rounded-xl font-medium transition ${
              assetType === 'STOCK'
                ? 'bg-blue-500 text-white'
                : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700'
            }`}
          >
            📈 Stock Strategies
          </button>
          <button
            onClick={() => {
              setAssetType('OPTION');
              setStrategy('IRON_CONDOR');
            }}
            className={`flex-1 py-3 rounded-xl font-medium transition ${
              assetType === 'OPTION'
                ? 'bg-purple-500 text-white'
                : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700'
            }`}
          >
            🎯 Option Strategies
          </button>
        </div>
      </div>

      {/* Configuration */}
      <div className="p-5 rounded-xl border border-slate-700/50 bg-slate-800/30">
        <h3 className="text-lg font-semibold text-white mb-4">Configuration</h3>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm text-slate-400 mb-2">Ticker</label>
            <input
              type="text"
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
              className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-2">Strategy</label>
            <select
              value={strategy}
              onChange={(e) => setStrategy(e.target.value)}
              className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white"
            >
              {currentStrategies.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm text-slate-400 mb-2">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-2">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white"
            />
          </div>
        </div>

        <button
          onClick={runBacktest}
          disabled={loading}
          className="w-full py-3 rounded-xl bg-green-500 hover:bg-green-600 text-white font-medium transition disabled:opacity-50"
        >
          {loading ? 'Running Backtest...' : 'Run Backtest'}
        </button>
      </div>

      {/* Results */}
      {results && (
        <>
          {/* Summary Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10">
              <p className="text-sm text-slate-400 mb-1">Net Profit</p>
              <p className={`text-2xl font-bold ${results.summary.netProfit > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                ${results.summary.netProfit.toFixed(0)}
              </p>
            </div>

            <div className="p-4 rounded-xl border border-blue-500/30 bg-blue-500/10">
              <p className="text-sm text-slate-400 mb-1">Win Rate</p>
              <p className="text-2xl font-bold text-blue-400">
                {(results.summary.winRate * 100).toFixed(1)}%
              </p>
              <p className="text-xs text-slate-500">
                {results.summary.winners}W / {results.summary.losers}L
              </p>
            </div>

            <div className="p-4 rounded-xl border border-purple-500/30 bg-purple-500/10">
              <p className="text-sm text-slate-400 mb-1">Expected Value</p>
              <p className="text-2xl font-bold text-purple-400">
                ${results.summary.expectedValue.toFixed(0)}
              </p>
              <p className="text-xs text-slate-500">Per trade</p>
            </div>

            <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10">
              <p className="text-sm text-slate-400 mb-1">Max Drawdown</p>
              <p className="text-2xl font-bold text-red-400">
                -${results.summary.maxDrawdown.toFixed(0)}
              </p>
            </div>
          </div>

          {/* Advanced Metrics */}
          <div className="p-5 rounded-xl border border-slate-700/50 bg-slate-800/30">
            <h3 className="text-lg font-semibold text-white mb-4">Performance Metrics</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-slate-400">Total Trades</p>
                <p className="text-lg font-bold text-white">{results.summary.totalTrades}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Avg Profit</p>
                <p className="text-lg font-bold text-emerald-400">${results.summary.avgProfit.toFixed(0)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Avg Loss</p>
                <p className="text-lg font-bold text-red-400">${results.summary.avgLoss.toFixed(0)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Profit Factor</p>
                <p className="text-lg font-bold text-purple-400">{results.summary.profitFactor.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Sharpe Ratio</p>
                <p className="text-lg font-bold text-blue-400">{results.summary.sharpeRatio.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Total Profit</p>
                <p className="text-lg font-bold text-emerald-400">${results.summary.totalProfit.toFixed(0)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Total Loss</p>
                <p className="text-lg font-bold text-red-400">${results.summary.totalLoss.toFixed(0)}</p>
              </div>
            </div>
          </div>

          {/* Trade List */}
          <div className="p-5 rounded-xl border border-slate-700/50 bg-slate-800/30">
            <h3 className="text-lg font-semibold text-white mb-4">Trade History ({results.trades.length} trades)</h3>
            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-800">
                  <tr className="text-slate-400 border-b border-slate-700">
                    <th className="text-left py-2 px-2">Entry</th>
                    <th className="text-left py-2 px-2">Exit</th>
                    <th className="text-right py-2 px-2">Days</th>
                    <th className="text-right py-2 px-2">Profit</th>
                    <th className="text-right py-2 px-2">Return</th>
                    <th className="text-left py-2 px-2">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {results.trades.map((trade: any, i: number) => (
                    <tr key={i} className="border-b border-slate-800 hover:bg-slate-700/20">
                      <td className="py-2 px-2 text-slate-300">{new Date(trade.entryDate).toLocaleDateString()}</td>
                      <td className="py-2 px-2 text-slate-300">{new Date(trade.exitDate).toLocaleDateString()}</td>
                      <td className="text-right py-2 px-2 text-slate-300">{trade.daysHeld}</td>
                      <td className={`text-right py-2 px-2 font-bold ${trade.profit > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        ${trade.profit.toFixed(0)}
                      </td>
                      <td className={`text-right py-2 px-2 ${trade.profitPercent > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {(trade.profitPercent * 100).toFixed(1)}%
                      </td>
                      <td className="py-2 px-2 text-xs text-slate-400">{trade.exitReason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
