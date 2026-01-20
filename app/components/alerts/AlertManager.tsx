'use client';

import React, { useState } from 'react';

type AlertType = 
  // Stock alerts
  | 'PRICE_TARGET' | 'PRICE_BREAKOUT' | 'VOLUME_SPIKE' | 'AI_SIGNAL'
  // Option alerts
  | 'UNUSUAL_ACTIVITY' | 'IV_SPIKE' | 'PUT_CALL_EXTREME' | 'STRATEGY_SETUP';

type AssetType = 'STOCK' | 'OPTION';

export function AlertManager() {
  const [assetType, setAssetType] = useState<AssetType>('STOCK');
  const [alertType, setAlertType] = useState<AlertType>('PRICE_TARGET');
  const [ticker, setTicker] = useState('');
  const [conditions, setConditions] = useState<any>({});

  const stockAlertTypes = [
    { value: 'PRICE_TARGET', label: '📈 Price Target', desc: 'Alert when price hits target' },
    { value: 'PRICE_BREAKOUT', label: '💥 Breakout', desc: 'Breaks resistance/support' },
    { value: 'VOLUME_SPIKE', label: '📊 Volume Spike', desc: 'Unusual trading volume' },
    { value: 'AI_SIGNAL', label: '🤖 AI Signal', desc: 'Strong buy/sell signal' },
  ];

  const optionAlertTypes = [
    { value: 'UNUSUAL_ACTIVITY', label: '🚨 Unusual Flow', desc: 'Sweeps, blocks, whales' },
    { value: 'IV_SPIKE', label: '⚡ IV Spike', desc: 'Volatility increase' },
    { value: 'PUT_CALL_EXTREME', label: '📉 P/C Extreme', desc: 'Extreme put/call ratio' },
    { value: 'STRATEGY_SETUP', label: '🎯 Strategy Setup', desc: 'Ideal trade conditions' },
  ];

  const currentAlertTypes = assetType === 'STOCK' ? stockAlertTypes : optionAlertTypes;

  const createAlert = async () => {
    const alertData = {
      type: alertType,
      ticker: ticker.toUpperCase(),
      assetType,
      conditions,
      notificationMethod: 'EMAIL', // TODO: Make selectable
      userId: 'user_1', // TODO: Get from auth
    };

    const res = await fetch('/api/alerts/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(alertData),
    });

    const data = await res.json();
    
    if (data.success) {
      window.alert('Alert created successfully!');
      // Reset form
      setTicker('');
      setConditions({});
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-5 rounded-2xl border border-blue-500/30 bg-gradient-to-br from-blue-500/10 to-cyan-500/5">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-3xl">🔔</span>
          <div>
            <h2 className="text-2xl font-bold text-white">Smart Alerts</h2>
            <p className="text-sm text-slate-400">Never miss a trading opportunity</p>
          </div>
        </div>

        {/* Asset Type Toggle */}
        <div className="flex gap-2">
          <button
            onClick={() => setAssetType('STOCK')}
            className={`flex-1 py-3 rounded-xl font-medium transition ${
              assetType === 'STOCK'
                ? 'bg-blue-500 text-white'
                : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700'
            }`}
          >
            📈 Stock Alerts
          </button>
          <button
            onClick={() => setAssetType('OPTION')}
            className={`flex-1 py-3 rounded-xl font-medium transition ${
              assetType === 'OPTION'
                ? 'bg-purple-500 text-white'
                : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700'
            }`}
          >
            🎯 Option Alerts
          </button>
        </div>
      </div>

      {/* Alert Builder */}
      <div className="p-5 rounded-xl border border-slate-700/50 bg-slate-800/30">
        <h3 className="text-lg font-semibold text-white mb-4">Create New Alert</h3>

        {/* Ticker Input */}
        <div className="mb-4">
          <label className="block text-sm text-slate-400 mb-2">Ticker Symbol</label>
          <input
            type="text"
            value={ticker}
            onChange={(e) => setTicker(e.target.value.toUpperCase())}
            placeholder="AAPL"
            className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
          />
        </div>

        {/* Alert Type Selection */}
        <div className="mb-4">
          <label className="block text-sm text-slate-400 mb-2">Alert Type</label>
          <div className="grid grid-cols-2 gap-2">
            {currentAlertTypes.map((type) => (
              <button
                key={type.value}
                onClick={() => setAlertType(type.value as AlertType)}
                className={`p-3 rounded-lg text-left transition ${
                  alertType === type.value
                    ? 'bg-blue-500/20 border border-blue-500/30 text-white'
                    : 'bg-slate-900 border border-slate-700 text-slate-400 hover:bg-slate-800'
                }`}
              >
                <div className="font-medium mb-1">{type.label}</div>
                <div className="text-xs text-slate-500">{type.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Conditions (Dynamic based on alert type) */}
        <div className="mb-4">
          <label className="block text-sm text-slate-400 mb-2">Conditions</label>
          
          {/* STOCK ALERTS */}
          {assetType === 'STOCK' && alertType === 'PRICE_TARGET' && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Target Price</label>
                <input
                  type="number"
                  step="0.01"
                  value={conditions.targetPrice || ''}
                  onChange={(e) => setConditions({...conditions, targetPrice: parseFloat(e.target.value)})}
                  placeholder="275.00"
                  className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Direction</label>
                <select
                  value={conditions.direction || 'ABOVE'}
                  onChange={(e) => setConditions({...conditions, direction: e.target.value})}
                  className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white"
                >
                  <option value="ABOVE">Above Target</option>
                  <option value="BELOW">Below Target</option>
                </select>
              </div>
            </div>
          )}

          {assetType === 'STOCK' && alertType === 'VOLUME_SPIKE' && (
            <div>
              <label className="block text-xs text-slate-500 mb-1">Volume Multiplier</label>
              <input
                type="number"
                step="0.1"
                value={conditions.multiplier || 2}
                onChange={(e) => setConditions({...conditions, multiplier: parseFloat(e.target.value)})}
                placeholder="2.0"
                className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white"
              />
              <p className="text-xs text-slate-500 mt-1">Alert when volume is X times average</p>
            </div>
          )}

          {assetType === 'STOCK' && alertType === 'PRICE_BREAKOUT' && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Resistance Level</label>
                <input
                  type="number"
                  step="0.01"
                  value={conditions.resistance || ''}
                  onChange={(e) => setConditions({...conditions, resistance: parseFloat(e.target.value)})}
                  placeholder="280.00"
                  className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Support Level</label>
                <input
                  type="number"
                  step="0.01"
                  value={conditions.support || ''}
                  onChange={(e) => setConditions({...conditions, support: parseFloat(e.target.value)})}
                  placeholder="250.00"
                  className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white"
                />
              </div>
            </div>
          )}

          {/* OPTION ALERTS */}
          {assetType === 'OPTION' && alertType === 'UNUSUAL_ACTIVITY' && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Minimum Premium</label>
                <input
                  type="number"
                  step="100000"
                  value={conditions.minPremium || 500000}
                  onChange={(e) => setConditions({...conditions, minPremium: parseInt(e.target.value)})}
                  placeholder="500000"
                  className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white"
                />
                <p className="text-xs text-slate-500 mt-1">$500k+ for whales</p>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Sentiment</label>
                <select
                  value={conditions.sentiment || 'ANY'}
                  onChange={(e) => setConditions({...conditions, sentiment: e.target.value})}
                  className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white"
                >
                  <option value="ANY">Any Direction</option>
                  <option value="BULLISH">Bullish Only</option>
                  <option value="BEARISH">Bearish Only</option>
                </select>
              </div>
            </div>
          )}

          {assetType === 'OPTION' && alertType === 'IV_SPIKE' && (
            <div>
              <label className="block text-xs text-slate-500 mb-1">IV Threshold (%)</label>
              <input
                type="number"
                step="5"
                value={(conditions.ivThreshold || 0.5) * 100}
                onChange={(e) => setConditions({...conditions, ivThreshold: parseFloat(e.target.value) / 100})}
                placeholder="50"
                className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white"
              />
              <p className="text-xs text-slate-500 mt-1">Alert when IV exceeds this %</p>
            </div>
          )}

          {assetType === 'OPTION' && alertType === 'STRATEGY_SETUP' && (
            <div>
              <label className="block text-xs text-slate-500 mb-1">Strategy Type</label>
              <select
                value={conditions.strategy || 'IRON_CONDOR'}
                onChange={(e) => setConditions({...conditions, strategy: e.target.value})}
                className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white"
              >
                <option value="IRON_CONDOR">Iron Condor</option>
                <option value="BUTTERFLY">Butterfly</option>
                <option value="VERTICAL">Vertical Spread</option>
                <option value="CALENDAR">Calendar Spread</option>
              </select>
            </div>
          )}
        </div>

        {/* Create Button */}
        <button
          onClick={createAlert}
          disabled={!ticker}
          className="w-full py-3 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Create Alert
        </button>
      </div>

      {/* Example Alerts */}
      <div className="p-5 rounded-xl border border-slate-700/50 bg-slate-800/30">
        <h3 className="text-lg font-semibold text-white mb-4">Popular Alert Templates</h3>
        <div className="space-y-2">
          <div className="p-3 rounded-lg bg-slate-900 border border-slate-700">
            <p className="text-sm text-white font-medium">📈 AAPL hits $300</p>
            <p className="text-xs text-slate-400">Price target alert</p>
          </div>
          <div className="p-3 rounded-lg bg-slate-900 border border-slate-700">
            <p className="text-sm text-white font-medium">🚨 TSLA whale options flow</p>
            <p className="text-xs text-slate-400">$1M+ premium alerts</p>
          </div>
          <div className="p-3 rounded-lg bg-slate-900 border border-slate-700">
            <p className="text-sm text-white font-medium">🤖 SPY strong AI signal</p>
            <p className="text-xs text-slate-400">Strong buy/sell consensus</p>
          </div>
        </div>
      </div>
    </div>
  );
}
