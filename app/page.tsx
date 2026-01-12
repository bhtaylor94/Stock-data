'use client';
import React, { useState, useEffect } from 'react';

// New refactored components
import { StockDecisionHero } from './components/stock/StockDecisionHero';
import { StockScoreBreakdown } from './components/stock/StockScoreBreakdown';
import { ConsensusSourcesList } from './components/stock/ConsensusSourcesList';
import { ChartPatternCard } from './components/stock/ChartPatternCard';
import { OptionsDecisionHero } from './components/options/OptionsDecisionHero';
import { UnusualActivitySection } from './components/options/UnusualActivitySection';
import { OptionsSetupCard } from './components/options/OptionsSetupCard';
import { EvidenceDrawer } from './components/core/EvidenceDrawer';
import { ErrorBoundary } from './components/core/ErrorBoundary';

// ============================================================
// POPULAR TICKERS - QUICK SELECT
// ============================================================
const POPULAR_TICKERS = [
  { symbol: 'AAPL', name: 'Apple' },
  { symbol: 'NVDA', name: 'NVIDIA' },
  { symbol: 'MSFT', name: 'Microsoft' },
  { symbol: 'GOOGL', name: 'Google' },
  { symbol: 'AMZN', name: 'Amazon' },
  { symbol: 'META', name: 'Meta' },
  { symbol: 'TSLA', name: 'Tesla' },
  { symbol: 'AMD', name: 'AMD' },
  { symbol: 'NFLX', name: 'Netflix' },
  { symbol: 'JPM', name: 'JPMorgan' },
  { symbol: 'SPY', name: 'S&P 500 ETF' },
  { symbol: 'QQQ', name: 'Nasdaq ETF' },
  { symbol: 'IWM', name: 'Russell 2000' },
  { symbol: 'GLD', name: 'Gold ETF' },
  { symbol: 'TLT', name: 'Treasury ETF' },
];

// ============================================================
// UTILITY COMPONENTS
// ============================================================

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function SuccessToast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed top-4 right-4 z-50 animate-slide-in-right">
      <div className="px-4 py-3 rounded-lg bg-emerald-500 border border-emerald-400 text-white shadow-lg flex items-center gap-2">
        <span className="text-lg">✓</span>
        <span className="font-medium">{message}</span>
        <button onClick={onClose} className="ml-2 hover:bg-emerald-600 rounded px-2">✕</button>
      </div>
    </div>
  );
}

function ErrorToast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed top-4 right-4 z-50 animate-slide-in-right">
      <div className="px-4 py-3 rounded-lg bg-red-500 border border-red-400 text-white shadow-lg flex items-center gap-2">
        <span className="text-lg">⚠️</span>
        <span className="font-medium">{message}</span>
        <button onClick={onClose} className="ml-2 hover:bg-red-600 rounded px-2">✕</button>
      </div>
    </div>
  );
}

// ============================================================
// TRACK BUTTON WITH EVIDENCE STORAGE
// ============================================================
function TrackButton({ 
  ticker, 
  suggestion, 
  entryPrice,
  evidencePacket,
  onTrack 
}: { 
  ticker: string;
  suggestion: any;
  entryPrice: number;
  evidencePacket?: any;
  onTrack: (success: boolean, message: string) => void;
}) {
  const [tracking, setTracking] = useState(false);
  
  const handleTrack = async () => {
    setTracking(true);
    try {
      const trackData: any = {
        ticker,
        type: suggestion.type === 'BUY' ? 'STOCK_BUY' : 
              suggestion.type === 'SELL' ? 'STOCK_SELL' : 
              suggestion.type,
        strategy: suggestion.strategy,
        entryPrice,
        confidence: suggestion.confidence || 0,
        reasoning: suggestion.reasoning || [],
        evidencePacket, // Store evidence with the track
      };
      
      if (suggestion.contract) {
        trackData.optionContract = {
          strike: suggestion.contract.strike,
          expiration: suggestion.contract.expiration,
          dte: suggestion.contract.dte,
          delta: suggestion.contract.delta,
          entryAsk: suggestion.contract.ask,
          optionType: suggestion.type === 'PUT' ? 'PUT' : 'CALL',
        };
      }
      
      if (suggestion.type === 'BUY' || suggestion.type === 'STOCK_BUY' || suggestion.type === 'CALL') {
        trackData.targetPrice = Math.round(entryPrice * 1.10 * 100) / 100;
        trackData.stopLoss = Math.round(entryPrice * 0.95 * 100) / 100;
      } else if (suggestion.type === 'SELL' || suggestion.type === 'STOCK_SELL' || suggestion.type === 'PUT') {
        trackData.targetPrice = Math.round(entryPrice * 0.90 * 100) / 100;
        trackData.stopLoss = Math.round(entryPrice * 1.05 * 100) / 100;
      }
      
      const res = await fetch('/api/tracker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(trackData),
      });
      
      const result = await res.json();
      onTrack(result.success, result.success ? `✓ Tracking ${ticker}` : result.error);
    } catch {
      onTrack(false, 'Network error');
    }
    setTracking(false);
  };
  
  if (suggestion.type === 'ALERT' || suggestion.type === 'NO_TRADE') return null;
  
  return (
    <button
      onClick={handleTrack}
      disabled={tracking}
      className="px-3 py-1.5 rounded-lg bg-blue-500/20 text-blue-400 text-xs font-medium hover:bg-blue-500/30 transition disabled:opacity-50 flex items-center gap-1"
    >
      {tracking ? (
        <>
          <span className="w-3 h-3 border border-blue-400 border-t-transparent rounded-full animate-spin" />
          Tracking...
        </>
      ) : (
        <>📌 Track</>
      )}
    </button>
  );
}

