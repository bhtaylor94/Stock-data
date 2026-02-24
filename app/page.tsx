'use client';
import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles, BarChart2, Layers, Bell, Activity,
  CheckCircle2, AlertCircle, AlertTriangle,
  Search, ChevronDown,
} from 'lucide-react';

// New refactored components
import { StockDecisionHero } from './components/stock/StockDecisionHero';
import { StockScoreBreakdown } from './components/stock/StockScoreBreakdown';
import { ConsensusSourcesList } from './components/stock/ConsensusSourcesList';
import { ChartPatternCard } from './components/stock/ChartPatternCard';
import { OptionsDecisionHero } from './components/options/OptionsDecisionHero';
import { UnusualActivitySection } from './components/options/UnusualActivitySection';
import { OptionsSetupCard } from './components/options/OptionsSetupCard';
import { FlowSetupCard } from './components/options/FlowSetupCard';
import { EvidenceDrawer } from './components/core/EvidenceDrawer';
import { PortfolioContextAlert } from './components/portfolio/PortfolioContextAlert';
import { OrderModal } from './components/trading/OrderModal';
import { COMPANY_NAMES } from '@/lib/companyNames';

// Alerts tab
import { AlertManager } from './components/alerts/AlertManager';

// NEW: AI Suggestions Feed
import { SuggestionFeed } from './components/ai-suggestions/SuggestionFeed';

// Elite features
import { NarrativeCard } from './components/ai/NarrativeCard';
import { EarningsWidget } from './components/core/EarningsWidget';
import { OptionsChainTable } from './components/options/OptionsChainTable';
import { IVSkewChart } from './components/options/IVSkewChart';
import { PositionSizingCalc } from './components/core/PositionSizingCalc';
import { ScannerFeed } from './components/scanner/ScannerFeed';
import { SectorHeatMap } from './components/scanner/SectorHeatMap';
import { FlowTape } from './components/options/FlowTape';

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
        <CheckCircle2 size={16} />
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
        <AlertCircle size={16} />
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
            <h2 className="text-2xl font-bold text-red-400 mb-4 flex items-center gap-2"><AlertTriangle size={22} /> Something went wrong</h2>
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
        <>Track</>
      )}
    </button>
  );
}

