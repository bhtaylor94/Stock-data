'use client';
import React, { useState, useEffect } from 'react';
import { LiveCalculator } from './LiveCalculator';

interface ExecutionModalProps {
  suggestion: any;
  onClose: () => void;
}

export function ExecutionModal({ suggestion, onClose }: ExecutionModalProps) {
  const [tradeType, setTradeType] = useState<'STOCK' | 'OPTIONS'>(
    suggestion.type === 'OPTIONS' ? 'OPTIONS' : 'STOCK'
  );
  const [quantity, setQuantity] = useState(1);
  const [orderType, setOrderType] = useState<'MARKET' | 'LIMIT' | 'STOP'>('MARKET');
  const [limitPrice, setLimitPrice] = useState(suggestion.currentPrice);
  const [acceptedRisk, setAcceptedRisk] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [portfolioData, setPortfolioData] = useState<any>(null);

  // Fetch portfolio data
  useEffect(() => {
    fetchPortfolioData();
  }, []);

  const fetchPortfolioData = async () => {
    try {
      const res = await fetch('/api/portfolio/context');
      const data = await res.json();
      if (data.success) {
        setPortfolioData(data.context);
      }
    } catch (error) {
      console.error('Failed to fetch portfolio:', error);
    }
  };

  const handleExecute = async () => {
    if (!acceptedRisk) {
      alert('Please accept the risk warning');
      return;
    }

    setExecuting(true);
    try {
      const order = {
        symbol: suggestion.symbol,
        type: tradeType,
        side: 'BUY',
        quantity,
        orderType,
        limitPrice: orderType === 'LIMIT' ? limitPrice : undefined,
        optionDetails: tradeType === 'OPTIONS' ? {
          strike: suggestion.details.strike,
          expiration: suggestion.details.expiration,
          optionType: suggestion.details.optionType,
        } : undefined,
      };

      const res = await fetch('/api/schwab/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(order),
      });

      const data = await res.json();

      if (data.success) {
        alert(`✅ Order placed successfully! Order ID: ${data.orderId}`);
        onClose();
      } else {
        alert(`❌ Order failed: ${data.error}`);
      }
    } catch (error: any) {
      alert(`❌ Error: ${error.message}`);
    } finally {
      setExecuting(false);
    }
  };

  const buyingPower = portfolioData?.balances?.buyingPower || 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 bg-black/80 backdrop-blur-sm">
      {/* Modal */}
      <div className="w-full max-w-2xl max-h-[95vh] bg-gradient-to-br from-slate-900 to-slate-950 rounded-t-3xl md:rounded-2xl border border-slate-700 shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between p-4 md:p-6 bg-slate-900/95 backdrop-blur-sm border-b border-slate-700">
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors text-sm"
          >
            ← Back
          </button>
          <h2 className="text-lg md:text-xl font-bold text-white">
            {suggestion.symbol}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors text-xl"
          >
            ✕
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 md:p-6 space-y-6">
            {/* AI Recommendation Banner */}
            <div className="p-4 md:p-6 rounded-2xl bg-gradient-to-r from-blue-500/20 to-emerald-500/20 border border-blue-500/30">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl">🎯</span>
                <div>
                  <h3 className="text-lg md:text-xl font-bold text-white">
                    AI RECOMMENDATION: {suggestion.confidence >= 85 ? 'STRONG BUY' : 'BUY'}
                  </h3>
                  <p className="text-sm text-slate-300 mt-1">
                    {suggestion.reason}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-3">
                <div className="h-2 flex-1 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-emerald-500"
                    style={{ width: `${suggestion.confidence}%` }}
                  />
                </div>
                <span className="text-sm font-bold text-white">
                  {suggestion.confidence}% Confidence
                </span>
              </div>
            </div>

            {/* Current Price */}
            <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
              <div className="flex items-baseline gap-3 mb-2">
                <span className="text-3xl md:text-4xl font-bold text-emerald-400">
                  ${suggestion.currentPrice.toFixed(2)}
                </span>
                <span className="text-sm text-slate-400">
                  {suggestion.companyName}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Real-time • Last update: 2 seconds ago
              </p>
            </div>

            {/* Trade Type Toggle */}
            <div className="flex gap-2 p-1 bg-slate-800 rounded-xl">
              <button
                onClick={() => setTradeType('STOCK')}
                className={`flex-1 py-3 rounded-lg font-medium transition-all ${
                  tradeType === 'STOCK'
                    ? 'bg-gradient-to-r from-blue-500 to-emerald-500 text-white shadow-lg'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                📊 Stock
              </button>
              <button
                onClick={() => setTradeType('OPTIONS')}
                className={`flex-1 py-3 rounded-lg font-medium transition-all ${
                  tradeType === 'OPTIONS'
                    ? 'bg-gradient-to-r from-blue-500 to-emerald-500 text-white shadow-lg'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                📈 Options
              </button>
            </div>

            {/* Live Calculator */}
            <LiveCalculator
              suggestion={suggestion}
              tradeType={tradeType}
              quantity={quantity}
              onQuantityChange={setQuantity}
              buyingPower={buyingPower}
              portfolioValue={portfolioData?.summary?.portfolioValue || 0}
            />

            {/* Order Type */}
            <div className="space-y-3">
              <label className="text-sm font-medium text-slate-300 block">
                Order Type
              </label>
              <div className="flex gap-2">
                {(['MARKET', 'LIMIT', 'STOP'] as const).map(type => (
                  <button
                    key={type}
                    onClick={() => setOrderType(type)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                      orderType === type
                        ? 'bg-blue-500 text-white'
                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>

              {orderType === 'LIMIT' && (
                <div className="mt-3">
                  <label className="text-sm text-slate-400 block mb-2">
                    Limit Price
                  </label>
                  <input
                    type="number"
                    value={limitPrice}
                    onChange={(e) => setLimitPrice(parseFloat(e.target.value))}
                    step="0.01"
                    className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white focus:border-blue-500 focus:outline-none"
                  />
                </div>
              )}
            </div>

            {/* Risk Acknowledgment */}
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={acceptedRisk}
                  onChange={(e) => setAcceptedRisk(e.target.checked)}
                  className="mt-1 w-5 h-5 rounded border-amber-500"
                />
                <div className="flex-1 text-sm text-amber-300">
                  <span className="font-bold">I understand the risks</span>
                  <p className="text-xs text-amber-400/80 mt-1">
                    Trading involves risk of loss. Past performance doesn't guarantee future results. Only invest what you can afford to lose.
                  </p>
                </div>
              </label>
            </div>

            {/* Execute Button */}
            <button
              onClick={handleExecute}
              disabled={executing || !acceptedRisk}
              className={`w-full py-4 rounded-xl font-bold text-lg transition-all ${
                executing || !acceptedRisk
                  ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-500 to-emerald-500 hover:from-blue-600 hover:to-emerald-600 text-white shadow-lg shadow-blue-500/20'
              }`}
            >
              {executing ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Placing Order...
                </span>
              ) : (
                `🚀 BUY ${quantity} ${tradeType === 'STOCK' ? 'SHARES' : 'CONTRACTS'}`
              )}
            </button>

            {/* Alternative Actions */}
            <div className="flex gap-2">
              <button className="flex-1 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm transition-all">
                📌 Track Instead
              </button>
              <button className="flex-1 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm transition-all">
                🔔 Set Alert
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