// ============================================================
// TRACKER TAB WITH EVIDENCE
// ============================================================
function TrackerTab({ onViewEvidence }: { onViewEvidence?: (data: any) => void }) {
  const [trackerData, setTrackerData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  const fetchTrackerData = async () => {
    try {
      const res = await fetch('/api/tracker');
      const data = await res.json();
      setTrackerData(data);
    } catch (err) {
      console.error('Tracker fetch error:', err);
    }
    setLoading(false);
  };
  
  useEffect(() => {
    fetchTrackerData();
    const interval = setInterval(fetchTrackerData, 15000);
    return () => clearInterval(interval);
  }, []);
  
  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      const res = await fetch('/api/tracker', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });
      if (res.ok) {
        fetchTrackerData();
      }
    } catch (err) {
      console.error('Update error:', err);
    }
  };
  
  if (loading) return <LoadingSpinner />;
  if (!trackerData) return <p className="text-slate-500 text-center py-12">Error loading tracker</p>;
  
  const suggestions = trackerData.suggestions || [];
  const stats = trackerData.stats || {};
  const active = suggestions.filter((s: any) => s.status === 'ACTIVE');
  const closed = suggestions.filter((s: any) => s.status !== 'ACTIVE');
  
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Portfolio Summary */}
      <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-800/80 to-slate-900/80 border border-slate-700/50">
        <h2 className="text-lg font-semibold text-white mb-4">📊 Portfolio Summary</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-3 rounded-xl bg-slate-800/50">
            <p className="text-xs text-slate-400 mb-1">Total Tracked</p>
            <p className="text-2xl font-bold text-white">{stats.totalTracked || 0}</p>
          </div>
          <div className="p-3 rounded-xl bg-slate-800/50">
            <p className="text-xs text-slate-400 mb-1">Active</p>
            <p className="text-2xl font-bold text-blue-400">{stats.activeCount || 0}</p>
          </div>
          <div className="p-3 rounded-xl bg-slate-800/50">
            <p className="text-xs text-slate-400 mb-1">Total P/L</p>
            <p className={`text-2xl font-bold ${(stats.totalPnl || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              ${(stats.totalPnl || 0).toFixed(0)}
            </p>
          </div>
          <div className="p-3 rounded-xl bg-slate-800/50">
            <p className="text-xs text-slate-400 mb-1">Avg Return</p>
            <p className={`text-2xl font-bold ${(stats.avgPnlPct || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {(stats.avgPnlPct || 0).toFixed(1)}%
            </p>
          </div>
        </div>
      </div>
      
      {/* Active Positions */}
      {active.length > 0 && (
        <div className="p-6 rounded-2xl border border-blue-500/30 bg-blue-500/5">
          <h3 className="text-lg font-semibold text-white mb-4">🔵 Active Positions</h3>
          <div className="space-y-3">
            {active.map((s: any) => (
              <div key={s.id} className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50 hover:border-slate-600/50 transition-all duration-200">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-white">{s.ticker}</span>
                    <span className="text-sm text-slate-400">{s.strategy}</span>
                    {s.optionContract && (
                      <span className="text-xs px-2 py-0.5 rounded bg-slate-700 text-slate-300">
                        ${s.optionContract.strike} {s.optionContract.optionType} • {s.optionContract.dte}d
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {onViewEvidence && s.evidencePacket && (
                      <button
                        onClick={() => onViewEvidence(s.evidencePacket)}
                        className="text-xs px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-blue-400 transition-colors"
                        title="View evidence for this trade"
                      >
                        📊 Evidence
                      </button>
                    )}
                    <span className={`text-lg font-bold ${(s.pnlPct || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {(s.pnlPct || 0) >= 0 ? '+' : ''}{(s.pnlPct || 0).toFixed(1)}%
                    </span>
                  </div>
                </div>
                
                <div className="grid grid-cols-3 gap-2 text-xs mb-3">
                  <div>
                    <span className="text-slate-400">Entry: </span>
                    <span className="text-white">${(s.entryPrice || 0).toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Current: </span>
                    <span className="text-white">${(s.currentPrice || 0).toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">P/L: </span>
                    <span className={`font-bold ${(s.pnl || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      ${(s.pnl || 0).toFixed(0)}
                    </span>
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <button
                    onClick={() => handleUpdateStatus(s.id, 'HIT_TARGET')}
                    className="flex-1 px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 text-xs hover:bg-emerald-500/30 transition-all"
                  >
                    ✓ Hit Target
                  </button>
                  <button
                    onClick={() => handleUpdateStatus(s.id, 'STOPPED_OUT')}
                    className="flex-1 px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 text-xs hover:bg-red-500/30 transition-all"
                  >
                    ✗ Stopped Out
                  </button>
                  <button
                    onClick={() => handleUpdateStatus(s.id, 'CLOSED')}
                    className="flex-1 px-3 py-1.5 rounded-lg bg-slate-600/20 text-slate-400 text-xs hover:bg-slate-600/30 transition-all"
                  >
                    Close
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Closed Positions */}
      {closed.length > 0 && (
        <div className="p-6 rounded-2xl border border-slate-700/50 bg-slate-800/30">
          <h3 className="text-lg font-semibold text-white mb-4">📋 Closed Positions</h3>
          <div className="space-y-2">
            {closed.slice(0, 10).map((s: any) => (
              <div key={s.id} className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/50 hover:border-slate-600/50 transition-all duration-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-white">{s.ticker}</span>
                    <span className="text-xs text-slate-400">{s.strategy}</span>
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      s.status === 'HIT_TARGET' ? 'bg-emerald-500/20 text-emerald-400' :
                      s.status === 'STOPPED_OUT' ? 'bg-red-500/20 text-red-400' :
                      'bg-slate-600/20 text-slate-400'
                    }`}>
                      {s.status.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {onViewEvidence && s.evidencePacket && (
                      <button
                        onClick={() => onViewEvidence(s.evidencePacket)}
                        className="text-xs px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-blue-400 transition-colors"
                      >
                        📊
                      </button>
                    )}
                    <span className={`font-bold ${(s.pnlPct || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {(s.pnlPct || 0) >= 0 ? '+' : ''}{(s.pnlPct || 0).toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {suggestions.length === 0 && (
        <div className="text-center py-12">
          <p className="text-slate-400 text-lg mb-2">No tracked positions yet</p>
          <p className="text-slate-500 text-sm">Track a position from the Stock or Options tab</p>
        </div>
      )}
    </div>
  );
}

// ============================================================
// STOCK TAB - REFACTORED with Decision-First Layout
// ============================================================
function StockTab({ 
  data, 
  loading, 
  ticker,
  onTrack,
  onViewEvidence
}: { 
  data: any; 
  loading: boolean;
  ticker: string;
  onTrack?: (success: boolean, message: string) => void;
  onViewEvidence?: () => void;
}) {
  if (loading) return <LoadingSpinner />;
  if (!data) return <p className="text-slate-500 text-center py-12">Enter a ticker symbol to analyze</p>;
  if (data.error) {
    return (
      <div className="p-6 rounded-2xl border border-red-500/30 bg-red-500/5 animate-fade-in">
        <h3 className="text-lg font-semibold text-red-400 mb-3">⚠️ {data.error}</h3>
        {data.instructions?.map((i: string, idx: number) => <p key={idx} className="text-xs text-slate-400">• {i}</p>)}
      </div>
    );
  }

  const { analysis, suggestions, chartPatterns, technicals, fundamentals, news, analysts } = data;

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Decision Hero - Sticky at top */}
      <StockDecisionHero 
        ticker={ticker}
        price={data.price || data.quote?.c || 0}
        analysis={analysis}
        meta={data.meta}
        onTrack={() => {
          if (suggestions?.[0] && onTrack) {
            const sug = suggestions[0];
            const entryPrice = data.price || data.quote?.c || 0;
            const trackData: any = {
              ticker,
              type: sug.type === 'BUY' ? 'STOCK_BUY' : 'STOCK_SELL',
              strategy: sug.strategy,
              entryPrice,
              confidence: sug.confidence || 0,
              reasoning: sug.reasoning || [],
              evidencePacket: data, // Store full evidence
            };
            
            // Add target and stop loss
            if (sug.type === 'BUY' || sug.type === 'STOCK_BUY') {
              trackData.targetPrice = Math.round(entryPrice * 1.10 * 100) / 100;
              trackData.stopLoss = Math.round(entryPrice * 0.95 * 100) / 100;
            } else {
              trackData.targetPrice = Math.round(entryPrice * 0.90 * 100) / 100;
              trackData.stopLoss = Math.round(entryPrice * 1.05 * 100) / 100;
            }
            
            fetch('/api/tracker', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(trackData),
            }).then(res => res.json()).then(result => {
              onTrack(result.success, result.success ? `✓ Tracking ${ticker}` : result.error);
            });
          }
        }}
        onViewEvidence={onViewEvidence}
      />
      
      {/* Score Breakdown */}
      <StockScoreBreakdown analysis={analysis} />
      
      {/* Consensus Sources - Pass merged data with scores */}
      <ConsensusSourcesList 
        fundamentals={{ ...fundamentals, score: analysis?.fundamental?.score }}
        technicals={{ ...technicals, score: analysis?.technical?.score }}
        news={news}
        analysts={analysts}
        chartPatterns={chartPatterns}
      />
      
      {/* Chart Pattern Card */}
      <ChartPatternCard chartPatterns={chartPatterns} />
      
      {/* Suggestions (keep compact version) */}
      {suggestions && suggestions.length > 0 && (
        <div className="p-4 rounded-2xl border border-slate-700/50 bg-slate-800/30">
          <h3 className="text-sm font-semibold text-white mb-3">Recommendations</h3>
          <div className="space-y-2">
            {suggestions.slice(0, 3).map((sug: any, i: number) => (
              <div key={i} className={`p-3 rounded-xl border ${
                sug.type === 'BUY' ? 'border-emerald-500/30 bg-emerald-500/5' :
                sug.type === 'SELL' ? 'border-red-500/30 bg-red-500/5' :
                'border-amber-500/30 bg-amber-500/5'
              } transition-all duration-200 hover:border-opacity-50`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-white">{sug.strategy}</span>
                  {sug.confidence && (
                    <span className="text-xs px-2 py-0.5 rounded bg-slate-700 text-slate-300">
                      {sug.confidence}% confidence
                    </span>
                  )}
                </div>
                {sug.reasoning?.slice(0, 2).map((r: string, j: number) => (
                  <p key={j} className="text-xs text-slate-400">• {r}</p>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// OPTIONS TAB - REFACTORED with UOA Prominent
// ============================================================
function OptionsTab({
  data,
  loading,
  ticker,
  onTrack,
  onViewEvidence
}: {
  data: any;
  loading: boolean;
  ticker: string;
  onTrack?: (success: boolean, message: string) => void;
  onViewEvidence?: () => void;
}) {
  const [selectedExp, setSelectedExp] = useState<string>('');
  
  useEffect(() => {
    if (data?.expirations?.length > 0 && !selectedExp) {
      setSelectedExp(data.expirations[0]);
    }
  }, [data, selectedExp]);

  // ERROR BOUNDARY - Prevent full-page crashes
  try {
    if (loading) return <LoadingSpinner />;
    if (!data) return <p className="text-slate-500 text-center py-12">Enter a ticker symbol to view options</p>;
    if (data.error) {
      return (
        <div className="space-y-4 animate-fade-in">
          <div className="p-6 rounded-2xl border border-red-500/30 bg-red-500/5">
            <h3 className="text-lg font-semibold text-red-400 mb-3">⚠️ Unable to Load Options</h3>
            
            {/* Show specific error */}
            <div className="mb-4 p-3 rounded-lg bg-slate-900/50 border border-slate-700">
              <p className="text-sm text-red-300 font-mono">{data.error}</p>
              {data.details && (
                <p className="text-xs text-slate-400 mt-2">{data.details}</p>
              )}
            </div>
            
            {/* Show instructions if provided */}
            {data.instructions && data.instructions.length > 0 && (
              <div className="mb-4">
                <p className="text-sm text-amber-300 font-medium mb-2">📋 How to Fix:</p>
                {data.instructions.map((i: string, idx: number) => (
                  <p key={idx} className="text-xs text-slate-300 mb-1 pl-4">• {i}</p>
                ))}
              </div>
            )}
          </div>
          
          {/* Helpful actions */}
          <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/30">
            <p className="text-sm text-blue-300 mb-3">💡 What you can do:</p>
            <ul className="text-xs text-slate-300 space-y-2">
              <li>• Switch to the <strong className="text-white">Stock Analysis</strong> tab (works anytime)</li>
              <li>• Switch to the <strong className="text-white">Portfolio</strong> tab to view tracked positions</li>
              <li>• Try a different ticker: <strong className="text-white">AAPL, TSLA, NVDA, SPY</strong></li>
              <li>• Wait for market hours (9:30 AM - 4:00 PM ET) and refresh</li>
            </ul>
          </div>
        </div>
      );
    }

  return (
    <ErrorBoundary>
    <div className="space-y-4 animate-fade-in">
      {/* Options Decision Hero */}
      <OptionsDecisionHero 
        ticker={ticker || ''}
        meta={data?.meta || { asOf: new Date().toISOString(), isStale: false }}
        suggestions={data?.suggestions || []}
        onViewEvidence={onViewEvidence}
      />
      
      {/* Unusual Options Activity - ALWAYS VISIBLE */}
      <UnusualActivitySection 
        activities={data?.unusualActivity || []}
        onTrack={(activity) => {
          if (!onTrack) return;
          
          const optionType = (activity.contract?.type || activity.type)?.toUpperCase();
          const entryPrice = activity.contract?.ask || activity.contract?.mark || 1.00;
          
          // Set target and stop for options (10% moves on premium)
          const targetPrice = optionType === 'PUT' 
            ? Math.round(entryPrice * 0.90 * 100) / 100
            : Math.round(entryPrice * 1.10 * 100) / 100;
          const stopLoss = optionType === 'PUT'
            ? Math.round(entryPrice * 1.10 * 100) / 100
            : Math.round(entryPrice * 0.90 * 100) / 100;
          
          fetch('/api/tracker', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ticker,
              type: optionType,
              strategy: `Unusual ${optionType}: $${activity.contract?.strike || activity.strike} ${activity.contract?.expiration || ''} (${activity.tradeType || 'UOA'})`,
              entryPrice,
              targetPrice,
              stopLoss,
              confidence: activity.score || 70,
              reasoning: activity.signals || [],
              evidencePacket: data, // Store evidence
              optionContract: {
                strike: activity.contract?.strike || activity.strike,
                expiration: activity.contract?.expiration || activity.expiration || 'N/A',
                dte: activity.contract?.dte || activity.dte,
                delta: activity.contract?.delta || 0.5,
                entryAsk: activity.contract?.ask || activity.contract?.mark || 1.00,
                optionType: optionType === 'PUT' ? 'PUT' : 'CALL',
              },
            }),
          }).then(res => res.json()).then(result => {
            onTrack(result.success, result.message || result.error);
          });
        }}
      />
      
      {/* Trade Setups - Compact & Expandable */}
      {data.suggestions?.filter((s: any) => s.type !== 'ALERT' && s.type !== 'NO_TRADE').length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-white px-1">💡 Trade Setups</h3>
          {data.suggestions
            .filter((s: any) => s.type !== 'ALERT' && s.type !== 'NO_TRADE')
            .slice(0, 4)
            .map((setup: any, i: number) => (
              <OptionsSetupCard 
                key={i}
                setup={setup}
                onTrack={() => {
                  if (!onTrack) return;
                  
                  const entryPrice = setup.contract?.ask || 1.00;
                  const targetPrice = setup.type === 'PUT'
                    ? Math.round(entryPrice * 0.90 * 100) / 100
                    : Math.round(entryPrice * 1.10 * 100) / 100;
                  const stopLoss = setup.type === 'PUT'
                    ? Math.round(entryPrice * 1.10 * 100) / 100
                    : Math.round(entryPrice * 0.90 * 100) / 100;
                  
                  fetch('/api/tracker', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      ticker,
                      type: setup.type,
                      strategy: setup.strategy,
                      entryPrice,
                      targetPrice,
                      stopLoss,
                      confidence: setup.confidence || 0,
                      reasoning: setup.reasoning || [],
                      evidencePacket: data,
                      optionContract: {
                        strike: setup.contract.strike,
                        expiration: setup.contract.expiration,
                        dte: setup.contract.dte,
                        delta: setup.contract.delta,
                        entryAsk: setup.contract.ask,
                        optionType: setup.type === 'PUT' ? 'PUT' : 'CALL',
                      },
                    }),
                  }).then(res => res.json()).then(result => {
                    onTrack(result.success, result.message || result.error);
                  });
                }}
              />
            ))}
        </div>
      )}
    </div>
    </ErrorBoundary>
  );
  } catch (error) {
    // CATCH ANY RENDERING ERRORS - INLINE ERROR, NO CRASH
    console.error('Options Tab Error:', error);
    return (
      <div className="space-y-4 animate-fade-in">
        <div className="p-6 rounded-2xl border border-red-500/30 bg-red-500/5">
          <h3 className="text-lg font-semibold text-red-400 mb-3">⚠️ Error Loading Options</h3>
          <p className="text-sm text-red-300 mb-3">Unable to display options data. This could be due to:</p>
          <ul className="text-xs text-slate-400 space-y-1 mb-3">
            <li>• Market is closed (options data only available 9:30 AM - 4:00 PM ET)</li>
            <li>• This ticker may not have options available</li>
            <li>• Temporary data format issue</li>
          </ul>
        </div>
        
        <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/30">
          <p className="text-sm text-blue-300 mb-2">💡 Try:</p>
          <ul className="text-xs text-slate-400 space-y-1">
            <li>• Switch to <strong className="text-white">Stock Analysis</strong> tab (works anytime)</li>
            <li>• Try a different ticker: <strong className="text-white">AAPL, TSLA, NVDA, SPY</strong></li>
            <li>• Wait for market hours (9:30 AM - 4:00 PM ET)</li>
          </ul>
        </div>
      </div>
    );
  }
}

// ============================================================
// MAIN DASHBOARD - FULLY INTEGRATED
// ============================================================
export default function TradingDashboard() {
  const [ticker, setTicker] = useState('');
  const [activeTab, setActiveTab] = useState<'stock' | 'options' | 'tracker'>('stock');
  const [stockData, setStockData] = useState<any>(null);
  const [optionsData, setOptionsData] = useState<any>(null);
  const [stockLoading, setStockLoading] = useState(false);
  const [optionsLoading, setOptionsLoading] = useState(false);
  
  // Evidence Drawer state
  const [evidenceDrawerOpen, setEvidenceDrawerOpen] = useState(false);
  const [evidenceData, setEvidenceData] = useState<any>(null);
  
  // Toast messages
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  
  const handleSearch = async () => {
    if (!ticker) return;
    
    setStockData(null);
    setOptionsData(null);
    setStockLoading(true);
    setOptionsLoading(true);
    
    // Fetch stock data
    fetch(`/api/stock/${ticker}`)
      .then(res => res.json())
      .then(data => {
        setStockData(data);
        setStockLoading(false);
      })
      .catch(() => {
        setStockData({ error: 'Failed to fetch stock data' });
        setStockLoading(false);
      });
    
    // Fetch options data
    fetch(`/api/options/${ticker}`)
      .then(res => res.json())
      .then(data => {
        setOptionsData(data);
        setOptionsLoading(false);
      })
      .catch(() => {
        setOptionsData({ error: 'Failed to fetch options data' });
        setOptionsLoading(false);
      });
  };
  
  const handleTrack = (success: boolean, message: string) => {
    setToast({ type: success ? 'success' : 'error', message });
  };
  
  const handleViewEvidence = (data: any) => {
    setEvidenceData(data);
    setEvidenceDrawerOpen(true);
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white p-4">
      {/* Evidence Drawer */}
      <EvidenceDrawer 
        isOpen={evidenceDrawerOpen}
        onClose={() => setEvidenceDrawerOpen(false)}
        data={evidenceData}
      />
      
      {/* Toast Notifications */}
      {toast?.type === 'success' && (
        <SuccessToast message={toast.message} onClose={() => setToast(null)} />
      )}
      {toast?.type === 'error' && (
        <ErrorToast message={toast.message} onClose={() => setToast(null)} />
      )}
      
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent mb-2">
            AI Hedge Fund
          </h1>
          <p className="text-slate-400 text-sm">
            Professional-grade stock & options analysis
          </p>
        </div>
        
        {/* Search Bar */}
        <div className="mb-6">
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Enter ticker symbol (e.g., AAPL, TSLA, NVDA)..."
              className="flex-1 px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
            <button
              onClick={handleSearch}
              disabled={!ticker}
              className="px-6 py-3 bg-gradient-to-r from-blue-500 to-emerald-500 hover:from-blue-600 hover:to-emerald-600 rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover:scale-105 active:scale-95"
            >
              Analyze
            </button>
          </div>
          
          {/* Popular Tickers - Quick Select */}
          <div>
            <p className="text-xs text-slate-500 mb-2">📌 Popular:</p>
            <div className="flex flex-wrap gap-2">
              {POPULAR_TICKERS.map((t) => (
                <button
                  key={t.symbol}
                  onClick={async () => {
                    setTicker(t.symbol);
                    setStockData(null);
                    setOptionsData(null);
                    setStockLoading(true);
                    setOptionsLoading(true);
                    
                    // Fetch stock data
                    fetch(`/api/stock/${t.symbol}`)
                      .then(res => res.json())
                      .then(data => {
                        setStockData(data);
                        setStockLoading(false);
                      })
                      .catch(() => {
                        setStockData({ error: 'Failed to fetch stock data' });
                        setStockLoading(false);
                      });
                    
                    // Fetch options data
                    fetch(`/api/options/${t.symbol}`)
                      .then(res => res.json())
                      .then(data => {
                        setOptionsData(data);
                        setOptionsLoading(false);
                      })
                      .catch(() => {
                        setOptionsData({ error: 'Failed to fetch options data' });
                        setOptionsLoading(false);
                      });
                  }}
                  disabled={stockLoading || optionsLoading}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    ticker === t.symbol
                      ? 'bg-blue-500/30 text-blue-300 border border-blue-500/50'
                      : 'bg-slate-800/50 text-slate-400 hover:text-white hover:bg-slate-700/50 border border-slate-700/50'
                  }`}
                >
                  <span className="font-mono font-bold">{t.symbol}</span>
                  <span className="text-slate-500 ml-1 hidden sm:inline">{t.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
        
        {/* Tabs */}
        <div className="flex gap-2 mb-6 p-1 bg-slate-800/50 rounded-xl border border-slate-700">
          {(['stock', 'options', 'tracker'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                activeTab === tab
                  ? 'bg-gradient-to-r from-blue-500 to-emerald-500 text-white shadow-lg'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              {tab === 'stock' && '📊 Stock Analysis'}
              {tab === 'options' && '📈 Options Intel'}
              {tab === 'tracker' && '💼 Portfolio'}
            </button>
          ))}
        </div>
        
        {/* Tab Content */}
        <div className="min-h-[60vh]">
          {activeTab === 'stock' && (
            <StockTab 
              data={stockData}
              loading={stockLoading}
              ticker={ticker}
              onTrack={handleTrack}
              onViewEvidence={() => handleViewEvidence(stockData)}
            />
          )}
          
          {activeTab === 'options' && (
            <OptionsTab 
              data={optionsData}
              loading={optionsLoading}
              ticker={ticker}
              onTrack={handleTrack}
              onViewEvidence={() => handleViewEvidence(optionsData)}
            />
          )}
          
          {activeTab === 'tracker' && (
            <TrackerTab onViewEvidence={handleViewEvidence} />
          )}
        </div>
        
        {/* Footer */}
        <div className="mt-12 pt-6 border-t border-slate-800 text-center text-slate-500 text-sm">
          <p>⚠️ Not financial advice • Markets are risky • Do your own research</p>
          <p className="mt-1">Data provided by Schwab Market Data API • Real-time quotes & options chains</p>
        </div>
      </div>
    </div>
  );
}
