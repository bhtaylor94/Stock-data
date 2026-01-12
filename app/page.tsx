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
  const [showOvernightInfo, setShowOvernightInfo] = useState(false);
  
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

      {/* Overnight Support */}
      <div className="p-4 rounded-2xl border border-slate-700/50 bg-slate-800/30">
        <button
          type="button"
          onClick={() => setShowOvernightInfo(!showOvernightInfo)}
          className="w-full flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-white">🌙 Overnight Support</span>
            <span className="text-xs text-slate-400">(positions persist + P/L updates when markets move)</span>
          </div>
          <span className="text-slate-400">{showOvernightInfo ? '▼' : '▶'}</span>
        </button>

        {showOvernightInfo && (
          <div className="mt-3 text-sm text-slate-300 space-y-2">
            <p><span className="text-white font-semibold">Yes</span> — tracked positions persist overnight and across weekends. Your portfolio keeps the position and updates P/L as soon as fresh prices are available.</p>
            <ul className="list-disc pl-5 space-y-1 text-slate-300">
              <li><span className="text-white font-semibold">Stocks extended hours:</span> pre‑market 4:00 AM–9:30 AM ET, after‑hours 4:00 PM–8:00 PM ET.</li>
              <li><span className="text-white font-semibold">Options data:</span> typically only reliable during regular hours (9:30 AM–4:00 PM ET). This is a market data limitation, not the app.</li>
              <li><span className="text-white font-semibold">Weekends:</span> positions remain visible; prices generally freeze at Friday close and resume updating on Monday pre‑market.</li>
            </ul>
            <p className="text-xs text-slate-400">Tip: add a trade via “Track This Setup” or “Track UOA” and check back later — it will still be in your Portfolio tab.</p>
          </div>
        )}
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
                    onClick={() => handleUpdateStatus(s.id, 'MISSED_TARGET')}
                    className="flex-1 px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 text-xs hover:bg-red-500/30 transition-all"
                  >
                    ✗ Missed Target
                  </button>
                  <button
                    onClick={() => handleUpdateStatus(s.id, 'CANCELED')}
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
                      s.status === 'STOPPED_OUT' || s.status === 'MISSED_TARGET' ? 'bg-red-500/20 text-red-400' :
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
        {(Array.isArray(data.instructions) ? data.instructions : (data.instructions ? [String(data.instructions)] : [])).map((i: string, idx: number) => (
            <p key={idx} className="text-xs text-slate-400">• {i}</p>
          ))}
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
            const trackData = {
              ticker,
              type: sug.type === 'BUY' ? 'STOCK_BUY' : 'STOCK_SELL',
              strategy: sug.strategy,
              entryPrice: data.price || data.quote?.c,
              confidence: sug.confidence || 0,
              reasoning: sug.reasoning || [],
              evidencePacket: data, // Store full evidence
            };
            
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

{/* Data quality (candles) */}
{data?.meta?.warnings?.technicals && (
  <div className="p-4 rounded-2xl border border-amber-500/30 bg-amber-500/5">
    <h3 className="text-sm font-semibold text-amber-300 mb-1">📈 Limited technical data</h3>
    <p className="text-xs text-slate-300">{data.meta.warnings.technicals}</p>
    {data?.meta?.priceHistory && (
      <p className="text-[11px] text-slate-400 mt-1">
        Candles: <span className="font-mono">{data.meta.priceHistory.candles}</span> • Source: <span className="font-mono">{data.meta.priceHistory.source}</span>
      </p>
    )}
  </div>
)}

      {/* News warning (usually missing FINNHUB_API_KEY) */}
      {(!news?.headlines || news.headlines.length === 0) && data?.meta?.warnings?.news && (
        <div className="p-4 rounded-2xl border border-amber-500/30 bg-amber-500/5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-amber-300 mb-1">📰 News unavailable</h3>
              <p className="text-xs text-slate-300">{data.meta.warnings.news}</p>
              <p className="text-xs text-slate-400 mt-1">Set <span className="font-mono">FINNHUB_API_KEY</span> in Vercel (Production env) and redeploy.</p>
            </div>
          </div>
        </div>
      )}
      
