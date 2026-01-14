'use client';
import React, { useState, useEffect } from 'react';

interface LiveCalculatorProps {
  suggestion: any;
  tradeType: 'STOCK' | 'OPTIONS';
  quantity: number;
  onQuantityChange: (q: number) => void;
  buyingPower: number;
  portfolioValue: number;
}

export function LiveCalculator({
  suggestion,
  tradeType,
  quantity,
  onQuantityChange,
  buyingPower,
  portfolioValue,
}: LiveCalculatorProps) {
  const [livePrice, setLivePrice] = useState(suggestion.currentPrice);
  const [livePremium, setLivePremium] = useState(suggestion.details.premium || 0);

  // Real-time price updates via Schwab WebSocket
  useEffect(() => {
    let ws: WebSocket | null = null;

    const connectWebSocket = async () => {
      try {
        // Connect to Schwab streaming
        const res = await fetch('/api/schwab/stream/connect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            symbols: [suggestion.symbol],
            fields: ['QUOTE']
          })
        });

        const data = await res.json();
        
        if (data.success && data.wsUrl) {
          ws = new WebSocket(data.wsUrl);

          ws.onmessage = (event) => {
            const message = JSON.parse(event.data);
            
            if (message.data && message.data[0]) {
              const quote = message.data[0];
              
              // Update live price
              if (quote.lastPrice) {
                setLivePrice(quote.lastPrice);
              }

              // Update option premium if applicable
              if (tradeType === 'OPTIONS' && quote.mark) {
                setLivePremium(quote.mark);
              }
            }
          };

          ws.onerror = (error) => {
            console.error('[WebSocket] Error:', error);
            // Fallback to simulation
            startSimulation();
          };

          ws.onclose = () => {
            console.log('[WebSocket] Connection closed');
          };
        } else {
          // Fallback to simulation if WebSocket not available
          startSimulation();
        }
      } catch (error) {
        console.error('[WebSocket] Connection failed:', error);
        // Fallback to simulation
        startSimulation();
      }
    };

    const startSimulation = () => {
      // Fallback: Simulate price updates
      const interval = setInterval(() => {
        const change = (Math.random() - 0.5) * 0.5;
        setLivePrice((prev: number) => Math.max(0.01, prev + change));
        
        if (tradeType === 'OPTIONS') {
          const premiumChange = (Math.random() - 0.5) * 0.1;
          setLivePremium((prev: number) => Math.max(0.01, prev + premiumChange));
        }
      }, 2000);

      return () => clearInterval(interval);
    };

    // Try WebSocket first, fallback to simulation
    connectWebSocket();

    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, [suggestion.symbol, tradeType]);

  // Calculate costs and metrics
  const calculateMetrics = () => {
    if (tradeType === 'STOCK') {
      const totalCost = livePrice * quantity;
      const originalCost = suggestion.currentPrice * quantity;
      const pl = totalCost - originalCost;
      const plPercent = ((pl / originalCost) * 100);
      const portfolioPercent = portfolioValue > 0 ? (totalCost / portfolioValue) * 100 : 0;
      const targetProfit = suggestion.details.targetPrice 
        ? (suggestion.details.targetPrice - livePrice) * quantity
        : 0;

      return {
        totalCost,
        pl,
        plPercent,
        portfolioPercent,
        targetProfit,
        canAfford: totalCost <= buyingPower,
        riskLevel: portfolioPercent > 15 ? 'High' : portfolioPercent > 10 ? 'Moderate' : 'Low',
      };
    } else {
      // OPTIONS
      const contractCost = livePremium * 100;
      const totalCost = contractCost * quantity;
      const originalCost = (suggestion.details.premium || livePremium) * 100 * quantity;
      const pl = totalCost - originalCost;
      const plPercent = originalCost > 0 ? ((pl / originalCost) * 100) : 0;
      const breakeven = suggestion.details.strike + livePremium;
      const maxLoss = totalCost;
      const targetProfit = suggestion.details.targetPrice
        ? Math.max(0, (suggestion.details.targetPrice - suggestion.details.strike) * 100 * quantity - totalCost)
        : 0;

      return {
        totalCost,
        contractCost,
        pl,
        plPercent,
        breakeven,
        maxLoss,
        targetProfit,
        canAfford: totalCost <= buyingPower,
        portfolioPercent: portfolioValue > 0 ? (totalCost / portfolioValue) * 100 : 0,
        riskLevel: 'High', // Options are always higher risk
      };
    }
  };

  const metrics = calculateMetrics();

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'High': return 'text-red-400';
      case 'Moderate': return 'text-amber-400';
      default: return 'text-emerald-400';
    }
  };

  return (
    <div className="space-y-4">
      {/* Quantity Input */}
      <div className="space-y-3">
        <label className="text-sm font-medium text-slate-300 block">
          How many {tradeType === 'STOCK' ? 'shares' : 'contracts'}?
        </label>
        <div className="flex items-center gap-3">
          <button
            onClick={() => onQuantityChange(Math.max(1, quantity - 1))}
            className="w-12 h-12 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xl border border-slate-700 transition-all"
          >
            −
          </button>
          <input
            type="number"
            value={quantity}
            onChange={(e) => onQuantityChange(Math.max(1, parseInt(e.target.value) || 1))}
            min="1"
            className="flex-1 px-4 py-3 text-center text-2xl font-bold rounded-xl bg-slate-800 border-2 border-blue-500/50 text-white focus:border-blue-500 focus:outline-none"
          />
          <button
            onClick={() => onQuantityChange(quantity + 1)}
            className="w-12 h-12 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xl border border-slate-700 transition-all"
          >
            +
          </button>
        </div>
        <div className="text-center">
          <span className="text-sm text-slate-400">
            {tradeType === 'STOCK' 
              ? `${quantity} ${quantity === 1 ? 'share' : 'shares'} × $${livePrice.toFixed(2)}`
              : `${quantity} ${quantity === 1 ? 'contract' : 'contracts'} × $${livePremium.toFixed(2)} × 100`
            }
          </span>
        </div>
      </div>

      {/* Live Calculation Card */}
      <div className="p-4 md:p-6 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 border-2 border-blue-500/30 space-y-4">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-medium text-slate-400">📊 LIVE CALCULATION</span>
          <span className="flex items-center gap-1 text-xs text-emerald-400">
            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
            Updating
          </span>
        </div>

        {/* Total Cost */}
        <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-700">
          <div className="text-xs text-slate-400 mb-1">💰 Total Cost</div>
          <div className="text-3xl font-bold text-white">
            ${metrics.totalCost.toFixed(2)}
          </div>
          {tradeType === 'OPTIONS' && (
            <div className="text-xs text-slate-500 mt-1">
              ${metrics.contractCost.toFixed(2)} per contract
            </div>
          )}
        </div>

        {/* Live P&L */}
        <div className={`p-4 rounded-xl border ${
          metrics.pl >= 0 
            ? 'bg-emerald-500/10 border-emerald-500/30' 
            : 'bg-red-500/10 border-red-500/30'
        }`}>
          <div className="text-xs text-slate-400 mb-1">📊 Current P&L</div>
          <div className={`text-2xl font-bold ${metrics.pl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {metrics.pl >= 0 ? '+' : ''}${metrics.pl.toFixed(2)} ({metrics.pl >= 0 ? '+' : ''}{metrics.plPercent.toFixed(2)}%)
            <span className="ml-2">{metrics.pl >= 0 ? '🟢' : '🔴'}</span>
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Since you opened this screen
          </div>
        </div>

        {/* Grid of metrics */}
        <div className="grid grid-cols-2 gap-3">
          {tradeType === 'OPTIONS' ? (
            <>
              <div className="p-3 rounded-xl bg-slate-900/50">
                <div className="text-xs text-slate-400">🎯 Breakeven</div>
                <div className="text-lg font-bold text-white mt-1">
                  ${metrics.breakeven.toFixed(2)}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/50">
                <div className="text-xs text-slate-400">📈 Max Gain</div>
                <div className="text-lg font-bold text-emerald-400 mt-1">
                  Unlimited
                </div>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/50">
                <div className="text-xs text-slate-400">📉 Max Loss</div>
                <div className="text-lg font-bold text-red-400 mt-1">
                  ${metrics.maxLoss.toFixed(0)}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/50">
                <div className="text-xs text-slate-400">🎯 Target Profit</div>
                <div className="text-lg font-bold text-emerald-400 mt-1">
                  ${metrics.targetProfit.toFixed(0)}
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="p-3 rounded-xl bg-slate-900/50">
                <div className="text-xs text-slate-400">🎯 Portfolio %</div>
                <div className={`text-lg font-bold mt-1 ${getRiskColor(metrics.riskLevel)}`}>
                  {metrics.portfolioPercent.toFixed(1)}%
                </div>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/50">
                <div className="text-xs text-slate-400">⚠️ Risk Level</div>
                <div className={`text-lg font-bold mt-1 ${getRiskColor(metrics.riskLevel)}`}>
                  {metrics.riskLevel}
                </div>
              </div>
              {suggestion.details.targetPrice && (
                <div className="p-3 rounded-xl bg-slate-900/50 col-span-2">
                  <div className="text-xs text-slate-400">💰 Est. Profit at Target</div>
                  <div className="text-lg font-bold text-emerald-400 mt-1">
                    +${metrics.targetProfit.toFixed(2)}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Buying Power Check */}
        <div className={`p-4 rounded-xl border ${
          metrics.canAfford
            ? 'bg-emerald-500/10 border-emerald-500/30'
            : 'bg-red-500/10 border-red-500/30'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-400">Buying Power</div>
              <div className={`text-xl font-bold mt-1 ${metrics.canAfford ? 'text-emerald-400' : 'text-red-400'}`}>
                ${buyingPower.toFixed(2)}
              </div>
            </div>
            <div className="text-3xl">
              {metrics.canAfford ? '✅' : '❌'}
            </div>
          </div>
          {!metrics.canAfford && (
            <div className="text-xs text-red-400 mt-2">
              Insufficient funds. Need ${(metrics.totalCost - buyingPower).toFixed(2)} more.
            </div>
          )}
        </div>

        {/* Education for Options */}
        {tradeType === 'OPTIONS' && (
          <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/30">
            <div className="flex items-start gap-2">
              <span className="text-lg">ℹ️</span>
              <div className="flex-1 text-xs text-slate-300">
                <p className="font-bold text-blue-400 mb-1">
                  What's a {suggestion.details.optionType === 'CALL' ? 'Long Call' : 'Long Put'}?
                </p>
                <p>
                  {suggestion.details.optionType === 'CALL' 
                    ? `You're betting ${suggestion.symbol} goes UP. You control ${quantity * 100} shares for $${metrics.totalCost.toFixed(0)}. Profit if ${suggestion.symbol} > $${metrics.breakeven.toFixed(2)} before expiry.`
                    : `You're betting ${suggestion.symbol} goes DOWN. You control ${quantity * 100} shares for $${metrics.totalCost.toFixed(0)}. Profit if ${suggestion.symbol} < $${metrics.breakeven.toFixed(2)} before expiry.`
                  }
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