// ============================================================
// STOCK TAB
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
        <h3 className="text-lg font-semibold text-red-400 mb-3 flex items-center gap-1.5"><AlertTriangle size={16} /> {data.error}</h3>
        {(Array.isArray(data.instructions) ? data.instructions : (data.instructions ? [String(data.instructions)] : [])).map((i: string, idx: number) => (
            <p key={idx} className="text-xs text-slate-400">• {i}</p>
          ))}
      </div>
    );
  }

  const { analysis, suggestions, chartPatterns, technicals, fundamentals, news, analysts } = data;

  return (
    <div className="space-y-4 animate-fade-in">
      <EarningsWidget ticker={ticker} />

      <NarrativeCard
        ticker={ticker}
        price={data.price || 0}
        changePercent={data.changePercent || 0}
        analysis={analysis}
        technicals={technicals}
      />

      <StockDecisionHero
        ticker={ticker}
        price={data.price || data.quote?.c || 0}
        analysis={{ ...analysis, changePercent: data.changePercent }}
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
              evidencePacket: data,
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
        onTrade={onTrade ? () => onTrade(
          ticker,
          data.price || data.quote?.c || 0,
          data.meta?.tradeDecision?.action || 'BUY',
          1
        ) : undefined}
      />

      {data.portfolioContext && (
        <PortfolioContextAlert portfolioContext={data.portfolioContext} />
      )}

      <StockScoreBreakdown analysis={analysis} />

      {data?.meta?.warnings?.technicals && (
        <div className="p-4 rounded-2xl border border-amber-500/30 bg-amber-500/5">
          <h3 className="text-sm font-semibold text-amber-300 mb-1">Limited technical data</h3>
          <p className="text-xs text-slate-300">{data.meta.warnings.technicals}</p>
          {data?.meta?.priceHistory && (
            <p className="text-[11px] text-slate-400 mt-1">
              Candles: <span className="font-mono">{data.meta.priceHistory.candles}</span> · Source: <span className="font-mono">{data.meta.priceHistory.source}</span>
            </p>
          )}
        </div>
      )}

      {(!news?.headlines || news.headlines.length === 0) && data?.meta?.warnings?.news && (
        <div className="p-4 rounded-2xl border border-amber-500/30 bg-amber-500/5">
          <h3 className="text-sm font-semibold text-amber-300 mb-1">News unavailable</h3>
          <p className="text-xs text-slate-300">{data.meta.warnings.news}</p>
          <p className="text-xs text-slate-400 mt-1">Set <span className="font-mono">FINNHUB_API_KEY</span> in Vercel and redeploy.</p>
        </div>
      )}

      {news?.headlines?.length > 0 && (
        <div className="p-4 rounded-2xl border border-slate-700/50 bg-slate-800/30">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-white">Recent News</h3>
            <button onClick={onViewEvidence} className="text-xs text-slate-300 hover:text-white underline underline-offset-2">
              View in Evidence
            </button>
          </div>
          <div className="space-y-2">
            {news.headlines.slice(0, 8).map((item: any, i: number) => (
              <div key={i} className="p-3 rounded-xl bg-slate-900/40 border border-slate-700/40">
                <div className="text-sm text-white">{item.headline || item.title || 'Headline'}</div>
                <div className="mt-1 text-xs text-slate-400 flex items-center gap-2">
                  <span>{item.source || ''}</span>
                  <span className="opacity-50">·</span>
                  <span>{(() => {
                    const dt = item.datetime;
                    if (!dt) return '';
                    if (typeof dt === 'number') return new Date(dt * 1000).toLocaleDateString();
                    const d = new Date(dt);
                    return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString();
                  })()}</span>
                  {item.url && (
                    <>
                      <span className="opacity-50">·</span>
                      <a className="underline underline-offset-2 hover:text-white" href={item.url} target="_blank" rel="noreferrer">Open</a>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <ConsensusSourcesList
        fundamentals={fundamentals}
        technicals={technicals}
        news={news}
        analysts={analysts}
        chartPatterns={chartPatterns}
      />

      <ChartPatternCard chartPatterns={chartPatterns} />

      {suggestions && suggestions.length > 0 && (
        <div className="p-4 rounded-2xl border border-slate-700/50 bg-slate-800/30">
          <h3 className="text-sm font-semibold text-white mb-3">Recommendations</h3>
          <div className="space-y-2">
            {suggestions.slice(0, 3).map((sug: any, i: number) => (
              <div key={i} className={`p-3 rounded-xl border ${
                sug.type === 'BUY' ? 'border-emerald-500/30 bg-emerald-500/5' :
                sug.type === 'SELL' ? 'border-red-500/30 bg-red-500/5' :
                'border-amber-500/30 bg-amber-500/5'
              } transition-all duration-200`}>
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
  const [selectedContractAsk, setSelectedContractAsk] = useState<number>(0);

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
        <h3 className="text-lg font-semibold text-red-400 mb-3 flex items-center gap-1.5"><AlertTriangle size={16} /> {data.error}</h3>
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

      <EarningsWidget ticker={ticker} />

      {/* Options Flow Tape */}
      <FlowTape activities={data.unusualActivity || []} />

      {/* Named Flow Setups — Phase C results */}
      {data.optionsSetups?.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-white px-1">Flow Setups</h3>
          {data.optionsSetups.slice(0, 4).map((setup: any, i: number) => (
            <FlowSetupCard
              key={i}
              setup={setup}
              onTrack={() => {
                if (!onTrack || !setup.recommendedContract) return;
                const rc = setup.recommendedContract;
                const optType = setup.recommendedStructure?.type === 'PUT' ? 'PUT' : 'CALL';
                fetch('/api/tracker', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    ticker,
                    type: optType,
                    strategy: setup.name,
                    entryPrice: rc.ask || rc.mark || 1.00,
                    confidence: setup.confluenceScore || 0,
                    reasoning: setup.criteriaHit || [],
                    evidencePacket: data,
                    optionContract: {
                      strike: rc.strike,
                      expiration: rc.expiration,
                      dte: rc.dte,
                      delta: rc.delta,
                      entryAsk: rc.ask || rc.mark || 1.00,
                      optionType: optType,
                    },
                  }),
                }).then(res => res.json()).then(result => {
                  onTrack(result.success, result.message || result.error);
                }).catch(() => {
                  onTrack(false, 'Failed to track position');
                });
              }}
            />
          ))}
        </div>
      )}

      {/* Unusual Options Activity - ALWAYS VISIBLE */}
      <UnusualActivitySection
        activities={data.unusualActivity || []}
        onTrack={(activity) => {
          if (!onTrack) return;

          const optionType = activity.type?.toUpperCase() === 'PUT' ? 'PUT' : 'CALL';
          fetch('/api/tracker', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ticker,
              type: optionType,
              strategy: `${activity.alertType ?? 'UOA'}: $${activity.strike} ${optionType} (${activity.tradeType ?? 'UOA'})`,
              entryPrice: 1.00,
              confidence: activity.uoaScore ?? activity.confidence ?? 70,
              reasoning: activity.signals || [],
              evidencePacket: data,
              optionContract: {
                strike: activity.strike,
                expiration: activity.expiration ?? 'N/A',
                dte: activity.dte,
                delta: activity.delta ?? 0.5,
                entryAsk: 1.00,
                optionType,
              },
            }),
          }).then(res => res.json()).then(result => {
            onTrack(result.success, result.message || result.error);
          }).catch(() => {
            onTrack(false, 'Failed to track position');
          });
        }}
      />
      
      {/* Trade Setups - Compact & Expandable */}
      {data.suggestions?.filter((s: any) => s.type !== 'ALERT' && s.type !== 'NO_TRADE').length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-white px-1">Trade Setups</h3>
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

      {/* Expiration selector */}
      {data.expirations?.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap pt-2">
          <span className="text-xs text-slate-500">Expiration:</span>
          {data.expirations.slice(0, 6).map((exp: string) => (
            <button
              key={exp}
              onClick={() => setSelectedExp(exp)}
              className={`text-xs px-2.5 py-0.5 rounded-md border transition-all font-mono ${
                selectedExp === exp
                  ? 'border-blue-500/50 bg-blue-500/15 text-blue-400'
                  : 'border-slate-700/40 text-slate-400 hover:text-white hover:border-slate-600'
              }`}
            >
              {exp}
            </button>
          ))}
        </div>
      )}

      {/* IV Skew Chart */}
      {data.byExpiration && selectedExp && data.byExpiration[selectedExp] && (
        <IVSkewChart
          calls={data.byExpiration[selectedExp].calls}
          puts={data.byExpiration[selectedExp].puts}
          currentPrice={data.currentPrice}
          expiration={selectedExp}
        />
      )}

      {/* Full Options Chain Table */}
      {data.byExpiration && selectedExp && data.byExpiration[selectedExp] && (
        <OptionsChainTable
          calls={data.byExpiration[selectedExp].calls}
          puts={data.byExpiration[selectedExp].puts}
          currentPrice={data.currentPrice}
          onSelectContract={(c) => setSelectedContractAsk(c.ask)}
        />
      )}

      {/* Position Sizing Calculator */}
      <PositionSizingCalc
        ticker={ticker}
        setup={data.optionsSetups?.[0]}
        contractAsk={selectedContractAsk || data.optionsSetups?.[0]?.recommendedContract?.ask}
      />
    </div>
  );
}

// ============================================================
// SCANNER TAB
// ============================================================
function ScannerTab({ onSelectTicker }: { onSelectTicker: (t: string) => void }) {
  return (
    <div className="space-y-6 animate-fade-in">
      <ScannerFeed onSelectTicker={onSelectTicker} />
      <SectorHeatMap />
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
  
  const TABS = [
    { id: 'feed',    label: 'AI Feed',  Icon: Sparkles  },
    { id: 'stock',   label: 'Stocks',   Icon: BarChart2 },
    { id: 'options', label: 'Options',  Icon: Layers    },
    { id: 'scanner', label: 'Scanner',  Icon: Activity  },
    { id: 'alerts',  label: 'Alerts',   Icon: Bell      },
  ] as const;

  const searchRef = useRef<HTMLInputElement>(null);

  const [ticker, setTicker] = useState('');
  const [showMoreTickers, setShowMoreTickers] = useState(false);
  const [activeTab, setActiveTab] = useState<'feed' | 'stock' | 'options' | 'scanner' | 'alerts'>('feed');
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
  
  // ⌘K / Ctrl+K → focus search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

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
    <div className="min-h-screen text-white">
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

      {/* ── Sticky Top Bar ──────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b backdrop-blur-xl bg-surface-1/80"
              style={{ borderColor: 'var(--border)' }}>
        <div className="max-w-6xl mx-auto px-4">
          {/* Brand + Search row */}
          <div className="flex items-center gap-4 h-14">
            {/* Logo mark */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <div className="w-7 h-7 rounded-lg bg-blue-500 flex items-center justify-center">
                <Sparkles size={14} className="text-white" />
              </div>
              <span className="font-semibold text-sm text-slate-100 hidden sm:block">AI Hedge Fund</span>
            </div>

            {/* Search */}
            <div className="flex-1 max-w-md relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
              <input
                ref={searchRef}
                type="text"
                value={ticker}
                onChange={(e) => setTicker(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Search ticker…"
                className="w-full pl-8 pr-16 py-1.5 rounded-lg text-sm bg-surface-2/60 border text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                style={{ borderColor: 'var(--border)' }}
              />
              <kbd className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-mono text-slate-500 bg-surface-3/40 border pointer-events-none"
                  style={{ borderColor: 'var(--border-subtle)' }}>
                ⌘K
              </kbd>
            </div>

            {/* Analyze button */}
            <button
              onClick={() => handleSearch()}
              disabled={!ticker}
              className="btn-primary flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Analyze
            </button>
          </div>

          {/* Tab nav row */}
          <nav className="flex gap-1 overflow-x-auto scrollbar-none -mb-px">
            {TABS.map(({ id, label, Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`nav-pill ${activeTab === id ? 'nav-pill-active' : ''}`}
              >
                <Icon size={13} />
                {label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* ── Ticker Chip Row ──────────────────────────────── */}
        <div className="mb-6">
          <div className="flex flex-wrap gap-1.5 items-center">
            {TOP_LIQUID_TICKERS.map((t) => (
              <button
                key={t}
                onClick={() => {
                  setTicker(t);
                  handleSearch(t);
                  setShowMoreTickers(false);
                }}
                className="px-2.5 py-1 rounded-md text-xs font-mono font-medium text-slate-300 bg-surface-2/60 border hover:border-slate-500 hover:text-white hover:bg-surface-2 transition-all"
                style={{ borderColor: 'var(--border)' }}
              >
                {t}
              </button>
            ))}
            <button
              onClick={() => setShowMoreTickers(!showMoreTickers)}
              className="px-2.5 py-1 rounded-md text-xs font-medium text-blue-400 bg-blue-500/10 border border-blue-500/30 hover:bg-blue-500/20 transition-all flex items-center gap-1"
            >
              {showMoreTickers ? 'Less' : 'More'}
              <ChevronDown size={11} className={`transition-transform ${showMoreTickers ? 'rotate-180' : ''}`} />
            </button>
          </div>

          {/* Industry ticker groups */}
          {showMoreTickers && (
            <div className="mt-3 space-y-3 animate-fade-in">
              {Object.entries(INDUSTRY_TICKERS).map(([industry, tickers]) => (
                <div
                  key={industry}
                  className="p-3 rounded-xl border bg-surface-1/40"
                  style={{ borderColor: 'var(--border-subtle)' }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-semibold text-blue-400">{industry}</span>
                    <span className="text-xs text-slate-600">({tickers.length})</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {tickers.map((t) => (
                      <button
                        key={`${industry}-${t}`}
                        onClick={() => {
                          setTicker(t);
                          handleSearch(t);
                          setShowMoreTickers(false);
                        }}
                        className="px-2.5 py-1 rounded-md text-xs font-mono font-medium text-slate-300 bg-surface-2/60 border hover:border-slate-500 hover:text-white hover:bg-surface-2 transition-all"
                        style={{ borderColor: 'var(--border)' }}
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
            
            {activeTab === 'scanner' && (
              <ScannerTab
                onSelectTicker={(t) => {
                  setTicker(t);
                  handleSearch(t);
                  setActiveTab('stock');
                }}
              />
            )}

            {activeTab === 'alerts' && (
              <AlertManager />
            )}
          </ErrorBoundary>
        </div>
        
        {/* Footer */}
        <div className="mt-12 pt-6 border-t text-center text-sm" style={{ borderColor: 'var(--border-subtle)' }}>
          <p className="flex items-center justify-center gap-1.5 text-slate-500">
            <AlertTriangle size={13} />
            Not financial advice · Markets are risky · Do your own research
          </p>
          <p className="mt-1 text-slate-600">Data provided by Schwab Market Data API · Real-time quotes & options chains</p>
        </div>
      </div>
    </div>
  );
}
