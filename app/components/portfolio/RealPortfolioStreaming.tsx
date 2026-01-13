// app/components/portfolio/RealPortfolioStreaming.tsx
// Enhanced portfolio component with real-time streaming updates

'use client';

import React, { useEffect, useState } from 'react';
import { useRealtimePrices } from '@/app/hooks/useRealtimePrice';
import { StreamingBadge } from '@/app/components/core/StreamingIndicator';

interface Position {
  symbol: string;
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  marketValue: number;
  unrealizedPL: number;
  unrealizedPLPercent: number;
}

interface PortfolioData {
  positions: Position[];
  totalValue: number;
  totalPL: number;
  totalPLPercent: number;
  cashBalance: number;
  buyingPower: number;
}

export function RealPortfolioStreaming({
  initialData,
  onAnalyze,
  onTrade,
}: {
  initialData: PortfolioData;
  onAnalyze?: (symbol: string) => void;
  onTrade?: (symbol: string, quantity: number, action: 'BUY' | 'SELL') => void;
}) {
  const [portfolioData, setPortfolioData] = useState<PortfolioData>(initialData);
  
  // Get all position symbols
  const symbols = initialData.positions.map(p => p.symbol);
  
  // Subscribe to real-time prices for all positions
  const { prices, isStreaming } = useRealtimePrices(symbols);

  // Update portfolio values when prices change
  useEffect(() => {
    if (!isStreaming || prices.size === 0) return;

    const updatedPositions = initialData.positions.map(position => {
      const livePrice = prices.get(position.symbol);
      if (!livePrice) return position;

      const currentPrice = livePrice.price;
      const marketValue = position.quantity * currentPrice;
      const costBasis = position.quantity * position.averagePrice;
      const unrealizedPL = marketValue - costBasis;
      const unrealizedPLPercent = costBasis > 0 ? (unrealizedPL / costBasis) * 100 : 0;

      return {
        ...position,
        currentPrice,
        marketValue,
        unrealizedPL,
        unrealizedPLPercent,
      };
    });

    const totalValue = updatedPositions.reduce((sum, p) => sum + p.marketValue, 0);
    const totalCostBasis = updatedPositions.reduce(
      (sum, p) => sum + (p.quantity * p.averagePrice),
      0
    );
    const totalPL = totalValue - totalCostBasis;
    const totalPLPercent = totalCostBasis > 0 ? (totalPL / totalCostBasis) * 100 : 0;

    setPortfolioData({
      positions: updatedPositions,
      totalValue: totalValue + initialData.cashBalance,
      totalPL,
      totalPLPercent,
      cashBalance: initialData.cashBalance,
      buyingPower: initialData.buyingPower,
    });
  }, [prices, isStreaming]);

  return (
    <div className="space-y-4">
      {/* Portfolio Summary */}
      <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white">Portfolio Value</h2>
          <StreamingBadge />
        </div>
        
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-slate-400 mb-1">Total Value</p>
            <p className="text-3xl font-bold text-white">
              ${portfolioData.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          
          <div>
            <p className="text-sm text-slate-400 mb-1">Unrealized P&L</p>
            <p className={`text-2xl font-bold ${
              portfolioData.totalPL >= 0 ? 'text-emerald-400' : 'text-red-400'
            }`}>
              {portfolioData.totalPL >= 0 ? '+' : ''}${portfolioData.totalPL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className={`text-sm ${
              portfolioData.totalPL >= 0 ? 'text-emerald-400' : 'text-red-400'
            }`}>
              {portfolioData.totalPLPercent >= 0 ? '+' : ''}{portfolioData.totalPLPercent.toFixed(2)}%
            </p>
          </div>
          
          <div>
            <p className="text-sm text-slate-400 mb-1">Buying Power</p>
            <p className="text-2xl font-bold text-blue-400">
              ${portfolioData.buyingPower.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      </div>

      {/* Positions List */}
      <div className="space-y-3">
        {portfolioData.positions.map((position) => {
          const livePrice = prices.get(position.symbol);
          const isPriceUpdating = isStreaming && livePrice;

          return (
            <div
              key={position.symbol}
              className="p-4 rounded-xl bg-slate-800 border border-slate-700 hover:border-slate-600 transition-all"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-lg font-bold text-white">{position.symbol}</h3>
                    {isPriceUpdating && (
                      <span className="text-xs text-emerald-400 flex items-center gap-1">
                        <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                        Live
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-400">
                    {position.quantity} shares @ ${position.averagePrice.toFixed(2)} avg
                  </p>
                </div>
                
                <div className="text-right">
                  <p className={`text-xl font-bold ${
                    isPriceUpdating ? 'text-emerald-400' : 'text-white'
                  }`}>
                    ${position.currentPrice.toFixed(2)}
                  </p>
                  <p className={`text-sm ${
                    position.unrealizedPL >= 0 ? 'text-emerald-400' : 'text-red-400'
                  }`}>
                    {position.unrealizedPL >= 0 ? '+' : ''}${position.unrealizedPL.toFixed(2)} (
                    {position.unrealizedPL >= 0 ? '+' : ''}{position.unrealizedPLPercent.toFixed(2)}%)
                  </p>
                </div>
              </div>

              {/* Bid/Ask Spread - Only show when streaming */}
              {isPriceUpdating && livePrice && (
                <div className="flex items-center gap-4 mb-3 text-xs text-slate-400 pb-3 border-b border-slate-700">
                  <span>Bid: <span className="text-blue-400">${livePrice.bid.toFixed(2)}</span></span>
                  <span>Ask: <span className="text-red-400">${livePrice.ask.toFixed(2)}</span></span>
                  <span>Vol: <span className="text-slate-300">{(livePrice.volume / 1000000).toFixed(2)}M</span></span>
                  <span>Day High: <span className="text-emerald-400">${livePrice.high.toFixed(2)}</span></span>
                  <span>Day Low: <span className="text-red-400">${livePrice.low.toFixed(2)}</span></span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => onAnalyze?.(position.symbol)}
                  className="px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 border border-slate-600 text-white text-sm font-medium transition-all"
                >
                  📊 Analyze
                </button>
                <button
                  onClick={() => onTrade?.(position.symbol, position.quantity, 'SELL')}
                  className="px-3 py-2 rounded-lg bg-red-600 hover:bg-red-500 border border-red-500 text-white text-sm font-medium transition-all"
                >
                  💸 Sell
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {portfolioData.positions.length === 0 && (
        <div className="p-8 text-center text-slate-400 bg-slate-800 rounded-xl border border-slate-700">
          <p className="text-lg font-medium mb-2">No positions yet</p>
          <p className="text-sm">Start trading to see your portfolio here</p>
        </div>
      )}
    </div>
  );
}
