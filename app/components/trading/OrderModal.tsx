import React, { useState, useEffect } from 'react';

interface OrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  symbol: string;
  currentPrice: number;
  recommendation?: 'BUY' | 'SELL' | 'HOLD';
  assetType?: 'EQUITY' | 'OPTION';
  initialQuantity?: number;
  optionDetails?: {
    strike: number;
    expiration: string;
    type: 'CALL' | 'PUT';
  };
}

export function OrderModal({
  isOpen,
  onClose,
  symbol,
  currentPrice,
  recommendation = 'BUY',
  assetType = 'EQUITY',
  initialQuantity = 1,
  optionDetails
}: OrderModalProps) {
  const [orderType, setOrderType] = useState<'MARKET' | 'LIMIT'>('MARKET');
  const [quantity, setQuantity] = useState(initialQuantity);
  const [limitPrice, setLimitPrice] = useState(currentPrice);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);

  // Reset quantity when modal opens with new data
  useEffect(() => {
    if (isOpen) {
      setQuantity(initialQuantity);
      setLimitPrice(currentPrice);
      setError(null);
      setSuccess(false);
    }
  }, [isOpen, initialQuantity, currentPrice]);

  if (!isOpen) return null;

  const instruction = recommendation === 'SELL' ? 'SELL' : 'BUY';
  const totalCost = orderType === 'MARKET' 
    ? currentPrice * quantity 
    : limitPrice * quantity;

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const orderPayload = {
        symbol: symbol,
        quantity: quantity,
        orderType: orderType,
        instruction: instruction,
        assetType: assetType,
        ...(orderType === 'LIMIT' && { price: limitPrice }),
        duration: 'DAY',
        session: 'NORMAL'
      };

      const response = await fetch('/api/schwab/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderPayload)
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Order failed');
      }

      setSuccess(true);
      setOrderId(result.orderId);
      
      // Auto-close after 3 seconds
      setTimeout(() => {
        onClose();
      }, 3000);

    } catch (err: any) {
      setError(err.message || 'Failed to place order');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setError(null);
      setSuccess(false);
      setOrderId(null);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl animate-fade-in">
        {/* Header */}
        <div className="p-6 border-b border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white">Place Order</h2>
              <p className="text-sm text-slate-400 mt-1">
                {assetType === 'EQUITY' ? 'Stock' : 'Option'} • {symbol}
              </p>
            </div>
            <button
              onClick={handleClose}
              disabled={loading}
              className="p-2 hover:bg-slate-800 rounded-lg transition"
            >
              <span className="text-2xl text-slate-400">×</span>
            </button>
          </div>
        </div>

        {/* Success State */}
        {success && (
          <div className="p-6">
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
              <div className="flex items-center gap-3">
                <span className="text-3xl">✓</span>
                <div>
                  <h3 className="text-lg font-semibold text-emerald-400">Order Placed!</h3>
                  <p className="text-sm text-slate-300 mt-1">
                    {instruction} {quantity} {symbol} @ {orderType === 'MARKET' ? 'Market' : `$${limitPrice}`}
                  </p>
                  {orderId && (
                    <p className="text-xs text-slate-400 mt-2">
                      Order ID: {orderId}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Order Form */}
        {!success && (
          <>
            <div className="p-6 space-y-4">
              {/* Current Price */}
              <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-400">Current Price</span>
                  <span className="text-lg font-bold text-white">
                    ${currentPrice.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Order Type */}
              <div>
                <label className="text-sm font-medium text-slate-300 mb-2 block">
                  Order Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setOrderType('MARKET')}
                    className={`px-4 py-2 rounded-lg font-medium transition ${
                      orderType === 'MARKET'
                        ? 'bg-blue-500 text-white'
                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                    }`}
                  >
                    Market
                  </button>
                  <button
                    onClick={() => setOrderType('LIMIT')}
                    className={`px-4 py-2 rounded-lg font-medium transition ${
                      orderType === 'LIMIT'
                        ? 'bg-blue-500 text-white'
                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                    }`}
                  >
                    Limit
                  </button>
                </div>
              </div>

              {/* Quantity */}
              <div>
                <label className="text-sm font-medium text-slate-300 mb-2 block">
                  Quantity
                </label>
                <input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                  className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Limit Price */}
              {orderType === 'LIMIT' && (
                <div>
                  <label className="text-sm font-medium text-slate-300 mb-2 block">
                    Limit Price
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={limitPrice}
                    onChange={(e) => setLimitPrice(parseFloat(e.target.value) || 0)}
                    className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              )}

              {/* Order Summary */}
              <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Action</span>
                    <span className={`font-medium ${instruction === 'BUY' ? 'text-emerald-400' : 'text-red-400'}`}>
                      {instruction}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Quantity</span>
                    <span className="text-white font-medium">{quantity}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Estimated Cost</span>
                    <span className="text-white font-bold">
                      ${totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30">
                  <p className="text-sm text-red-400">{error}</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-slate-700 flex gap-3">
              <button
                onClick={handleClose}
                disabled={loading}
                className="flex-1 px-4 py-3 rounded-lg bg-slate-800 hover:bg-slate-700 font-medium transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading}
                className={`flex-1 px-4 py-3 rounded-lg font-medium transition disabled:opacity-50 ${
                  instruction === 'BUY'
                    ? 'bg-emerald-500 hover:bg-emerald-600'
                    : 'bg-red-500 hover:bg-red-600'
                } text-white`}
              >
                {loading ? 'Placing Order...' : `${instruction} ${quantity} ${symbol}`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
