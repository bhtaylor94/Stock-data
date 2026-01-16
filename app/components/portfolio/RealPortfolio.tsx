import React, { useState, useEffect } from 'react';

interface Position {
  symbol: string;
  assetType: string;
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  marketValue: number;
  unrealizedPL: number;
  unrealizedPLPercent: number;
  dayPLPercent: number;
}

interface AccountData {
  account: {
    accountNumber: string;
    type: string;
    isDayTrader: boolean;
    roundTrips: number;
  };
  balances: {
    cashBalance: number;
    buyingPower: number;
    equity: number;
    longMarketValue: number;
    availableFunds: number;
  };
  positions: Position[];
  summary: {
    totalPositions: number;
    totalUnrealizedPL: number;
    totalUnrealizedPLPercent: number;
    portfolioValue: number;
    cashPercentage: number;
  };
}

interface RealPortfolioProps {
  onAnalyze?: (symbol: string) => void;
  onTrade?: (symbol: string, price: number, action: 'BUY' | 'SELL', quantity: number) => void;
}

type OrdersResponse = {
  success: boolean;
  orders?: any[];
  error?: string;
};

type TransactionsResponse = {
  success: boolean;
  transactions?: any[];
  error?: string;
};

export function RealPortfolio({ onAnalyze, onTrade }: RealPortfolioProps = {}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AccountData | null>(null);
  const [showSetup, setShowSetup] = useState(false);

  const [showLiveDetails, setShowLiveDetails] = useState(false);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [txnsLoading, setTxnsLoading] = useState(false);
  const [orders, setOrders] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [liveDetailsError, setLiveDetailsError] = useState<string | null>(null);

  useEffect(() => {
    fetchAccountData();
  }, []);

  const fetchAccountData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/schwab/account');
      const result = await response.json();

      if (!response.ok) {
        if (result.requiresSetup) {
          setShowSetup(true);
          setError('Schwab account not connected. Click "Connect Schwab Account" to get started.');
        } else {
          setError(result.error || 'Failed to load account data');
        }
        setLoading(false);
        return;
      }

      setData(result);
      setLoading(false);
    } catch (err: any) {
      setError(err.message || 'Network error');
      setLoading(false);
    }
  };

  const fetchLiveDetails = async () => {
    setLiveDetailsError(null);
    try {
      setOrdersLoading(true);
      const oResp = await fetch('/api/schwab/orders?maxResults=50');
      const oJson: OrdersResponse = await oResp.json();
      if (oResp.ok && oJson.success) {
        setOrders(Array.isArray(oJson.orders) ? oJson.orders : []);
      } else {
        setOrders([]);
        setLiveDetailsError(oJson.error || 'Failed to load orders');
      }
    } catch (e: any) {
      setOrders([]);
      setLiveDetailsError(String(e?.message || e));
    } finally {
      setOrdersLoading(false);
    }

    try {
      setTxnsLoading(true);
      const tResp = await fetch('/api/schwab/transactions?days=7');
      const tJson: TransactionsResponse = await tResp.json();
      if (tResp.ok && tJson.success) {
        setTransactions(Array.isArray(tJson.transactions) ? tJson.transactions : []);
      } else {
        setTransactions([]);
        setLiveDetailsError(prev => prev || tJson.error || 'Failed to load transactions');
      }
    } catch (e: any) {
      setTransactions([]);
      setLiveDetailsError(prev => prev || String(e?.message || e));
    } finally {
      setTxnsLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 rounded-2xl border border-slate-700/50 bg-slate-800/30">
        <div className="flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="ml-3 text-slate-400">Loading your Schwab account...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 rounded-2xl border border-red-500/30 bg-red-500/10">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl">⚠️</span>
          <div>
            <h3 className="text-lg font-semibold text-red-400">Account Connection Error</h3>
            <p className="text-sm text-slate-300 mt-1">{error}</p>
          </div>
        </div>
        
        {showSetup && (
          <div className="mt-4 p-4 rounded-lg bg-slate-800/50 border border-slate-700">
            <h4 className="font-semibold text-white mb-2">Setup Required:</h4>
            <ol className="text-sm text-slate-300 space-y-2 list-decimal list-inside">
              <li>Go to <a href="https://developer.schwab.com" target="_blank" className="text-blue-400 hover:underline">developer.schwab.com</a></li>
              <li>Add "Accounts and Trading Production" to your app</li>
              <li>Wait for approval (1-3 days)</li>
              <li>Refresh this page</li>
            </ol>
          </div>
        )}
        
        <button
          onClick={fetchAccountData}
          className="mt-4 px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg font-medium transition"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  if (!data) return null;

  const { balances, positions, summary, account } = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Live Portfolio</h2>
          <p className="text-sm text-slate-400">Real-time Schwab account data</p>
        </div>
        <button
          onClick={fetchAccountData}
          className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm transition flex items-center gap-2"
        >
          <span>🔄</span>
          Refresh
        </button>
      </div>

      {/* Account Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-slate-700/50 bg-slate-800/30">
          <p className="text-xs text-slate-400 mb-1">Portfolio Value</p>
          <p className="text-2xl font-bold text-white">
            ${balances.equity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className={`text-xs mt-1 font-medium ${summary.totalUnrealizedPL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {summary.totalUnrealizedPL >= 0 ? '+' : ''}${Math.abs(summary.totalUnrealizedPL).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            {' '}({summary.totalUnrealizedPLPercent >= 0 ? '+' : ''}{summary.totalUnrealizedPLPercent.toFixed(2)}%)
          </p>
        </div>

        <div className="p-4 rounded-xl border border-slate-700/50 bg-slate-800/30">
          <p className="text-xs text-slate-400 mb-1">Cash Balance</p>
          <p className="text-2xl font-bold text-white">
            ${balances.cashBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {summary.cashPercentage}% of portfolio
          </p>
        </div>

        <div className="p-4 rounded-xl border border-slate-700/50 bg-slate-800/30">
          <p className="text-xs text-slate-400 mb-1">Buying Power</p>
          <p className="text-2xl font-bold text-white">
            ${balances.buyingPower.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Available to trade
          </p>
        </div>

        <div className="p-4 rounded-xl border border-slate-700/50 bg-slate-800/30">
          <p className="text-xs text-slate-400 mb-1">Positions</p>
          <p className="text-2xl font-bold text-white">{summary.totalPositions}</p>
          <p className="text-xs text-slate-400 mt-1">
            {account.isDayTrader ? `⚠️ PDT: ${account.roundTrips}/3` : 'Standard account'}
          </p>
        </div>
      </div>

      {/* Live Orders & Activity (optional) */}
      <div className="p-6 rounded-2xl border border-slate-700/50 bg-slate-800/30">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">Broker Activity</h3>
            <p className="text-xs text-slate-400 mt-1">Open orders + recent transactions from Schwab</p>
          </div>
          <button
            onClick={async () => {
              const next = !showLiveDetails;
              setShowLiveDetails(next);
              if (next) await fetchLiveDetails();
            }}
            className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm transition"
          >
            {showLiveDetails ? 'Hide' : 'Show'}
          </button>
        </div>

        {showLiveDetails && (
          <div className="mt-4 space-y-4">
            {liveDetailsError && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-300">
                {liveDetailsError}
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={fetchLiveDetails}
                className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm transition"
              >
                Refresh activity
              </button>
              {(ordersLoading || txnsLoading) && (
                <div className="text-sm text-slate-400 flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  Loading…
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl border border-slate-700/50 bg-slate-900/30">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-white">Open Orders</h4>
                  <span className="text-xs text-slate-400">{orders.length}</span>
                </div>
                {orders.length === 0 ? (
                  <p className="text-sm text-slate-400">No recent orders found.</p>
                ) : (
                  <div className="space-y-2 max-h-72 overflow-auto pr-1">
                    {orders.slice(0, 25).map((o, i) => (
                      <div key={i} className="text-xs p-2 rounded-lg bg-slate-800/40 border border-slate-700/50">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-200">{String(o?.orderLegCollection?.[0]?.instrument?.symbol || o?.symbol || '—')}</span>
                          <span className="text-slate-400">{String(o?.status || '—')}</span>
                        </div>
                        <div className="mt-1 text-slate-400">
                          {String(o?.orderType || '—')} · {String(o?.orderLegCollection?.[0]?.instruction || '—')} · Qty {String(o?.quantity || o?.orderLegCollection?.[0]?.quantity || '—')}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-4 rounded-xl border border-slate-700/50 bg-slate-900/30">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-white">Recent Transactions</h4>
                  <span className="text-xs text-slate-400">{transactions.length}</span>
                </div>
                {transactions.length === 0 ? (
                  <p className="text-sm text-slate-400">No recent transactions found.</p>
                ) : (
                  <div className="space-y-2 max-h-72 overflow-auto pr-1">
                    {transactions.slice(0, 25).map((t, i) => (
                      <div key={i} className="text-xs p-2 rounded-lg bg-slate-800/40 border border-slate-700/50">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-200">{String(t?.transferItems?.[0]?.instrument?.symbol || t?.symbol || t?.type || '—')}</span>
                          <span className="text-slate-400">{String(t?.tradeDate || t?.transactionDate || t?.transactionTime || '—')}</span>
                        </div>
                        <div className="mt-1 text-slate-400">
                          {String(t?.type || '—')} · Amount {String(t?.netAmount ?? t?.amount ?? '—')}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Positions Table */}
      <div className="p-6 rounded-2xl border border-slate-700/50 bg-slate-800/30">
        <h3 className="text-lg font-semibold text-white mb-4">Current Positions</h3>
        
        {positions.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            <p className="text-lg">No open positions</p>
            <p className="text-sm mt-2">Your holdings will appear here once you place trades</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs text-slate-400 border-b border-slate-700">
                  <th className="pb-3 font-medium">Symbol</th>
                  <th className="pb-3 font-medium text-right">Quantity</th>
                  <th className="pb-3 font-medium text-right">Avg Cost</th>
                  <th className="pb-3 font-medium text-right">Current</th>
                  <th className="pb-3 font-medium text-right">Market Value</th>
                  <th className="pb-3 font-medium text-right">Total P&L</th>
                  <th className="pb-3 font-medium text-right">Day P&L</th>
                  <th className="pb-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {positions.map((pos, i) => (
                  <tr key={i} className="border-b border-slate-800 hover:bg-slate-700/20">
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">{pos.symbol}</span>
                        <span className="text-xs px-1.5 py-0.5 rounded bg-slate-700 text-slate-400">
                          {pos.assetType}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 text-right font-mono text-white">{pos.quantity}</td>
                    <td className="py-3 text-right font-mono text-slate-300">
                      ${pos.averagePrice.toFixed(2)}
                    </td>
                    <td className="py-3 text-right font-mono text-white">
                      ${pos.currentPrice.toFixed(2)}
                    </td>
                    <td className="py-3 text-right font-mono font-medium text-white">
                      ${pos.marketValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className={`py-3 text-right font-mono font-medium ${pos.unrealizedPL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {pos.unrealizedPL >= 0 ? '+' : ''}${Math.abs(pos.unrealizedPL).toFixed(2)}
                      <div className="text-xs">
                        ({pos.unrealizedPLPercent >= 0 ? '+' : ''}{pos.unrealizedPLPercent.toFixed(2)}%)
                      </div>
                    </td>
                    <td className={`py-3 text-right font-mono ${pos.dayPLPercent >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {pos.dayPLPercent >= 0 ? '+' : ''}{pos.dayPLPercent.toFixed(2)}%
                    </td>
                    <td className="py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {onAnalyze && (
                          <button
                            onClick={() => onAnalyze(pos.symbol)}
                            className="px-3 py-1.5 text-xs rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border border-blue-500/30 transition"
                            title="Analyze this position"
                          >
                            📊 Analyze
                          </button>
                        )}
                        {onTrade && (
                          <button
                            onClick={() => onTrade(pos.symbol, pos.currentPrice, 'SELL', pos.quantity)}
                            className="px-3 py-1.5 text-xs rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 transition"
                            title="Sell this position"
                          >
                            💸 Sell
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Account Info Footer */}
      <div className="flex items-center justify-between text-xs text-slate-500">
        <div>
          Account: {account.accountNumber} • {account.type}
        </div>
        <div>
          Data from Schwab • Updated just now
        </div>
      </div>
    </div>
  );
}
