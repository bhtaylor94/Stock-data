'use client';
import React, { useState } from 'react';

// ============================================================
// TYPES
// ============================================================
interface StockData {
  ticker: string;
  name: string;
  exchange: string;
  price: number;
  change: number;
  changePercent: number;
  error?: string;
  instructions?: string[];
  fundamentals: {
    pe: number;
    pb: number;
    roe: number;
    roa: number;
    debtEquity: number;
    profitMargin: number;
    revenueGrowth: number;
    epsGrowth: number;
    high52Week: number;
    low52Week: number;
    beta: number;
  };
  technicals: {
    sma50: number;
    sma200: number;
    rsi: number;
    goldenCross: boolean;
    priceVsSma50: number;
    priceVsSma200: number;
  };
  analysis: {
    fundamental: {
      score: number;
      maxScore: number;
      rating: string;
      factors: Array<{ name: string; passed: boolean; value: string; threshold: string }>;
      signals: string[];
      warnings: string[];
    };
    technical: {
      score: number;
      maxScore: number;
      rating: string;
      factors: Array<{ name: string; passed: boolean; value: string; threshold: string }>;
      signals: string[];
      warnings: string[];
    };
    combined: { score: number; maxScore: number; rating: string };
  };
  suggestions: Array<{
    type: string;
    strategy: string;
    confidence: number;
    reasoning: string[];
    riskLevel: string;
  }>;
  lastUpdated: string;
  dataSource: string;
}

interface OptionContract {
  symbol: string;
  strike: number;
  expiration: string;
  dte: number;
  type: 'call' | 'put';
  bid: number;
  ask: number;
  last: number;
  mark: number;
  volume: number;
  openInterest: number;
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  iv: number;
  itm: boolean;
}

interface OptionsData {
  ticker: string;
  currentPrice: number;
  lastUpdated: string;
  dataSource: string;
  responseTimeMs?: number;
  error?: string;
  details?: string;
  instructions?: string[];
  expirations?: string[];
  selectedExpiration?: string;
  technicals?: {
    trend: string;
    rsi: number;
    sma20: number;
    sma50: number;
    support: number;
    resistance: number;
  };
  ivAnalysis?: {
    currentIV: number;
    ivRank: number;
    ivSignal: string;
    recommendation: string;
  };
  metrics?: {
    putCallRatio: string;
    totalCallVolume: number;
    totalPutVolume: number;
    avgIV: string;
    ivRank: string;
  };
  suggestions?: Array<{
    type: string;
    strategy: string;
    contract?: OptionContract;
    score?: { total: number; delta: number; iv: number; liquidity: number; timing: number; technical: number };
    reasoning: string[];
    warnings: string[];
    confidence: number;
    riskLevel: string;
  }>;
  optionsChain?: {
    calls: OptionContract[];
    puts: OptionContract[];
  };
}

