'use client';
import React, { useState, useEffect } from 'react';

// New refactored components
import { StockScoreBreakdown } from './components/stock/StockScoreBreakdown';
import { ConsensusSourcesList } from './components/stock/ConsensusSourcesList';
import { ChartPatternCard } from './components/stock/ChartPatternCard';
import LiveCandlesCard from './components/stock/LiveCandlesCard';
import { OptionsDecisionHero } from './components/options/OptionsDecisionHero';
import { UnusualActivitySection } from './components/options/UnusualActivitySection';
import { OptionsSetupCard } from './components/options/OptionsSetupCard';
import { EvidenceDrawer } from './components/core/EvidenceDrawer';
import { RealPortfolio } from './components/portfolio/RealPortfolio';
import { PaperPortfolio } from './components/portfolio/PaperPortfolio';
import { PortfolioContextAlert } from './components/portfolio/PortfolioContextAlert';
import { OrderModal } from './components/trading/OrderModal';
import { COMPANY_NAMES } from '@/lib/companyNames';
import { addPaperTrade } from '@/lib/paperTrades';

// Phase 6-9: New features
import { AlertManager } from './components/alerts/AlertManager';
import { BacktestRunner } from './components/backtest/BacktestRunner';
import { PortfolioGreeksDashboard } from './components/portfolio/PortfolioGreeksDashboard';

