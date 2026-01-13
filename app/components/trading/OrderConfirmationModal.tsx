import React, { useState } from 'react';

interface OrderConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (orderDetails: OrderDetails) => Promise<void>;
  suggestion?: {
    symbol?: string;
    type?: string;
    contract?: {
      strike?: number;
      expiration?: string;
      type?: string;
      ask?: number;
    };
    strategy?: string;
    confidence?: number;
  };
  currentPrice?: number;
}

interface OrderDetails {
  symbol: string;
  quantity: number;
  orderType: 'MARKET' | 'LIMIT';
  instruction: 'BUY' | 'SELL' | 'BUY_TO_OPEN' | 'SELL_TO_CLOSE';
  assetType: 'EQUITY' | 'OPTION';
  price?: number;
}

export function OrderConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  suggestion,
  currentPrice
}: OrderConfirmationModalProps) {
  const [quantity, setQuantity] = useState(1);
  const [orderType, setOrderType] = useState<'MARKET' | 'LIMIT'>('MARKET');
  const [limitPrice, setLimitPrice] = useState(currentPrice || suggestion?.contract?.ask || 0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const isOption = suggestion?.type === 'CALL' || suggestion?.type === 'PUT';
  const symbol = suggestion?.symbol || '';
  
  // Calculate costs
  const estimatedPrice = orderType === 'MARKET' 
    ? (isOption ? suggestion?.contract?.ask : currentPrice) || 0
    : limitPrice;
  
  const totalCost = estimatedPrice * quantity * (isOption ? 100 : 1);
  const maxRisk = totalCost;

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);

    try {
      const orderDetails: OrderDetails = {
        symbol: isOption 
          ? `${symbol}_${suggestion?.contract?.expiration?.replace(/-/g, '')}${suggestion?.type?.[0]}${suggestion?.contract?.strike}`
          : symbol,
        quantity: quantity,
        orderType: orderType,
        instruction: isOption ? 'BUY_TO_OPEN' : 'BUY',
        assetType: isOption ? 'OPTION' : 'EQUITY',
        price: orderType === 'LIMIT' ? limitPrice : undefined
      };

      await onConfirm(orderDetails);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to place order');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-lg w-full mx-4 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">Confirm Order</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Trade Details */}
        <div className="mb-6 p-4 rounded-lg bg-slate-800/50 border border-slate-700">
          <div className="text-center mb-3">
            <div className="text-3xl font-bold text-white mb-1">{symbol}</div>
            <div className="text-sm text-slate-400">
              {isOption ? (
                <span>
                  {suggestion?.contract?.type} ${suggestion?.contract?.strike} 
                  {' '}exp {suggestion?.contract?.expiration}
                </span>
              ) : (
                <span>Stock</span>
              )}
            </div>
          </div>

          {suggestion?.strategy && (
            <div className="text-center py-2 px-3 rounded bg-blue-500/20 border border-blue-500/30">
              <span className="text-sm text-blue-400">{suggestion.strategy}</span>
            </div>
          )}
        </div>

        {/* Order Inputs */}
        <div className="space-y-4 mb-6">
          {/* Quantity */}
          <div>
            <label className="block text-sm text-slate-400 mb-2">
              Quantity {isOption && '(contracts)'}
            </label>
            <input
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
              className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Order Type */}
          <div>
            <label className="block text-sm text-slate-400 mb-2">Order Type</label>
            <div className="flex gap-2">
              <button
                onClick={() => setOrderType('MARKET')}
                className={`flex-1 px-4 py-2 rounded-lg font-medium transition ${
                  orderType === 'MARKET'
                    ? 'bg-blue-500 text-white'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                }`}
              >
                Market
              </button>
              <button
                onClick={() => setOrderType('LIMIT')}
                className={`flex-1 px-4 py-2 rounded-lg font-medium transition ${
                  orderType === 'LIMIT'
                    ? 'bg-blue-500 text-white'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                }`}
              >
                Limit
              </button>
            </div>
          </div>

          {/* Limit Price */}
          {orderType === 'LIMIT' && (
            <div>
              <label className="block text-sm text-slate-400 mb-2">Limit Price</label>
              <input
                type="number"
                step="0.01"
                value={limitPrice}
                onChange={(e) => setLimitPrice(parseFloat(e.target.value) || 0)}
                className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          )}
        </div>

        {/* Cost Summary */}
        <div className="mb-6 p-4 rounded-lg bg-slate-800 border border-slate-700">
          <div className="flex justify-between mb-2">
            <span className="text-slate-400">Estimated Price:</span>
            <span className="text-white font-mono">${estimatedPrice.toFixed(2)}</span>
          </div>
          <div className="flex justify-between mb-2">
            <span className="text-slate-400">Quantity:</span>
            <span className="text-white font-mono">{quantity} {isOption ? `(${quantity * 100} shares)` : ''}</span>
          </div>
          <div className="flex justify-between pt-2 border-t border-slate-700">
            <span className="text-slate-200 font-semibold">Total Cost:</span>
            <span className="text-white font-mono font-bold text-lg">${totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-xs text-slate-500">Max Risk:</span>
            <span className="text-xs text-red-400 font-mono">${maxRisk.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
        </div>

        {/* Confidence Badge */}
        {suggestion?.confidence && (
          <div className="mb-6 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-center">
            <div className="text-sm text-slate-400 mb-1">AI Confidence</div>
            <div className="text-2xl font-bold text-emerald-400">{suggestion.confidence}%</div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/20 border border-red-500/50 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Warning */}
        <div className="mb-6 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
          <p className="text-xs text-amber-400">
            ⚠️ <strong>Live Trading:</strong> This will place a REAL order with real money in your Schwab account. 
            Make sure you understand the risks before proceeding.
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={submitting}
            className="flex-1 px-4 py-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-medium transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 px-4 py-3 rounded-lg bg-gradient-to-r from-blue-500 to-emerald-500 hover:from-blue-600 hover:to-emerald-600 text-white font-bold transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Placing...
              </>
            ) : (
              <>
                🚀 Place Order
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
