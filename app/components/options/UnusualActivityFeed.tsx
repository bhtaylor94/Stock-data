'use client';

import React, { useState, useEffect } from 'react';

interface UnusualActivityAlert {
  symbol: string;
  activityType: 'SWEEP' | 'BLOCK' | 'UNUSUAL_VOLUME' | 'GAMMA_SQUEEZE';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
  sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  metrics: {
    volume: number;
    openInterest: number;
    volumeOIRatio: number;
    premium: number;
    impliedMove?: number;
  };
  confidence: number;
  reasoning: string[];
  timestamp: number;
}

export function UnusualActivityFeed({ ticker }: { ticker: string }) {
  const [alerts, setAlerts] = useState<UnusualActivityAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'BULLISH' | 'BEARISH'>('ALL');

  useEffect(() => {
    async function fetchFlow() {
      try {
        setLoading(true);
        const res = await fetch(`/api/options/flow/${ticker}`);
        const data = await res.json();
        
        if (data.unusualActivity) {
          setAlerts(data.unusualActivity);
        }
      } catch (error) {
        console.error('Failed to fetch options flow:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchFlow();
    
    // Refresh every 30 seconds
    const interval = setInterval(fetchFlow, 30000);
    return () => clearInterval(interval);
  }, [ticker]);

  const filteredAlerts = filter === 'ALL' 
    ? alerts 
    : alerts.filter(a => a.sentiment === filter);

  const getActivityIcon = (type: string) => {
    switch(type) {
      case 'SWEEP': return '🔥';
      case 'BLOCK': return '🐋';
      case 'UNUSUAL_VOLUME': return '📊';
      case 'GAMMA_SQUEEZE': return '⚡';
      default: return '📈';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch(severity) {
      case 'EXTREME': return 'text-red-400 bg-red-500/20 border-red-500/30';
      case 'HIGH': return 'text-orange-400 bg-orange-500/20 border-orange-500/30';
      case 'MEDIUM': return 'text-yellow-400 bg-yellow-500/20 border-yellow-500/30';
      case 'LOW': return 'text-blue-400 bg-blue-500/20 border-blue-500/30';
      default: return 'text-slate-400 bg-slate-500/20 border-slate-500/30';
    }
  };

  const getSentimentColor = (sentiment: string) => {
    switch(sentiment) {
      case 'BULLISH': return 'text-emerald-400';
      case 'BEARISH': return 'text-red-400';
      default: return 'text-slate-400';
    }
  };

  if (loading) {
    return (
      <div className="p-6 rounded-2xl border border-slate-700/50 bg-slate-800/30">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-slate-700 rounded w-1/4"></div>
          <div className="h-20 bg-slate-700 rounded"></div>
          <div className="h-20 bg-slate-700 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header & Filters */}
      <div className="p-4 rounded-xl border border-purple-500/30 bg-purple-500/10">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🚨</span>
            <div>
              <h3 className="text-lg font-semibold text-white">Unusual Options Activity</h3>
              <p className="text-xs text-slate-400">Smart money positioning detected</p>
            </div>
          </div>
          <span className="px-3 py-1 rounded-full bg-purple-500/20 text-purple-400 text-sm font-medium">
            {filteredAlerts.length} Alert{filteredAlerts.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Filters */}
        <div className="flex gap-2">
          {['ALL', 'BULLISH', 'BEARISH'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                filter === f
                  ? 'bg-purple-500 text-white'
                  : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Alerts */}
      {filteredAlerts.length === 0 ? (
        <div className="p-6 rounded-xl border border-slate-700/50 bg-slate-800/30 text-center">
          <p className="text-slate-400">No {filter.toLowerCase()} alerts for {ticker}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredAlerts.map((alert, i) => (
            <div
              key={i}
              className={`p-4 rounded-xl border ${getSeverityColor(alert.severity)}`}
            >
              {/* Alert Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{getActivityIcon(alert.activityType)}</span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white">
                        {alert.activityType.replace('_', ' ')}
                      </span>
                      <span className={`text-sm font-medium ${getSentimentColor(alert.sentiment)}`}>
                        {alert.sentiment}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">
                      {new Date(alert.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-400">Confidence</div>
                  <div className="text-lg font-bold text-white">{alert.confidence}%</div>
                </div>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-4 gap-3 mb-3 p-3 rounded-lg bg-slate-900/50">
                <div>
                  <p className="text-xs text-slate-400">Volume</p>
                  <p className="text-sm font-bold text-white">
                    {alert.metrics.volume.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Premium</p>
                  <p className="text-sm font-bold text-emerald-400">
                    ${(alert.metrics.premium / 1000).toFixed(0)}k
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Vol/OI</p>
                  <p className="text-sm font-bold text-amber-400">
                    {alert.metrics.volumeOIRatio.toFixed(2)}
                  </p>
                </div>
                {alert.metrics.impliedMove && (
                  <div>
                    <p className="text-xs text-slate-400">Implied Move</p>
                    <p className="text-sm font-bold text-purple-400">
                      {alert.metrics.impliedMove.toFixed(1)}%
                    </p>
                  </div>
                )}
              </div>

              {/* Reasoning */}
              <div className="space-y-1">
                {alert.reasoning.map((reason, j) => (
                  <p key={j} className="text-xs text-slate-300 flex items-start gap-2">
                    <span className="text-slate-500 mt-0.5">•</span>
                    {reason}
                  </p>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