// ============================================================
// COMPONENTS
// ============================================================
function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function ScoreBar({ score, maxScore, label }: { score: number; maxScore: number; label: string }) {
  const pct = (score / maxScore) * 100;
  const color = pct >= 70 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500';
  
  return (
    <div className="mb-2">
      <div className="flex justify-between text-xs mb-1">
        <span className="text-slate-400">{label}</span>
        <span className="text-white font-bold">{score}/{maxScore}</span>
      </div>
      <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function FactorItem({ factor }: { factor: { name: string; passed: boolean; value: string; threshold: string } }) {
  return (
    <div className={`flex items-center justify-between p-2 rounded text-xs ${factor.passed ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
      <span className={factor.passed ? 'text-emerald-400' : 'text-red-400'}>
        {factor.passed ? '✓' : '✗'} {factor.name}
      </span>
      <span className="text-slate-400 font-mono">{factor.value}</span>
    </div>
  );
}

// ============================================================
// STOCK TAB
// ============================================================
function StockTab({ data, loading }: { data: StockData | null; loading: boolean }) {
  if (loading) return <LoadingSpinner />;
  if (!data) return <p className="text-slate-500 text-center py-12">Enter a ticker symbol to analyze</p>;
  
  if (data.error) {
    return (
      <div className="p-6 rounded-2xl border border-red-500/30 bg-red-500/5">
        <h3 className="text-lg font-semibold text-red-400 mb-3">⚠️ {data.error}</h3>
        {data.instructions && (
          <div className="space-y-1">
            {data.instructions.map((i, idx) => <p key={idx} className="text-xs text-slate-400">• {i}</p>)}
          </div>
        )}
      </div>
    );
  }

  const { analysis, suggestions } = data;

  return (
    <div className="space-y-6">
      {/* Combined Score */}
      <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-800/80 to-slate-900/80 border border-slate-700/50">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Overall Score</h2>
          <span className={`text-3xl font-bold ${
            analysis.combined.score >= 14 ? 'text-emerald-400' :
            analysis.combined.score >= 11 ? 'text-blue-400' :
            analysis.combined.score >= 7 ? 'text-amber-400' : 'text-red-400'
          }`}>
            {analysis.combined.score}/{analysis.combined.maxScore}
          </span>
        </div>
        <ScoreBar score={analysis.combined.score} maxScore={analysis.combined.maxScore} label="Combined" />
        <div className="grid grid-cols-2 gap-4 mt-4">
          <ScoreBar score={analysis.fundamental.score} maxScore={analysis.fundamental.maxScore} label="Fundamental" />
          <ScoreBar score={analysis.technical.score} maxScore={analysis.technical.maxScore} label="Technical" />
        </div>
        <p className="text-center mt-4">
          <span className={`px-4 py-1 rounded-full text-sm font-medium ${
            analysis.combined.rating === 'STRONG_BUY' ? 'bg-emerald-500/20 text-emerald-400' :
            analysis.combined.rating === 'BUY' ? 'bg-blue-500/20 text-blue-400' :
            analysis.combined.rating === 'HOLD' ? 'bg-amber-500/20 text-amber-400' :
            'bg-red-500/20 text-red-400'
          }`}>
            {analysis.combined.rating.replace('_', ' ')}
          </span>
        </p>
      </div>

      {/* Suggestions */}
      <div className="p-5 rounded-2xl border border-blue-500/30 bg-gradient-to-br from-blue-950/30 to-cyan-950/20">
        <h2 className="text-lg font-semibold text-white mb-4">💡 Recommendation</h2>
        <div className="space-y-3">
          {suggestions.map((sug, i) => (
            <div key={i} className={`p-4 rounded-xl border ${
              sug.type === 'BUY' ? 'border-emerald-500/30 bg-emerald-500/5' :
              sug.type === 'SELL' ? 'border-red-500/30 bg-red-500/5' :
              sug.type === 'HOLD' ? 'border-amber-500/30 bg-amber-500/5' :
              'border-slate-500/30 bg-slate-500/5'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-white">
                  {sug.type === 'BUY' ? '📈' : sug.type === 'SELL' ? '📉' : sug.type === 'HOLD' ? '⏸️' : '⚠️'} {sug.strategy}
                </span>
                <span className="text-sm text-slate-400">Confidence: <span className="text-white font-bold">{sug.confidence}%</span></span>
              </div>
              {sug.reasoning.map((r, j) => <p key={j} className="text-xs text-slate-300">• {r}</p>)}
            </div>
          ))}
        </div>
      </div>

      {/* Factor Details */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Fundamental Factors */}
        <div className="p-5 rounded-2xl border border-slate-700/50 bg-slate-800/30">
          <h3 className="text-md font-semibold text-white mb-3 flex items-center gap-2">
            📊 Fundamental Factors
            <span className={`text-xs px-2 py-0.5 rounded ${
              analysis.fundamental.rating === 'STRONG' ? 'bg-emerald-500/20 text-emerald-400' :
              analysis.fundamental.rating === 'GOOD' ? 'bg-blue-500/20 text-blue-400' :
              analysis.fundamental.rating === 'FAIR' ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400'
            }`}>{analysis.fundamental.rating}</span>
          </h3>
          <div className="space-y-1.5">
            {analysis.fundamental.factors?.map((f, i) => <FactorItem key={i} factor={f} />)}
          </div>
        </div>

        {/* Technical Factors */}
        <div className="p-5 rounded-2xl border border-slate-700/50 bg-slate-800/30">
          <h3 className="text-md font-semibold text-white mb-3 flex items-center gap-2">
            📈 Technical Factors
            <span className={`text-xs px-2 py-0.5 rounded ${
              analysis.technical.rating === 'STRONG_BUY' ? 'bg-emerald-500/20 text-emerald-400' :
              analysis.technical.rating === 'BUY' ? 'bg-blue-500/20 text-blue-400' :
              analysis.technical.rating === 'HOLD' ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400'
            }`}>{analysis.technical.rating.replace('_', ' ')}</span>
          </h3>
          <div className="space-y-1.5">
            {analysis.technical.factors?.map((f, i) => <FactorItem key={i} factor={f} />)}
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="p-4 rounded-xl border border-slate-700/50 bg-slate-800/30">
        <div className="grid grid-cols-4 md:grid-cols-8 gap-4 text-center">
          <div><p className="text-xs text-slate-400">P/E</p><p className="font-bold text-white">{data.fundamentals.pe.toFixed(1)}</p></div>
          <div><p className="text-xs text-slate-400">ROE</p><p className="font-bold text-white">{data.fundamentals.roe.toFixed(1)}%</p></div>
          <div><p className="text-xs text-slate-400">D/E</p><p className="font-bold text-white">{data.fundamentals.debtEquity.toFixed(2)}</p></div>
          <div><p className="text-xs text-slate-400">Margin</p><p className="font-bold text-white">{data.fundamentals.profitMargin.toFixed(1)}%</p></div>
          <div><p className="text-xs text-slate-400">RSI</p><p className="font-bold text-white">{data.technicals.rsi.toFixed(0)}</p></div>
          <div><p className="text-xs text-slate-400">vs 50SMA</p><p className={`font-bold ${data.technicals.priceVsSma50 >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{data.technicals.priceVsSma50.toFixed(1)}%</p></div>
          <div><p className="text-xs text-slate-400">vs 200SMA</p><p className={`font-bold ${data.technicals.priceVsSma200 >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{data.technicals.priceVsSma200.toFixed(1)}%</p></div>
          <div><p className="text-xs text-slate-400">Beta</p><p className="font-bold text-white">{data.fundamentals.beta.toFixed(2)}</p></div>
        </div>
      </div>

      <p className="text-xs text-center text-slate-500">
        Updated: {new Date(data.lastUpdated).toLocaleString()} • Source: {data.dataSource}
      </p>
    </div>
  );
}

// ============================================================
// OPTIONS TAB - Robinhood Style Chain
// ============================================================
function OptionsTab({ data, loading }: { data: OptionsData | null; loading: boolean }) {
  const [showCalls, setShowCalls] = useState(true);
  
  if (loading) return <LoadingSpinner />;
  if (!data) return <p className="text-slate-500 text-center py-12">Enter a ticker symbol to view options</p>;

  if (data.error) {
    return (
      <div className="p-6 rounded-2xl border border-red-500/30 bg-red-500/5">
        <h3 className="text-lg font-semibold text-red-400 mb-3">⚠️ {data.error}</h3>
        {data.details && <p className="text-sm text-red-300 mb-3">{data.details}</p>}
        {data.instructions && (
          <div className="space-y-1 p-4 bg-slate-800/50 rounded-xl">
            <p className="text-sm text-slate-300 font-medium mb-2">Setup Required:</p>
            {data.instructions.map((i, idx) => <p key={idx} className="text-xs text-slate-400">• {i}</p>)}
          </div>
        )}
      </div>
    );
  }

  const calls = data.optionsChain?.calls || [];
  const puts = data.optionsChain?.puts || [];
  const options = showCalls ? calls : puts;

  return (
    <div className="space-y-6">
      {/* Live Data Banner */}
      <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-sm text-emerald-400 font-medium">LIVE DATA - Schwab Market Data</span>
        </div>
        <span className="text-xs text-slate-400">
          {data.responseTimeMs}ms • {new Date(data.lastUpdated).toLocaleTimeString()}
        </span>
      </div>

      {/* Trade Suggestions */}
      {data.suggestions && data.suggestions.length > 0 && (
        <div className="p-5 rounded-2xl border border-blue-500/30 bg-gradient-to-br from-blue-950/30 to-cyan-950/20">
          <h2 className="text-lg font-semibold text-white mb-4">💡 Trade Setups (Score-Based)</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {data.suggestions.map((sug, i) => (
              <div key={i} className={`p-4 rounded-xl border ${
                sug.type === 'CALL' ? 'border-emerald-500/30 bg-emerald-500/5' :
                sug.type === 'PUT' ? 'border-red-500/30 bg-red-500/5' :
                'border-amber-500/30 bg-amber-500/5'
              }`}>
                <div className="flex items-center justify-between mb-3">
                  <span className="font-bold text-white">
                    {sug.type === 'CALL' ? '📈' : sug.type === 'PUT' ? '📉' : '⚠️'} {sug.strategy}
                  </span>
                  {sug.score && (
                    <span className={`text-sm font-bold ${sug.score.total >= 7 ? 'text-emerald-400' : sug.score.total >= 5 ? 'text-amber-400' : 'text-red-400'}`}>
                      {sug.score.total}/10
                    </span>
                  )}
                </div>
                
                {sug.contract && (
                  <div className="grid grid-cols-4 gap-2 mb-3 text-xs">
                    <div className="p-2 rounded bg-slate-800/50">
                      <p className="text-slate-400">Strike</p>
                      <p className="font-mono font-bold text-white">${sug.contract.strike}</p>
                    </div>
                    <div className="p-2 rounded bg-slate-800/50">
                      <p className="text-slate-400">Delta</p>
                      <p className={`font-mono font-bold ${sug.contract.delta > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {sug.contract.delta.toFixed(2)}
                      </p>
                    </div>
                    <div className="p-2 rounded bg-slate-800/50">
                      <p className="text-slate-400">DTE</p>
                      <p className="font-mono font-bold text-white">{sug.contract.dte}d</p>
                    </div>
                    <div className="p-2 rounded bg-slate-800/50">
                      <p className="text-slate-400">Ask</p>
                      <p className="font-mono font-bold text-white">${sug.contract.ask.toFixed(2)}</p>
                    </div>
                  </div>
                )}

                {sug.score && (
                  <div className="flex gap-1 mb-3">
                    <span className={`px-1.5 py-0.5 rounded text-xs ${sug.score.delta >= 1 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-400'}`}>Δ{sug.score.delta}</span>
                    <span className={`px-1.5 py-0.5 rounded text-xs ${sug.score.iv >= 1 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-400'}`}>IV{sug.score.iv}</span>
                    <span className={`px-1.5 py-0.5 rounded text-xs ${sug.score.liquidity >= 1 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-400'}`}>Liq{sug.score.liquidity}</span>
                    <span className={`px-1.5 py-0.5 rounded text-xs ${sug.score.timing >= 1 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-400'}`}>Time{sug.score.timing}</span>
                    <span className={`px-1.5 py-0.5 rounded text-xs ${sug.score.technical >= 1 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-400'}`}>Tech{sug.score.technical}</span>
                  </div>
                )}

                <div className="space-y-1">
                  {sug.reasoning.slice(0, 4).map((r, j) => <p key={j} className="text-xs text-slate-300">• {r}</p>)}
                </div>
                {sug.warnings.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {sug.warnings.map((w, j) => <p key={j} className="text-xs text-amber-400">⚠️ {w}</p>)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Market Context */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="p-3 rounded-xl border border-slate-700/50 bg-slate-800/30 text-center">
          <p className="text-xs text-slate-400">Trend</p>
          <p className={`text-lg font-bold ${data.technicals?.trend === 'BULLISH' ? 'text-emerald-400' : data.technicals?.trend === 'BEARISH' ? 'text-red-400' : 'text-slate-300'}`}>
            {data.technicals?.trend || 'N/A'}
          </p>
        </div>
        <div className="p-3 rounded-xl border border-slate-700/50 bg-slate-800/30 text-center">
          <p className="text-xs text-slate-400">RSI</p>
          <p className="text-lg font-bold text-white">{data.technicals?.rsi || 50}</p>
        </div>
        <div className="p-3 rounded-xl border border-slate-700/50 bg-slate-800/30 text-center">
          <p className="text-xs text-slate-400">IV Rank</p>
          <p className={`text-lg font-bold ${(data.ivAnalysis?.ivRank || 50) > 70 ? 'text-red-400' : (data.ivAnalysis?.ivRank || 50) < 30 ? 'text-emerald-400' : 'text-amber-400'}`}>
            {data.ivAnalysis?.ivRank || 50}%
          </p>
        </div>
        <div className="p-3 rounded-xl border border-slate-700/50 bg-slate-800/30 text-center">
          <p className="text-xs text-slate-400">Avg IV</p>
          <p className="text-lg font-bold text-white">{data.metrics?.avgIV || '30'}%</p>
        </div>
        <div className="p-3 rounded-xl border border-slate-700/50 bg-slate-800/30 text-center">
          <p className="text-xs text-slate-400">P/C Ratio</p>
          <p className={`text-lg font-bold font-mono ${parseFloat(data.metrics?.putCallRatio || '1') < 0.7 ? 'text-emerald-400' : parseFloat(data.metrics?.putCallRatio || '1') > 1.2 ? 'text-red-400' : 'text-white'}`}>
            {data.metrics?.putCallRatio || '1.00'}
          </p>
        </div>
      </div>

      {/* Options Chain Toggle */}
      <div className="flex items-center justify-center gap-2 p-2 bg-slate-800/50 rounded-xl">
        <button
          onClick={() => setShowCalls(true)}
          className={`flex-1 py-2 rounded-lg font-medium transition ${showCalls ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-400 hover:text-white'}`}
        >
          📈 CALLS ({calls.length})
        </button>
        <button
          onClick={() => setShowCalls(false)}
          className={`flex-1 py-2 rounded-lg font-medium transition ${!showCalls ? 'bg-red-500/20 text-red-400' : 'text-slate-400 hover:text-white'}`}
        >
          📉 PUTS ({puts.length})
        </button>
      </div>

      {/* Robinhood-Style Options Chain */}
      <div className={`rounded-2xl border ${showCalls ? 'border-emerald-500/30' : 'border-red-500/30'} overflow-hidden`}>
        <div className={`p-3 ${showCalls ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-white">
              {data.selectedExpiration} • {options.length} contracts
            </span>
            <span className="text-slate-400">
              ${data.currentPrice?.toFixed(2)} underlying
            </span>
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
              </tr>
            </thead>
            <tbody>
              {options.map((opt, i) => (
                <tr 
                  key={i} 
                  className={`border-t border-slate-800/50 hover:bg-slate-700/20 ${opt.itm ? (showCalls ? 'bg-emerald-500/5' : 'bg-red-500/5') : ''}`}
                >
                  <td className="py-2 px-3">
                    <span className={`font-mono font-bold ${opt.itm ? 'text-white' : 'text-slate-300'}`}>
                      ${opt.strike}
                    </span>
                    {opt.itm && <span className="ml-1 text-xs text-slate-400">ITM</span>}
                  </td>
                  <td className="text-right py-2 px-3 font-mono text-slate-300">${opt.bid.toFixed(2)}</td>
                  <td className="text-right py-2 px-3 font-mono text-slate-300">${opt.ask.toFixed(2)}</td>
                  <td className="text-right py-2 px-3 font-mono text-white">${opt.last.toFixed(2)}</td>
                  <td className={`text-right py-2 px-3 font-mono ${opt.delta > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {opt.delta.toFixed(2)}
                  </td>
                  <td className="text-right py-2 px-3 font-mono text-amber-400">{(opt.iv * 100).toFixed(0)}%</td>
                  <td className="text-right py-2 px-3 font-mono text-slate-400">{opt.volume.toLocaleString()}</td>
                  <td className="text-right py-2 px-3 font-mono text-slate-400">{opt.openInterest.toLocaleString()}</td>
                </tr>
              ))}
              {options.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-slate-500">No options available</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-center text-slate-500">
        Expiration: {data.selectedExpiration} • Source: {data.dataSource}
      </p>
    </div>
  );
}

// ============================================================
// MAIN APP
// ============================================================
export default function Home() {
  const [ticker, setTicker] = useState('');
  const [searchedTicker, setSearchedTicker] = useState('');
  const [activeTab, setActiveTab] = useState<'stocks' | 'options'>('stocks');
  const [stockData, setStockData] = useState<StockData | null>(null);
  const [optionsData, setOptionsData] = useState<OptionsData | null>(null);
  const [loadingStock, setLoadingStock] = useState(false);
  const [loadingOptions, setLoadingOptions] = useState(false);

  const handleSearch = async () => {
    if (!ticker.trim()) return;
    const sym = ticker.toUpperCase().trim();
    setSearchedTicker(sym);

    setLoadingStock(true);
    setLoadingOptions(true);

    try {
      const [stockRes, optionsRes] = await Promise.all([
        fetch(`/api/stock/${sym}`),
        fetch(`/api/options/${sym}`)
      ]);

      if (stockRes.ok) setStockData(await stockRes.json());
      if (optionsRes.ok) setOptionsData(await optionsRes.json());
    } catch (err) {
      console.error('Fetch error:', err);
    }

    setLoadingStock(false);
    setLoadingOptions(false);
  };

  const handleRefresh = async () => {
    if (!searchedTicker) return;
    
    if (activeTab === 'stocks') {
      setLoadingStock(true);
      try {
        const res = await fetch(`/api/stock/${searchedTicker}`);
        if (res.ok) setStockData(await res.json());
      } catch {}
      setLoadingStock(false);
    } else {
      setLoadingOptions(true);
      try {
        const res = await fetch(`/api/options/${searchedTicker}`);
        if (res.ok) setOptionsData(await res.json());
      } catch {}
      setLoadingOptions(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-blue-600 flex items-center justify-center">
            <span className="text-xl">🧠</span>
          </div>
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-blue-400 bg-clip-text text-transparent">
              AI Hedge Fund
            </h1>
            <p className="text-xs text-slate-400">Deterministic Analysis • No Randomness</p>
          </div>
        </div>

        {/* Search */}
        <div className="mb-6 flex gap-3">
          <input 
            type="text" 
            value={ticker} 
            onChange={(e) => setTicker(e.target.value.toUpperCase())} 
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Enter ticker (AAPL, TSLA, NVDA...)" 
            className="flex-1 px-4 py-3 rounded-xl bg-slate-800/50 border border-slate-700/50 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 font-mono" 
          />
          <button 
            onClick={handleSearch} 
            disabled={loadingStock || !ticker.trim()}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-blue-600 hover:from-emerald-500 hover:to-blue-500 text-white font-medium disabled:opacity-50"
          >
            {loadingStock ? 'Analyzing...' : 'Analyze'}
          </button>
        </div>

        {/* Stock Header */}
        {stockData && !stockData.error && (
          <div className="mb-6 p-5 rounded-2xl bg-gradient-to-br from-slate-800/80 to-slate-900/80 border border-slate-700/50">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-slate-700 flex items-center justify-center border border-slate-600/50">
                  <span className="text-2xl font-bold font-mono">{stockData.ticker.charAt(0)}</span>
                </div>
                <div>
                  <div className="flex items-center gap-3">
                    <span className="text-3xl font-bold font-mono">{stockData.ticker}</span>
                    <span className={`text-xs px-2.5 py-1 rounded-full flex items-center gap-1.5 ${
                      stockData.dataSource === 'schwab' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                      stockData.dataSource === 'finnhub' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                      'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${stockData.dataSource === 'schwab' ? 'bg-emerald-400' : stockData.dataSource === 'finnhub' ? 'bg-blue-400' : 'bg-amber-400'} animate-pulse`}></span>
                      {stockData.dataSource.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-slate-400 text-sm">{stockData.name} • {stockData.exchange}</p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-3xl font-bold font-mono">${stockData.price.toFixed(2)}</span>
                <p className={`text-sm font-medium ${stockData.change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {stockData.change >= 0 ? '+' : ''}{stockData.change.toFixed(2)} ({stockData.changePercent >= 0 ? '+' : ''}{stockData.changePercent.toFixed(2)}%)
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('stocks')}
              className={`px-5 py-2.5 rounded-xl font-medium transition ${
                activeTab === 'stocks' 
                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' 
                  : 'text-slate-400 hover:text-white bg-slate-800/30 border border-transparent'
              }`}
            >
              📊 Stock Analysis
            </button>
            <button
              onClick={() => setActiveTab('options')}
              className={`px-5 py-2.5 rounded-xl font-medium transition ${
                activeTab === 'options' 
                  ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' 
                  : 'text-slate-400 hover:text-white bg-slate-800/30 border border-transparent'
              }`}
            >
              📈 Options Chain
            </button>
          </div>
          
          {searchedTicker && (
            <button
              onClick={handleRefresh}
              disabled={loadingStock || loadingOptions}
              className="px-4 py-2 rounded-xl bg-slate-800/50 border border-slate-700/50 text-slate-300 hover:text-white hover:bg-slate-700/50 text-sm font-medium transition flex items-center gap-2 disabled:opacity-50"
            >
              <span className={loadingStock || loadingOptions ? 'animate-spin' : ''}>🔄</span>
              Refresh
            </button>
          )}
        </div>

        {/* Content */}
        {activeTab === 'stocks' && <StockTab data={stockData} loading={loadingStock} />}
        {activeTab === 'options' && <OptionsTab data={optionsData} loading={loadingOptions} />}

        {/* Footer */}
        <div className="mt-8 p-4 rounded-xl bg-slate-800/20 border border-slate-700/30">
          <p className="text-xs text-slate-500 text-center">
            ⚠️ Educational purposes only. Not financial advice. Scores are deterministic and reproducible with same input data.
          </p>
        </div>
      </div>
    </div>
  );
}