// NEW: AI Suggestions Feed
import { SuggestionFeed } from './components/ai-suggestions/SuggestionFeed';

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
// ERROR BOUNDARY - Prevents app crashes from rendering errors
// ============================================================
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white p-4 flex items-center justify-center">
          <div className="max-w-2xl w-full p-6 rounded-2xl border border-red-500/30 bg-red-500/5">
            <h2 className="text-2xl font-bold text-red-400 mb-4">⚠️ Something went wrong</h2>
            <p className="text-slate-300 mb-4">
              The app encountered an unexpected error. This has been logged and won't affect your other tabs.
            </p>
            {this.state.error && (
              <div className="p-4 rounded-lg bg-slate-900/50 border border-slate-700 mb-4">
                <p className="text-sm text-slate-400 font-mono">{this.state.error.message}</p>
              </div>
            )}
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white font-medium transition-colors"
            >
              Reload App
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
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
function TrackerTab({ 
  onViewEvidence,
  onSymbolSelect,
  onTrade
}: { 
  onViewEvidence?: (data: any) => void;
  onSymbolSelect?: (symbol: string) => void;
  onTrade?: (symbol: string, price: number, action: 'BUY' | 'SELL' | 'HOLD', quantity: number) => void;
}) {
  const [trackerData, setTrackerData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showOvernightInfo, setShowOvernightInfo] = useState(false);
  const [showRealPortfolio, setShowRealPortfolio] = useState(false);
  
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
  
  // Show real portfolio if toggled
  if (showRealPortfolio) {
    return (
      <div className="space-y-6 animate-fade-in">
        {/* Toggle Switch */}
        <div className="flex items-center justify-between p-4 rounded-xl border border-slate-700/50 bg-slate-800/30">
          <div>
            <h3 className="text-lg font-semibold text-white">Portfolio View</h3>
            <p className="text-sm text-slate-400">Switch between paper trading and live Schwab account</p>
          </div>
          <button
            onClick={() => setShowRealPortfolio(false)}
            className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 transition flex items-center gap-2"
          >
            <span>📊</span>
            Switch to Paper Trading
          </button>
        </div>
        
        <RealPortfolio 
          onAnalyze={(symbol) => {
            // Switch to Stock Analysis tab and load symbol
            if (onSymbolSelect) {
              onSymbolSelect(symbol);
            }
          }}
          onTrade={(symbol, price, action, quantity) => {
            // Open order modal with position details
            if (onTrade) {
              onTrade(symbol, price, action, quantity);
            }
          }}
        />
      </div>
    );
  }
  
  const suggestions = trackerData.suggestions || [];
  const stats = trackerData.stats || {};
  const active = suggestions.filter((s: any) => s.status === 'ACTIVE');
  const closed = suggestions.filter((s: any) => s.status !== 'ACTIVE');
  
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Toggle Switch */}
      <div className="flex items-center justify-between p-4 rounded-xl border border-blue-500/30 bg-blue-500/10">
        <div>
          <h3 className="text-lg font-semibold text-white">Portfolio View</h3>
          <p className="text-sm text-slate-400">Currently showing paper trading portfolio</p>
        </div>
        <button
          onClick={() => setShowRealPortfolio(true)}
          className="px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 transition flex items-center gap-2"
        >
          <span>💰</span>
          View Live Schwab Account
        </button>
      </div>

      <PaperPortfolio />
      
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
  onViewEvidence,
  onTrade
}: { 
  data: any; 
  loading: boolean;
  ticker: string;
  onTrack?: (success: boolean, message: string) => void;
  onViewEvidence?: () => void;
  onTrade?: (symbol: string, price: number, action: 'BUY' | 'SELL' | 'HOLD', quantity: number) => void;
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

  const companyName = data.name || COMPANY_NAMES[ticker as keyof typeof COMPANY_NAMES] || ticker;
  const primary = Array.isArray(suggestions) && suggestions.length > 0 ? suggestions[0] : null;
  const tradeDecision = data?.meta?.tradeDecision;
  const price = Number(data.price || data.quote?.c || 0) || 0;

  const changeAbs = Number(
    data?.quote?.d ??
    data?.quote?.netChange ??
    (Number.isFinite(data?.quote?.o) ? (price - Number(data.quote.o)) : 0)
  ) || 0;
  const changePct = Number(
    data?.quote?.dp ??
    data?.quote?.percentChange ??
    (price && Number.isFinite(data?.quote?.o) ? ((price - Number(data.quote.o)) / price) * 100 : 0)
  ) || 0;

  const actionRaw: string = (primary?.type || tradeDecision?.action || 'NO_TRADE') as string;
  const action: 'BUY' | 'SELL' | 'HOLD' | 'NO_TRADE' =
    actionRaw === 'STRONG_BUY' ? 'BUY' :
    actionRaw === 'STRONG_SELL' ? 'SELL' :
    actionRaw === 'BUY' ? 'BUY' :
    actionRaw === 'SELL' ? 'SELL' :
    actionRaw === 'HOLD' ? 'HOLD' :
    'NO_TRADE';

  const confidence: number =
    typeof primary?.confidence === 'number' ? primary.confidence :
    typeof tradeDecision?.confidence === 'number' ? tradeDecision.confidence :
    0;

  const reasons: string[] = Array.isArray(primary?.reasoning) ? primary.reasoning : (Array.isArray(tradeDecision?.rationale) ? tradeDecision.rationale : []);
  const invalidation: string =
    typeof primary?.invalidation === 'string' && primary.invalidation ? primary.invalidation :
    (Array.isArray(tradeDecision?.rationale) && tradeDecision.rationale.length > 0 ? String(tradeDecision.rationale[0]) : '');

  const entry = primary?.entry ?? null;
  const target = primary?.target ?? null;
  const stop = primary?.stop ?? null;
  const horizon = primary?.timeHorizon || 'N/A';
  const setup = primary?.setup || primary?.strategy || 'N/A';

  const actionLabel =
    action === 'BUY' ? 'BUY STOCK' :
    action === 'SELL' ? 'SELL / TRIM' :
    action === 'HOLD' ? 'HOLD' :
    'NO TRADE';

  const actionBadgeClass =
    action === 'BUY' ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' :
    action === 'SELL' ? 'bg-red-500/15 text-red-300 border-red-500/30' :
    action === 'HOLD' ? 'bg-blue-500/15 text-blue-300 border-blue-500/30' :
    'bg-amber-500/15 text-amber-300 border-amber-500/30';

  const confidenceLabel =
    confidence >= 75 ? 'STRONG' :
    confidence >= 60 ? 'GOOD' :
    confidence >= 45 ? 'MIXED' :
    'LOW';

  return (
    <div className="space-y-4 animate-fade-in">

      {/* Robinhood-style header + chart */}
      <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900/20">
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="text-xs text-slate-400">{ticker}</div>
            <div className="text-2xl font-bold text-white leading-tight">{companyName}</div>
            <div className="mt-2 flex items-baseline gap-2">
              <div className="text-4xl font-extrabold text-white">${price.toFixed(2)}</div>
              <div className={`text-sm font-semibold ${changeAbs >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {changeAbs >= 0 ? '▲' : '▼'} {Math.abs(changeAbs).toFixed(2)} ({Math.abs(changePct).toFixed(2)}%)
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                addPaperTrade({
                  symbol: ticker,
                  companyName,
                  instrument: 'STOCK',
                  side: action === 'SELL' ? 'SELL' : 'BUY',
                  quantity: 1,
                  entryPrice: price,
                  confidence,
                  reasons: (reasons || []).slice(0, 3),
                  invalidation,
                });
                if (onTrack) onTrack(true, `✓ Tracked (Paper) ${ticker}`);
              }}
              className="px-4 py-2 rounded-full border border-slate-700 bg-slate-950/40 text-slate-100 text-xs font-semibold hover:bg-slate-900/40 transition"
            >
              📌 Track
            </button>
            <button
              onClick={() => {
                if (!onTrade) return;
                onTrade(ticker, price, action === 'SELL' ? 'SELL' : action === 'HOLD' ? 'HOLD' : 'BUY', 1);
              }}
              className="px-5 py-2 rounded-full border border-emerald-500/30 bg-emerald-500/20 text-emerald-100 text-xs font-semibold hover:bg-emerald-500/30 transition"
            >
              ⚡ Trade
            </button>
          </div>
        </div>

        <div className="mt-4">
          <LiveCandlesCard symbol={ticker} />
        </div>
      </div>

      {/* Decision Ticket (clarity-first) */}
      <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900/30">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-lg font-semibold text-white">
              {companyName} <span className="text-slate-400 font-normal">({ticker})</span>
            </div>
            <div className="mt-2 inline-flex items-center gap-2">
              <span className={`px-3 py-1 rounded-full text-xs font-bold border ${actionBadgeClass}`}>{actionLabel}</span>
              <span className="px-3 py-1 rounded-full text-xs font-semibold border border-slate-700 bg-slate-800/40 text-slate-200">
                Confidence {confidence}/100 • {confidenceLabel}
              </span>
              {data?.meta?.regime && (
                <span className="hidden sm:inline px-3 py-1 rounded-full text-xs font-semibold border border-slate-800 bg-slate-950/40 text-slate-300">
                  Regime: {String(data.meta.regime)}
                </span>
              )}
            </div>
          </div>

          <button
            onClick={onViewEvidence}
            className="px-3 py-2 rounded-full border border-slate-700 bg-slate-950/30 text-slate-200 text-xs font-semibold hover:bg-slate-950/50 transition"
          >
            Evidence →
          </button>
        </div>

        {/* Execution */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="p-3 rounded-xl border border-slate-800 bg-slate-950/40">
            <div className="text-[11px] text-slate-400">Current</div>
            <div className="text-base font-bold text-white">${price.toFixed(2)}</div>
            <div className="text-[11px] text-slate-500">Horizon: {horizon}</div>
          </div>
          <div className="p-3 rounded-xl border border-slate-800 bg-slate-950/40">
            <div className="text-[11px] text-slate-400">Execution</div>
            <div className="text-sm text-slate-200">
              Entry: <span className="font-semibold text-white">{entry ?? '—'}</span>
            </div>
            <div className="text-sm text-slate-200">
              Target: <span className="font-semibold text-white">{target ?? '—'}</span>
            </div>
            <div className="text-sm text-slate-200">
              Stop: <span className="font-semibold text-white">{stop ?? '—'}</span>
            </div>
          </div>
          <div className="p-3 rounded-xl border border-slate-800 bg-slate-950/40">
            <div className="text-[11px] text-slate-400">Setup</div>
            <div className="text-sm font-semibold text-white">{setup}</div>
            {invalidation ? (
              <div className="mt-2 text-[12px] text-amber-300">
                Invalidation: <span className="text-slate-200">{invalidation}</span>
              </div>
            ) : (
              <div className="mt-2 text-[12px] text-slate-500">Invalidation: —</div>
            )}
          </div>
        </div>

        {/* Why (max 3) */}
        {reasons && reasons.length > 0 && (
          <div className="mt-4">
            <div className="text-xs font-semibold text-slate-300 mb-2">Why</div>
            <ul className="text-sm text-slate-300 list-disc pl-5 space-y-1">
              {reasons.slice(0, 3).map((r, idx) => (
                <li key={idx}>{r}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Portfolio Context Alert (kept, but below the ticket) */}
      {data.portfolioContext && (
        <PortfolioContextAlert portfolioContext={data.portfolioContext} />
      )}

      {/* Deep details (collapsed by default to avoid overload) */}
      <details className="group rounded-2xl border border-slate-800 bg-slate-900/20 p-4">
        <summary className="cursor-pointer list-none flex items-center justify-between">
          <div className="text-sm font-semibold text-white">Details (scores, patterns, sources)</div>
          <div className="text-xs text-slate-400 group-open:hidden">Expand</div>
          <div className="text-xs text-slate-400 hidden group-open:block">Collapse</div>
        </summary>
        <div className="mt-4 space-y-4">
          <StockScoreBreakdown analysis={analysis} />

          <ConsensusSourcesList 
            fundamentals={fundamentals}
            technicals={technicals}
            news={news}
            analysts={analysts}
            chartPatterns={chartPatterns}
          />

          <ChartPatternCard chartPatterns={chartPatterns} />
        </div>
      </details>

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

  if (loading) return <LoadingSpinner />;
  if (!data) return <p className="text-slate-500 text-center py-12">Enter a ticker symbol to view options</p>;
  if (data.error) {
    return (
      <div className="p-6 rounded-2xl border border-red-500/30 bg-red-500/5 animate-fade-in">
        <h3 className="text-lg font-semibold text-red-400 mb-3">⚠️ {data.error}</h3>
        {data.details && <p className="text-sm text-red-300 mb-3 whitespace-pre-wrap">{data.details}</p>}
        {(Array.isArray(data.instructions) ? data.instructions : (data.instructions ? [String(data.instructions)] : [])).map((i: string, idx: number) => (
            <p key={idx} className="text-xs text-slate-400">• {i}</p>
          ))}
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Options Decision Hero */}
      <OptionsDecisionHero 
        ticker={ticker}
        currentPrice={data.currentPrice}
        meta={data.meta}
        suggestions={data.suggestions}
        onViewEvidence={onViewEvidence}
      />
      
      {/* Unusual Options Activity - ALWAYS VISIBLE */}
      <UnusualActivitySection 
        activities={data.unusualActivity || []}
        onTrack={(activity) => {
          if (!onTrack) return;
          
          const optionType = (activity.contract?.type || activity.type)?.toUpperCase();
          fetch('/api/tracker', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ticker,
              type: optionType,
              strategy: `Unusual ${optionType}: $${activity.contract?.strike || activity.strike} ${activity.contract?.expiration || ''} (${activity.tradeType || 'UOA'})`,
              entryPrice: activity.contract?.ask || activity.contract?.mark || 1.00,
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
          }).catch(err => {
            onTrack(false, 'Failed to track position');
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
                  
                  // CRITICAL FIX: Check if contract exists before accessing properties
                  if (!setup.contract) {
                    onTrack(false, 'Invalid setup: missing contract data');
                    return;
                  }
                  
                  fetch('/api/tracker', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      ticker,
                      type: setup.type,
                      strategy: setup.strategy,
                      entryPrice: setup.contract?.ask || 1.00,
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
                  }).catch(err => {
                    onTrack(false, 'Failed to track position');
                  });
                }}
              />
            ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// MAIN DASHBOARD - FULLY INTEGRATED
// ============================================================
export default function TradingDashboard() {
  // Top 10 most liquid stocks/ETFs - always visible
  const TOP_LIQUID_TICKERS = [
    'SPY',    // S&P 500 ETF - highest volume
    'QQQ',    // Nasdaq 100 ETF
    'AAPL',   // Apple
    'TSLA',   // Tesla - extremely high volume
    'NVDA',   // Nvidia
    'AMZN',   // Amazon
    'MSFT',   // Microsoft
    'META',   // Meta
    'AMD',    // AMD - very liquid
    'GOOGL',  // Google
  ];
  
  // Additional tickers organized by industry - hidden by default
  const INDUSTRY_TICKERS = {
    'Technology': [
      'AAPL', 'MSFT', 'GOOGL', 'META', 'NVDA', 
      'AVGO', 'ORCL', 'CRM', 'ADBE', 'ACN',
      'NOW', 'INTU', 'AMAT', 'LRCX', 'KLAC'
    ],
    'Semiconductors': [
      'NVDA', 'TSM', 'AVGO', 'AMD', 'INTC',
      'QCOM', 'TXN', 'AMAT', 'LRCX', 'KLAC',
      'ADI', 'MRVL', 'NXPI', 'MCHP', 'ON'
    ],
    'Finance': [
      'JPM', 'BAC', 'WFC', 'MS', 'GS',
      'C', 'BX', 'SCHW', 'AXP', 'USB',
      'PNC', 'TFC', 'BLK', 'COF', 'CME'
    ],
    'Healthcare': [
      'UNH', 'JNJ', 'LLY', 'ABBV', 'MRK',
      'TMO', 'ABT', 'DHR', 'PFE', 'BMY',
      'AMGN', 'GILD', 'CVS', 'CI', 'HCA'
    ],
    'Consumer Discretionary': [
      'AMZN', 'TSLA', 'HD', 'MCD', 'NKE',
      'SBUX', 'LOW', 'TJX', 'BKNG', 'MAR',
      'CMG', 'ABNB', 'GM', 'F', 'ORLY'
    ],
    'Consumer Staples': [
      'WMT', 'COST', 'PG', 'KO', 'PEP',
      'PM', 'MO', 'CL', 'MDLZ', 'KMB',
      'GIS', 'STZ', 'HSY', 'K', 'CPB'
    ],
    'Energy': [
      'XOM', 'CVX', 'COP', 'SLB', 'EOG',
      'MPC', 'PSX', 'VLO', 'OXY', 'HAL',
      'KMI', 'WMB', 'DVN', 'HES', 'BKR'
    ],
    'Industrials': [
      'CAT', 'BA', 'GE', 'UPS', 'HON',
      'UNP', 'RTX', 'LMT', 'DE', 'MMM',
      'EMR', 'ETN', 'ITW', 'CSX', 'NSC'
    ],
    'Communication Services': [
      'META', 'GOOGL', 'NFLX', 'DIS', 'CMCSA',
      'T', 'VZ', 'TMUS', 'CHTR', 'EA',
      'TTWO', 'WBD', 'PARA', 'FOXA', 'MTCH'
    ],
    'Real Estate': [
      'PLD', 'AMT', 'EQIX', 'PSA', 'WELL',
      'SPG', 'DLR', 'O', 'CCI', 'VICI',
      'AVB', 'EQR', 'SBAC', 'WY', 'ARE'
    ],
    'Utilities': [
      'NEE', 'DUK', 'SO', 'D', 'AEP',
      'EXC', 'SRE', 'XEL', 'ED', 'PEG',
      'EIX', 'WEC', 'ES', 'AWK', 'DTE'
    ],
    'Materials': [
      'LIN', 'APD', 'SHW', 'ECL', 'DD',
      'NEM', 'FCX', 'NUE', 'DOW', 'PPG',
      'VMC', 'MLM', 'ALB', 'CF', 'MOS'
    ],
    'ETFs & Index Funds': [
      'SPY', 'QQQ', 'IWM', 'DIA', 'VTI',
      'VOO', 'VEA', 'VWO', 'AGG', 'BND',
      'XLF', 'XLE', 'XLK', 'XLV', 'XLI'
    ]
  };
  
  const [ticker, setTicker] = useState('');
  const [showMoreTickers, setShowMoreTickers] = useState(false);
  const [activeTab, setActiveTab] = useState<'feed' | 'stock' | 'options' | 'tracker' | 'alerts' | 'backtest' | 'greeks'>('feed');
  const [stockData, setStockData] = useState<any>(null);
  const [optionsData, setOptionsData] = useState<any>(null);
  const [stockLoading, setStockLoading] = useState(false);
  const [optionsLoading, setOptionsLoading] = useState(false);
  
  // Evidence Drawer state
  const [evidenceDrawerOpen, setEvidenceDrawerOpen] = useState(false);
  const [evidenceData, setEvidenceData] = useState<any>(null);
  
  // Order Modal state
  const [orderModalOpen, setOrderModalOpen] = useState(false);
  const [orderSymbol, setOrderSymbol] = useState('');
  const [orderPrice, setOrderPrice] = useState(0);
  const [orderAction, setOrderAction] = useState<'BUY' | 'SELL' | 'HOLD'>('BUY');
  const [orderQuantity, setOrderQuantity] = useState(1);
  
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
    
    // Smooth scroll to top after ticker selection
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    // CRITICAL: Add timestamp for cache busting to get fresh data
    const cacheBuster = `?_t=${Date.now()}`;
    
    // Fetch stock data with retry on 401
    const fetchStockWithRetry = async (retries = 1) => {
      try {
        const res = await fetch(`/api/stock/${sym}${cacheBuster}`);
        if (res.status === 401 && retries > 0) {
          // 401 = token expired, wait 500ms and retry once
          await new Promise(resolve => setTimeout(resolve, 500));
          return fetchStockWithRetry(retries - 1);
        }
        const data = await res.json();
        setStockData(data);
        setStockLoading(false);
      } catch (err) {
        setStockData({ error: 'Failed to fetch stock data' });
        setStockLoading(false);
      }
    };
    
    // Fetch options data with retry on 401
    const fetchOptionsWithRetry = async (retries = 1) => {
      try {
        const res = await fetch(`/api/options/${sym}${cacheBuster}`);
        if (res.status === 401 && retries > 0) {
          // 401 = token expired, wait 500ms and retry once
          await new Promise(resolve => setTimeout(resolve, 500));
          return fetchOptionsWithRetry(retries - 1);
        }
        const data = await res.json();
        setOptionsData(data);
        setOptionsLoading(false);
      } catch (err) {
        setOptionsData({ error: 'Failed to fetch options data' });
        setOptionsLoading(false);
      }
    };
    
    // Execute both fetches
    fetchStockWithRetry();
    fetchOptionsWithRetry();
  };
  
  const handleTrack = (success: boolean, message: string) => {
    setToast({ type: success ? 'success' : 'error', message });
  };
  
  const handleViewEvidence = (data: any) => {
    setEvidenceData(data);
    setEvidenceDrawerOpen(true);
  };
  
  const handleTrade = (symbol: string, price: number, action: 'BUY' | 'SELL' | 'HOLD', quantity: number = 1) => {
    setOrderSymbol(symbol);
    setOrderPrice(price);
    setOrderAction(action);
    setOrderQuantity(quantity);
    setOrderModalOpen(true);
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white p-4">
      {/* Order Modal */}
      <OrderModal
        isOpen={orderModalOpen}
        onClose={() => setOrderModalOpen(false)}
        symbol={orderSymbol}
        currentPrice={orderPrice}
        recommendation={orderAction}
        initialQuantity={orderQuantity}
        assetType="EQUITY"
      />
      
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

          {/* Quick Select - Top 10 Most Liquid */}
          <div className="mt-3">
            {/* Top 10 Liquid Tickers - Always Visible */}
            <div className="flex flex-wrap gap-2">
              {TOP_LIQUID_TICKERS.map((t) => (
                <button
                  key={t}
                  onClick={() => {
                    setTicker(t);
                    handleSearch(t);
                    setShowMoreTickers(false); // Auto-collapse after selection
                  }}
                  className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/40 text-xs text-slate-200 hover:bg-slate-700/40 hover:text-white transition font-medium"
                >
                  {t}
                </button>
              ))}
              
              {/* Show More Button */}
              <button
                onClick={() => setShowMoreTickers(!showMoreTickers)}
                className="px-3 py-1.5 rounded-lg border border-blue-500/30 bg-blue-500/10 text-xs text-blue-400 hover:bg-blue-500/20 transition font-medium flex items-center gap-1"
              >
                {showMoreTickers ? '− Show Less' : '+ More Tickers'}
              </button>
            </div>
            
            {/* Additional Tickers - Organized by Industry */}
            {showMoreTickers && (
              <div className="mt-3 space-y-3 animate-fade-in">
                {Object.entries(INDUSTRY_TICKERS).map(([industry, tickers]) => (
                  <div 
                    key={industry}
                    className="p-3 rounded-lg border border-slate-700/50 bg-slate-800/20"
                  >
                    {/* Industry Header */}
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-semibold text-blue-400">{industry}</span>
                      <span className="text-xs text-slate-500">({tickers.length} stocks)</span>
                    </div>
                    
                    {/* Ticker Buttons */}
                    <div className="flex flex-wrap gap-2">
                      {tickers.map((t) => (
                        <button
                          key={`${industry}-${t}`}
                          onClick={() => {
                            setTicker(t);
                            handleSearch(t);
                            setShowMoreTickers(false); // Auto-collapse after selection
                          }}
                          className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/40 text-xs text-slate-200 hover:bg-slate-700/40 hover:text-white transition"
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        
        {/* Tabs */}
        <div className="flex gap-2 mb-6 p-1 bg-slate-800/50 rounded-xl border border-slate-700 overflow-x-auto">
          {(['feed', 'stock', 'options', 'tracker', 'alerts', 'backtest', 'greeks'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all duration-200 whitespace-nowrap ${
                activeTab === tab
                  ? 'bg-gradient-to-r from-blue-500 to-emerald-500 text-white shadow-lg'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              {tab === 'feed' && '🤖 AI Feed'}
              {tab === 'stock' && '📊 Stocks'}
              {tab === 'options' && '📈 Options'}
              {tab === 'tracker' && '💼 Portfolio'}
              {tab === 'alerts' && '🔔 Alerts'}
              {tab === 'backtest' && '📈 Backtest'}
              {tab === 'greeks' && '🎯 Greeks'}
            </button>
          ))}
        </div>
        
        {/* Tab Content */}
        <div className="min-h-[60vh]">
          <ErrorBoundary>
            {activeTab === 'feed' && (
              <SuggestionFeed />
            )}
            
            {activeTab === 'stock' && (
              <StockTab 
                data={stockData}
                loading={stockLoading}
                ticker={ticker}
                onTrack={handleTrack}
                onViewEvidence={() => handleViewEvidence(stockData)}
                onTrade={handleTrade}
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
              <TrackerTab 
                onViewEvidence={handleViewEvidence}
                onSymbolSelect={(symbol) => {
                  setTicker(symbol);
                  setActiveTab('stock');
                  handleSearch(symbol);
                }}
                onTrade={handleTrade}
              />
            )}
            
            {activeTab === 'alerts' && (
              <AlertManager />
            )}
            
            {activeTab === 'backtest' && (
              <BacktestRunner />
            )}
            
            {activeTab === 'greeks' && (
              <PortfolioGreeksDashboard />
            )}
          </ErrorBoundary>
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