{/* News (on Stock page) */}
{news?.headlines?.length > 0 && (
  <div className="p-4 rounded-2xl border border-slate-700/50 bg-slate-800/30">
    <div className="flex items-center justify-between mb-3">
      <h3 className="text-sm font-semibold text-white">📰 Recent News</h3>
      <button
        onClick={onViewEvidence}
        className="text-xs text-slate-300 hover:text-white underline underline-offset-2"
      >
        View in Evidence Packet
      </button>
    </div>
    <div className="space-y-2">
      {news.headlines.slice(0, 8).map((item: any, i: number) => (
        <div key={i} className="p-3 rounded-xl bg-slate-900/40 border border-slate-700/40">
          <div className="text-sm text-white">{item.headline || item.title || 'Headline'}</div>
          <div className="mt-1 text-xs text-slate-400 flex items-center gap-2">
            <span>{item.source || ''}</span>
            <span className="opacity-50">•</span>
            <span>{(() => {
              const dt = item.datetime;
              if (!dt) return '';
              if (typeof dt === 'number') return new Date(dt * 1000).toLocaleDateString();
              const d = new Date(dt);
              return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString();
            })()}</span>
            {item.url && (
              <>
                <span className="opacity-50">•</span>
                <a className="underline underline-offset-2 hover:text-white" href={item.url} target="_blank" rel="noreferrer">Open</a>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  </div>
)}

      {/* Consensus Sources - Collapsible */}
      <ConsensusSourcesList 
        fundamentals={fundamentals}
        technicals={technicals}
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
// OPTIONS TAB (REVERTED TO V8 WORKING IMPLEMENTATION)
// ============================================================
function OptionsTab({ data, loading, ticker, onTrack, onViewEvidence }: { data: any; loading: boolean; ticker: string; onTrack?: (success: boolean, message: string) => void; onViewEvidence?: () => void }) {
  const [selectedExp, setSelectedExp] = useState<string>('');
  const [showCalls, setShowCalls] = useState(true);
  
  useEffect(() => {
    if (data?.expirations?.length > 0 && !selectedExp) {
      setSelectedExp(data.expirations[0]);
    }
  }, [data, selectedExp]);

  if (loading) return <LoadingSpinner />;
  if (!data) return <p className="text-slate-500 text-center py-12">Enter a ticker symbol to view options</p>;
  if (data.error) {
    return (
      <div className="p-6 rounded-2xl border border-red-500/30 bg-red-500/5">
        <h3 className="text-lg font-semibold text-red-400 mb-3">⚠️ {data.error}</h3>
        {data.details && <p className="text-sm text-red-300 mb-3">{data.details}</p>}
        {data.instructions?.map((i: string, idx: number) => <p key={idx} className="text-xs text-slate-400">• {i}</p>)}
      </div>
    );
  }

  const currentChain = data.byExpiration?.[selectedExp] || { calls: [], puts: [] };
  const options = showCalls ? currentChain.calls : currentChain.puts;

  return (
    <div className="space-y-6">
      {/* Live Banner */}
      <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-sm text-emerald-400 font-medium">LIVE - Schwab Market Data</span>
        </div>
        <span className="text-xs text-slate-400">{data.responseTimeMs}ms</span>
      </div>

      {/* Accuracy-first Trade Decision */}
      {data?.meta?.tradeDecision && (
        <div className={`p-4 rounded-2xl border ${
          data.meta.tradeDecision.action === 'NO_TRADE' ? 'border-slate-600/40 bg-slate-900/40' : 'border-emerald-500/30 bg-emerald-500/5'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-white">🧠 Options Trade Decision</h3>
            <span className="text-xs text-slate-400">asOf {data.meta.asOf}</span>
          </div>
          <p className="text-sm text-slate-200">
            <span className="font-semibold">{data.meta.tradeDecision.action}</span>
            {data.meta.tradeDecision.action !== 'NO_TRADE' && (
              <span className="text-slate-400"> • confidence {data.meta.tradeDecision.confidence}%</span>
            )}
          </p>
          <div className="mt-2 space-y-1">
            {(data.meta.tradeDecision.rationale || []).slice(0, 6).map((r: string, i: number) => (
              <p key={i} className="text-xs text-slate-400">• {r}</p>
            ))}
          </div>
        </div>
      )}

      {/* Unusual Options Activity */}
      {data.unusualActivity?.length > 0 && (
        <div className="p-5 rounded-2xl border border-orange-500/30 bg-gradient-to-br from-orange-950/20 to-red-950/10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-orange-400">🔥 Unusual Options Activity</h2>
            <span className="text-xs text-slate-500">Smart Money Detection</span>
          </div>
          
          {/* What is Unusual Activity - Educational Box */}
          <details className="mb-4 p-3 rounded-lg bg-slate-800/30 border border-slate-700/50">
            <summary className="text-xs text-blue-400 cursor-pointer hover:text-blue-300">ℹ️ What does this mean?</summary>
            <div className="mt-2 text-xs text-slate-400 space-y-2">
              <p><strong className="text-white">Unusual Options Activity (UOA)</strong> = Options contracts trading at significantly higher volume than normal. Often indicates institutional investors ("smart money") positioning for a move.</p>
              <p><strong className="text-amber-400">DIRECTIONAL</strong> = Trade likely a bet on price movement</p>
              <p><strong className="text-purple-400">LIKELY_HEDGE</strong> = Trade likely protection/insurance against existing stock position</p>
              <p><strong className="text-red-400">Insider Probability</strong> = Signals that could indicate insider knowledge (short-dated, OTM, high urgency)</p>
            </div>
          </details>
          
          <div className="space-y-4">
            {data.unusualActivity.slice(0, 5).map((u: any, i: number) => (
              <div key={i} className={`p-4 rounded-xl border ${u.sentiment === 'BULLISH' ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-red-500/40 bg-red-500/5'}`}>
                
                {/* Header with Strike, Type, and Expiration */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-lg text-white">
                      {u.sentiment === 'BULLISH' ? '📈' : '📉'} ${u.contract?.strike || u.strike} {(u.contract?.type || u.type)?.toUpperCase()}
                    </span>
                    <span className="text-xs px-2 py-1 rounded bg-slate-700 text-slate-200">
                      📅 {u.contract?.expiration || u.expiration || `${u.dte}d`} exp
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      u.convictionLevel === 'HIGH' ? 'bg-orange-500/30 text-orange-300' :
                      u.convictionLevel === 'MEDIUM' ? 'bg-amber-500/20 text-amber-400' :
                      'bg-slate-500/20 text-slate-400'
                    }`}>{u.convictionLevel || 'MEDIUM'} CONVICTION</span>
                  </div>
                  <span className={`text-sm px-3 py-1 rounded-lg font-bold ${u.sentiment === 'BULLISH' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>{u.sentiment}</span>
                </div>
                
                {/* Trade Type Classification - PROMINENT */}
                <div className={`p-3 rounded-lg mb-3 ${
                  u.tradeType === 'DIRECTIONAL' ? 'bg-blue-500/10 border border-blue-500/30' :
                  u.tradeType === 'LIKELY_HEDGE' ? 'bg-purple-500/10 border border-purple-500/30' :
                  'bg-slate-700/30 border border-slate-600/30'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className={`font-bold text-sm ${
                      u.tradeType === 'DIRECTIONAL' ? 'text-blue-400' :
                      u.tradeType === 'LIKELY_HEDGE' ? 'text-purple-400' :
                      'text-slate-300'
                    }`}>
                      {u.tradeType === 'DIRECTIONAL' ? '🎯 DIRECTIONAL BET' :
                       u.tradeType === 'LIKELY_HEDGE' ? '🛡️ LIKELY HEDGE' :
                       '❓ UNCERTAIN'}
                    </span>
                    {/* Insider Probability - VERY PROMINENT */}
                    {u.insiderProbability && u.insiderProbability !== 'UNLIKELY' && (
                      <span className={`text-xs px-2 py-1 rounded font-bold ${
                        u.insiderProbability === 'HIGH' ? 'bg-red-500/30 text-red-300 animate-pulse' :
                        u.insiderProbability === 'MEDIUM' ? 'bg-orange-500/20 text-orange-300' :
                        'bg-amber-500/10 text-amber-400'
                      }`}>
                        🔍 {u.insiderProbability} INSIDER PROB
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-1">{u.tradeTypeReason || u.interpretation}</p>
                </div>
                
                {/* Insider Signals - if present */}
                {u.insiderSignals?.length > 0 && (
                  <div className="mb-3 p-2 rounded bg-red-500/5 border border-red-500/20">
                    <p className="text-xs text-red-400 font-medium mb-1">🔍 Why Insider Activity Suspected:</p>
                    <ul className="text-xs text-slate-400 space-y-0.5">
                      {u.insiderSignals.map((sig: string, j: number) => (
                        <li key={j}>• {sig}</li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {/* Key Stats Grid */}
                <div className="grid grid-cols-5 gap-2 text-xs mb-3">
                  <div className="p-2 rounded bg-slate-800/50 text-center">
                    <p className="text-slate-400">Volume</p>
                    <p className="text-amber-400 font-bold">{u.contract?.volume?.toLocaleString() || u.volume?.toLocaleString()}</p>
                  </div>
                  <div className="p-2 rounded bg-slate-800/50 text-center">
                    <p className="text-slate-400">Open Int</p>
                    <p className="text-white font-bold">{u.contract?.openInterest?.toLocaleString() || u.openInterest?.toLocaleString()}</p>
                  </div>
                  <div className="p-2 rounded bg-slate-800/50 text-center">
                    <p className="text-slate-400">Vol/OI</p>
                    <p className="text-orange-400 font-bold">{(u.contract?.volumeOIRatio || u.volumeOIRatio)?.toFixed(1)}x</p>
                  </div>
                  <div className="p-2 rounded bg-slate-800/50 text-center">
                    <p className="text-slate-400">DTE</p>
                    <p className="text-white font-bold">{u.contract?.dte || u.dte}d</p>
                  </div>
                  <div className="p-2 rounded bg-slate-800/50 text-center">
                    <p className="text-slate-400">Premium</p>
                    <p className="text-emerald-400 font-bold">${u.premiumValue ? (u.premiumValue/1000).toFixed(0) + 'K' : 'N/A'}</p>
                  </div>
                </div>
                
                {/* Signals */}
                <div className="flex flex-wrap gap-1 mb-3">
                  {u.signals?.slice(0, 5).map((s: string, j: number) => (
                    <span key={j} className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300">{s}</span>
                  ))}
                </div>
                
                {/* Track Button for Unusual Options */}
                {onTrack && (
                  <button
                    onClick={async () => {
                      const optionType = (u.contract?.type || u.type)?.toUpperCase();
                      const res = await fetch('/api/tracker', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          ticker: data.ticker,
                          type: optionType,
                          strategy: `Unusual ${optionType}: $${u.contract?.strike || u.strike} ${u.contract?.expiration || ''} (${u.tradeType || 'UOA'})`,
                          entryPrice: u.contract?.ask || u.contract?.mark || 1.00, // FIX: Use option price, not stock price
                          confidence: u.score || 70,
                          reasoning: u.signals || [],
                          optionContract: {
                            strike: u.contract?.strike || u.strike,
                            expiration: u.contract?.expiration || u.expiration || 'N/A',
                            dte: u.contract?.dte || u.dte,
                            delta: u.contract?.delta || 0.5,
                            entryAsk: u.contract?.ask || u.contract?.mark || 1.00,
                            optionType: optionType === 'PUT' ? 'PUT' : 'CALL',
                          },
                        }),
                      });
                      const result = await res.json();
                      onTrack(res.ok, result.message || result.error);
                    }}
                    className="w-full mt-2 px-4 py-2 rounded-lg bg-orange-500/20 text-orange-400 text-sm font-medium hover:bg-orange-500/30 transition-colors border border-orange-500/30"
                  >
                    📊 Track This Unusual Activity
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Trade Suggestions */}
      {data.suggestions?.filter((s: any) => s.type !== 'ALERT').length > 0 && (

        <div className="p-5 rounded-2xl border border-blue-500/30 bg-gradient-to-br from-blue-950/30 to-cyan-950/20">
          <h2 className="text-lg font-semibold text-white mb-4">💡 Trade Setups</h2>
          {data.suggestions.filter((s: any) => s.type !== 'ALERT')[0]?.type === 'NO_TRADE' && (
            <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 mb-4">
              <p className="font-semibold text-amber-400">NO TRADE — quality gates not met</p>
              <div className="mt-2 space-y-1">
                {data.suggestions.filter((s: any) => s.type !== 'ALERT')[0].reasoning?.slice(0, 6).map((r: string, i: number) => (
                  <p key={i} className="text-xs text-slate-300">• {r}</p>
                ))}
              </div>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            {data.suggestions.filter((s: any) => s.type !== 'ALERT').slice(0, 4).map((sug: any, i: number) => (
              <div key={i} className={`p-4 rounded-xl border ${sug.type === 'CALL' ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-red-500/30 bg-red-500/5'}`}>
                <div className="flex items-center justify-between mb-3">
                  <span className="font-bold text-white">{sug.type === 'CALL' ? '📈' : '📉'} {sug.strategy}</span>
                  {sug.score && <span className={`font-bold ${sug.score.total >= 8 ? 'text-emerald-400' : 'text-amber-400'}`}>{sug.score.total}/12</span>}
                </div>
                {sug.contract && (
                  <div className="grid grid-cols-4 gap-2 mb-3 text-xs">
                    <div className="p-2 rounded bg-slate-800/50"><p className="text-slate-400">Strike</p><p className="font-bold text-white">${sug.contract.strike}</p></div>
                    <div className="p-2 rounded bg-slate-800/50"><p className="text-slate-400">Delta</p><p className={`font-bold ${sug.contract.delta > 0 ? 'text-emerald-400' : 'text-red-400'}`}>{sug.contract.delta?.toFixed(2)}</p></div>
                    <div className="p-2 rounded bg-slate-800/50"><p className="text-slate-400">DTE</p><p className="font-bold text-white">{sug.contract.dte}d</p></div>
                    <div className="p-2 rounded bg-slate-800/50"><p className="text-slate-400">Ask</p><p className="font-bold text-white">${sug.contract.ask?.toFixed(2)}</p></div>
                  </div>
                )}
                {sug.score && (
                  <div className="mb-2">
                    <div className="flex gap-1 flex-wrap">
                      <span className={`px-1.5 py-0.5 rounded text-xs ${sug.score.delta >= 1 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-400'}`} title="Delta Score: How likely option finishes in-the-money">Δ{sug.score.delta}</span>
                      <span className={`px-1.5 py-0.5 rounded text-xs ${sug.score.iv >= 1 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-400'}`} title="IV Score: Implied Volatility pricing">IV{sug.score.iv}</span>
                      <span className={`px-1.5 py-0.5 rounded text-xs ${sug.score.liquidity >= 1 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-400'}`} title="Liquidity Score: Trading volume & bid/ask spread">Liq{sug.score.liquidity}</span>
                      <span className={`px-1.5 py-0.5 rounded text-xs ${sug.score.unusual >= 1 ? 'bg-orange-500/20 text-orange-400' : 'bg-slate-700 text-slate-400'}`} title="Unusual Activity Score: Smart money signals">UOA{sug.score.unusual}</span>
                    </div>
                    {/* Score Explanation */}
                    <details className="mt-2">
                      <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-400">ℹ️ What do these scores mean?</summary>
                      <div className="mt-2 p-2 rounded bg-slate-800/50 text-xs space-y-1">
                        <p><span className="text-emerald-400">Δ (Delta):</span> <span className="text-slate-400">Probability of profit. Higher = more likely to be ITM at expiration. Score 0-2.</span></p>
                        <p><span className="text-emerald-400">IV:</span> <span className="text-slate-400">Implied Volatility. Low IV = cheap options. Score 0-2.</span></p>
                        <p><span className="text-emerald-400">Liq:</span> <span className="text-slate-400">Liquidity. Tight spreads & high volume = easy entry/exit. Score 0-2.</span></p>
                        <p><span className="text-orange-400">UOA:</span> <span className="text-slate-400">Unusual Options Activity. Smart money signals. Score 0-2.</span></p>
                        <p className="pt-1 border-t border-slate-700"><span className="text-white">Total: {sug.score.total}/12</span> <span className="text-slate-400">- Higher is better. 8+ is strong.</span></p>
                      </div>
                    </details>
                  </div>
                )}
                <div className="space-y-1 mb-2">
                  {sug.reasoning?.slice(0, 3).map((r: string, j: number) => <p key={j} className="text-xs text-slate-300">• {r}</p>)}
                </div>
                
                {/* Track Button */}
                {onTrack && <TrackButton ticker={data.ticker} suggestion={sug} entryPrice={data.currentPrice} onTrack={onTrack} />}
                
                {/* Detailed Explanation */}
                {sug.detailedExplanation && (
                  <details className="mt-2 pt-2 border-t border-slate-700/50">
                    <summary className="text-xs text-blue-400 cursor-pointer hover:text-blue-300">📖 View Detailed Analysis</summary>
                    <div className="mt-2 space-y-2 text-xs">
                      <p className="text-slate-200">{sug.detailedExplanation.summary}</p>
                      
                      {sug.detailedExplanation.whyThisStrike && (
                        <p className="text-slate-400">💰 {sug.detailedExplanation.whyThisStrike}</p>
                      )}
                      {sug.detailedExplanation.riskReward && (
                        <p className="text-slate-400">⚖️ {sug.detailedExplanation.riskReward}</p>
                      )}
                      {sug.detailedExplanation.marketContext && (
                        <p className="text-slate-400">📊 {sug.detailedExplanation.marketContext}</p>
                      )}
                      
                      {sug.detailedExplanation.scoreBreakdown && (
                        <div className="mt-2 p-2 rounded bg-slate-800/50 space-y-1">
                          <p className="text-slate-400 font-medium">Score Breakdown:</p>
                          {Object.entries(sug.detailedExplanation.scoreBreakdown).map(([key, val]: [string, any]) => (
                            <p key={key} className={`${val.score >= 1 ? 'text-emerald-400' : 'text-slate-500'}`}>
                              {key}: {val.score}/{val.max} - {val.reason}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  </details>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Alerts */}
      {data.suggestions?.filter((s: any) => s.type === 'ALERT').length > 0 && (
        <div className="space-y-2">
          {data.suggestions.filter((s: any) => s.type === 'ALERT').map((alert: any, i: number) => (
            <div key={i} className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/5">
              <p className="text-sm font-medium text-amber-400">{alert.strategy}</p>
              <p className="text-xs text-slate-400 mt-1">{alert.reasoning?.slice(0, 2).join(' • ')}</p>
            </div>
          ))}
        </div>
      )}

      {/* Market Context */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <div className="p-3 rounded-xl border border-slate-700/50 bg-slate-800/30 text-center">
          <p className="text-xs text-slate-400">Trend</p>
          <p className={`text-lg font-bold ${data.technicals?.trend === 'BULLISH' ? 'text-emerald-400' : data.technicals?.trend === 'BEARISH' ? 'text-red-400' : 'text-slate-300'}`}>{data.technicals?.trend || 'N/A'}</p>
        </div>
        <div className="p-3 rounded-xl border border-slate-700/50 bg-slate-800/30 text-center">
          <p className="text-xs text-slate-400">RSI</p>
          <p className={`text-lg font-bold ${data.technicals?.rsi > 70 ? 'text-red-400' : data.technicals?.rsi < 30 ? 'text-emerald-400' : 'text-white'}`}>{data.technicals?.rsi || 50}</p>
        </div>
        <div className="p-3 rounded-xl border border-slate-700/50 bg-slate-800/30 text-center">
          <p className="text-xs text-slate-400">IV Rank</p>
          <p className={`text-lg font-bold ${data.ivAnalysis?.ivRank > 70 ? 'text-red-400' : data.ivAnalysis?.ivRank < 30 ? 'text-emerald-400' : 'text-amber-400'}`}>{data.ivAnalysis?.ivRank || 50}%</p>
        </div>
        <div className="p-3 rounded-xl border border-slate-700/50 bg-slate-800/30 text-center">
          <p className="text-xs text-slate-400">P/C Ratio</p>
          <p className={`text-lg font-bold ${data.metrics?.putCallRatio < 0.7 ? 'text-emerald-400' : data.metrics?.putCallRatio > 1.2 ? 'text-red-400' : 'text-white'}`}>{data.metrics?.putCallRatio || '1.00'}</p>
        </div>
        <div className="p-3 rounded-xl border border-slate-700/50 bg-slate-800/30 text-center">
          <p className="text-xs text-slate-400">Max Pain</p>
          <p className="text-lg font-bold text-white">${data.metrics?.maxPain || 'N/A'}</p>
        </div>
        <div className="p-3 rounded-xl border border-slate-700/50 bg-slate-800/30 text-center">
          <p className="text-xs text-slate-400">Sentiment</p>
          <p className={`text-lg font-bold ${data.metrics?.sentiment === 'BULLISH' ? 'text-emerald-400' : data.metrics?.sentiment === 'BEARISH' ? 'text-red-400' : 'text-slate-300'}`}>{data.metrics?.sentiment || 'N/A'}</p>
        </div>
      </div>

      {/* Expiration Selector */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm text-slate-400">Expiration:</span>
        <div className="flex gap-2 flex-wrap">
          {data.expirations?.slice(0, 6).map((exp: string) => (
            <button key={exp} onClick={() => setSelectedExp(exp)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${selectedExp === exp ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-slate-800/50 text-slate-400 hover:text-white border border-transparent'}`}>{exp}</button>
          ))}
          {data.expirations?.length > 6 && (
            <select value={selectedExp} onChange={(e) => setSelectedExp(e.target.value)} className="px-2 py-1 rounded-lg text-xs bg-slate-800 border border-slate-700 text-white">
              {data.expirations.map((exp: string) => <option key={exp} value={exp}>{exp}</option>)}
            </select>
          )}
        </div>
      </div>

      {/* Call/Put Toggle */}
      <div className="flex items-center justify-center gap-2 p-2 bg-slate-800/50 rounded-xl">
        <button onClick={() => setShowCalls(true)} className={`flex-1 py-2 rounded-lg font-medium transition ${showCalls ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-400 hover:text-white'}`}>📈 CALLS ({currentChain.calls?.length || 0})</button>
        <button onClick={() => setShowCalls(false)} className={`flex-1 py-2 rounded-lg font-medium transition ${!showCalls ? 'bg-red-500/20 text-red-400' : 'text-slate-400 hover:text-white'}`}>📉 PUTS ({currentChain.puts?.length || 0})</button>
      </div>

      {/* Options Chain */}
      <div className={`rounded-2xl border ${showCalls ? 'border-emerald-500/30' : 'border-red-500/30'} overflow-hidden`}>
        <div className={`p-3 ${showCalls ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
          <div className="flex justify-between text-sm">
            <span className="font-medium text-white">{selectedExp} • {options?.length || 0} contracts</span>
            <span className="text-slate-400">${data.currentPrice?.toFixed(2)} underlying</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-800/50">
              <tr className="text-slate-400">
                <th className="text-left py-2 px-3">Strike</th>
                <th className="text-right py-2 px-3">Bid</th>
                <th className="text-right py-2 px-3">Ask</th>
                <th className="text-right py-2 px-3">Last</th>
                <th className="text-right py-2 px-3">Delta</th>
                <th className="text-right py-2 px-3">IV</th>
                <th className="text-right py-2 px-3">Vol</th>
                <th className="text-right py-2 px-3">OI</th>
                <th className="text-right py-2 px-3">V/OI</th>
              </tr>
            </thead>
            <tbody>
              {options?.slice(0, 25).map((opt: any, i: number) => (
                <tr key={i} className={`border-t border-slate-800/50 hover:bg-slate-700/20 ${opt.itm ? (showCalls ? 'bg-emerald-500/5' : 'bg-red-500/5') : ''} ${opt.isUnusual ? 'ring-1 ring-orange-500/50' : ''}`}>
                  <td className="py-2 px-3">
                    <span className={`font-mono font-bold ${opt.itm ? 'text-white' : 'text-slate-300'}`}>${opt.strike}</span>
                    {opt.itm && <span className="ml-1 text-xs text-slate-400">ITM</span>}
                    {opt.isUnusual && <span className="ml-1 text-xs text-orange-400">🔥</span>}
                  </td>
                  <td className="text-right py-2 px-3 font-mono text-slate-300">${opt.bid?.toFixed(2)}</td>
                  <td className="text-right py-2 px-3 font-mono text-slate-300">${opt.ask?.toFixed(2)}</td>
                  <td className="text-right py-2 px-3 font-mono text-white">${opt.last?.toFixed(2)}</td>
                  <td className={`text-right py-2 px-3 font-mono ${opt.delta > 0 ? 'text-emerald-400' : 'text-red-400'}`}>{opt.delta?.toFixed(2)}</td>
                  <td className="text-right py-2 px-3 font-mono text-amber-400">{(opt.iv * 100)?.toFixed(0)}%</td>
                  <td className={`text-right py-2 px-3 font-mono ${opt.volume > 500 ? 'text-amber-400 font-bold' : 'text-slate-400'}`}>{opt.volume?.toLocaleString()}</td>
                  <td className="text-right py-2 px-3 font-mono text-slate-400">{opt.openInterest?.toLocaleString()}</td>
                  <td className={`text-right py-2 px-3 font-mono ${opt.volumeOIRatio >= 1.5 ? 'text-orange-400 font-bold' : 'text-slate-400'}`}>{opt.volumeOIRatio?.toFixed(1)}x</td>
                </tr>
              ))}
              {(!options || options.length === 0) && <tr><td colSpan={9} className="text-center py-8 text-slate-500">No options available</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-center text-slate-500">{data.expirations?.length} expirations • {data.allCalls?.length || 0} calls • {data.allPuts?.length || 0} puts</p>
    </div>
  );
}


// ============================================================
// MAIN DASHBOARD - FULLY INTEGRATED
// ============================================================
export default function TradingDashboard() {
  const QUICK_TICKERS = ['SPY', 'QQQ', 'AAPL', 'MSFT', 'NVDA', 'TSLA', 'AMZN', 'GOOGL', 'META'];
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
  
  const handleSearch = async (symbol?: string) => {
    const sym = (symbol || ticker || '').trim().toUpperCase();
    if (!sym) return;
    if (symbol) setTicker(sym);
    
    setStockData(null);
    setOptionsData(null);
    setStockLoading(true);
    setOptionsLoading(true);
    
    // Fetch stock data
    fetch(`/api/stock/${sym}`)
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
    fetch(`/api/options/${sym}`)
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
          <div className="flex gap-2">
            <input
              type="text"
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Enter ticker symbol (e.g., AAPL, TSLA, NVDA)..."
              className="flex-1 px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
            <button
              onClick={() => handleSearch()}
              disabled={!ticker}
              className="px-6 py-3 bg-gradient-to-r from-blue-500 to-emerald-500 hover:from-blue-600 hover:to-emerald-600 rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover:scale-105 active:scale-95"
            >
              Analyze
            </button>
          </div>

          {/* Quick Select */}
          <div className="mt-3 flex flex-wrap gap-2">
            {QUICK_TICKERS.map((t) => (
              <button
                key={t}
                onClick={() => {
                  setTicker(t);
                  handleSearch(t);
                }}
                className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/40 text-xs text-slate-200 hover:bg-slate-700/40 hover:text-white transition"
              >
                {t}
              </button>
            ))}
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
