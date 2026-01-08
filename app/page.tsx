'use client';
import React, { useState } from 'react';

// Types
interface StockData {
  ticker: string;
  name: string;
  exchange: string;
  price: number;
  change: number;
  changePercent: number;
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
    macdLine: number;
    macdSignal: number;
    goldenCross: boolean;
    priceVsSma50: number;
    priceVsSma200: number;
  };
  analysis: {
    fundamental: { score: number; rating: string; signals: string[]; warnings: string[]; };
    technical: { score: number; rating: string; signals: string[]; warnings: string[]; };
    combined: { score: number; rating: string; };
  };
  suggestions: Array<{ type: string; strategy: string; confidence: number; reasoning: string[]; riskLevel: string; }>;
  lastUpdated: string;
  dataSource: string;
}

interface OptionsData {
  ticker: string;
  currentPrice: number;
  expiration: string;
  analysis: {
    trend: { trend: string; changePercent: number; };
    newsSentiment: { sentiment: string; recentHeadlines: string[]; };
    earnings: { date: string; daysUntil: number; };
  };
  metrics: { putCallRatio: string; totalCallVolume: number; totalPutVolume: number; avgIV: string; };
  suggestions: Array<{
    type: string; strategy: string; strike?: number; delta?: number; gamma?: number;
    theta?: number; ask?: number; maxRisk?: string; breakeven?: string;
    reasoning: string[]; riskLevel: string; confidence: number;
  }>;
  calls: Array<{ strike: number; bid: number; ask: number; delta: number; gamma: number; theta: number; volume: number; impliedVolatility: number; }>;
  puts: Array<{ strike: number; bid: number; ask: number; delta: number; gamma: number; theta: number; volume: number; impliedVolatility: number; }>;
}

// Components
function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
    </div>
  );
}

function RatingBadge({ rating }: { rating: string }) {
  const colors: Record<string, string> = {
    'STRONG_BUY': 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    'BUY': 'bg-green-500/20 text-green-400 border-green-500/30',
    'HOLD': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    'SELL': 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    'STRONG_SELL': 'bg-red-500/20 text-red-400 border-red-500/30',
  };
  const labels: Record<string, string> = {
    'STRONG_BUY': '🚀 Strong Buy', 'BUY': '📈 Buy', 'HOLD': '⏸️ Hold', 'SELL': '📉 Sell', 'STRONG_SELL': '🔻 Strong Sell',
  };
  return <span className={`px-3 py-1.5 rounded-full text-sm font-medium border ${colors[rating] || colors['HOLD']}`}>{labels[rating] || rating}</span>;
}

function ScoreGauge({ score, label }: { score: number; label: string }) {
  const color = score >= 60 ? '#10b981' : score >= 40 ? '#eab308' : '#ef4444';
  return (
    <div className="text-center">
      <div className="relative w-20 h-20 mx-auto mb-2">
        <svg className="w-20 h-20 transform -rotate-90">
          <circle cx="40" cy="40" r="36" stroke="#334155" strokeWidth="8" fill="none" />
          <circle cx="40" cy="40" r="36" stroke={color} strokeWidth="8" fill="none" strokeDasharray={`${score * 2.26} 226`} />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-xl font-bold">{score}</span>
      </div>
      <p className="text-xs text-slate-400">{label}</p>
    </div>
  );
}

function MetricCard({ label, value, suffix = '', positive }: { label: string; value: string | number; suffix?: string; positive?: boolean }) {
  return (
    <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
      <p className="text-xs text-slate-400 mb-1">{label}</p>
      <p className={`text-lg font-bold font-mono ${positive === true ? 'text-emerald-400' : positive === false ? 'text-red-400' : 'text-white'}`}>
        {value}{suffix}
      </p>
    </div>
  );
}

function OptionsTable({ data, type }: { data: OptionsData['calls'] | OptionsData['puts']; type: string }) {
  if (!data?.length) return <p className="text-slate-500 text-sm text-center py-8">No data</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-slate-400 border-b border-slate-700/50">
            <th className="text-left py-2 px-2">Strike</th>
            <th className="text-right py-2 px-2">Bid</th>
            <th className="text-right py-2 px-2">Ask</th>
            <th className="text-right py-2 px-2">Delta</th>
            <th className="text-right py-2 px-2">Gamma</th>
            <th className="text-right py-2 px-2">Theta</th>
            <th className="text-right py-2 px-2">IV</th>
          </tr>
        </thead>
        <tbody>
          {data.map((opt, i) => (
            <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-700/20">
              <td className="py-2 px-2 font-mono font-medium text-white">${opt.strike}</td>
              <td className="text-right py-2 px-2 font-mono text-slate-300">${opt.bid?.toFixed(2)}</td>
              <td className="text-right py-2 px-2 font-mono text-slate-300">${opt.ask?.toFixed(2)}</td>
              <td className={`text-right py-2 px-2 font-mono ${opt.delta > 0 ? 'text-emerald-400' : 'text-red-400'}`}>{opt.delta?.toFixed(2)}</td>
              <td className="text-right py-2 px-2 font-mono text-amber-400">{opt.gamma?.toFixed(3)}</td>
              <td className="text-right py-2 px-2 font-mono text-red-400">{opt.theta?.toFixed(2)}</td>
              <td className="text-right py-2 px-2 font-mono text-slate-400">{(opt.impliedVolatility * 100).toFixed(0)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Stock Analysis Tab
function StockTab({ data, loading }: { data: StockData | null; loading: boolean }) {
  if (loading) return <LoadingSpinner />;
  if (!data) return <p className="text-slate-500 text-center py-12">Enter a ticker symbol to analyze</p>;

  return (
    <div className="space-y-6">
      {/* Overall Rating */}
      <div className="p-5 rounded-2xl border border-slate-700/50 bg-gradient-to-br from-slate-800/50 to-slate-900/50">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Overall Analysis</h2>
            <p className="text-xs text-slate-400">Combined fundamental + technical score</p>
          </div>
          <RatingBadge rating={data.analysis.combined.rating} />
        </div>
        <div className="flex justify-around">
          <ScoreGauge score={data.analysis.fundamental.score} label="Fundamentals" />
          <ScoreGauge score={data.analysis.technical.score} label="Technicals" />
          <ScoreGauge score={data.analysis.combined.score} label="Combined" />
        </div>
      </div>

      {/* Trade Suggestions */}
      <div className="p-5 rounded-2xl border border-blue-500/30 bg-gradient-to-br from-blue-950/30 to-cyan-950/20">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">💡 Trade Suggestions</h2>
        <div className="space-y-3">
          {data.suggestions.map((sug, i) => (
            <div key={i} className={`p-4 rounded-xl border ${sug.type === 'BUY' ? 'border-emerald-500/30 bg-emerald-500/5' : sug.type === 'SELL' ? 'border-red-500/30 bg-red-500/5' : 'border-amber-500/30 bg-amber-500/5'}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-white">{sug.type === 'BUY' ? '📈' : sug.type === 'SELL' ? '📉' : '⚠️'} {sug.strategy}</span>
                {sug.confidence > 0 && <span className="text-sm text-slate-400">Confidence: <span className="text-white font-bold">{sug.confidence}%</span></span>}
              </div>
              {sug.reasoning.map((r, j) => <p key={j} className="text-xs text-slate-300">• {r}</p>)}
            </div>
          ))}
        </div>
      </div>

      {/* Fundamentals */}
      <div className="p-5 rounded-2xl border border-slate-700/50 bg-slate-800/30">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">📊 Fundamentals <RatingBadge rating={data.analysis.fundamental.rating} /></h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <MetricCard label="P/E Ratio" value={data.fundamentals.pe.toFixed(1)} positive={data.fundamentals.pe < 25} />
          <MetricCard label="P/B Ratio" value={data.fundamentals.pb.toFixed(2)} positive={data.fundamentals.pb < 3} />
          <MetricCard label="ROE" value={data.fundamentals.roe.toFixed(1)} suffix="%" positive={data.fundamentals.roe > 15} />
          <MetricCard label="Debt/Equity" value={data.fundamentals.debtEquity.toFixed(2)} positive={data.fundamentals.debtEquity < 1} />
          <MetricCard label="Profit Margin" value={data.fundamentals.profitMargin.toFixed(1)} suffix="%" positive={data.fundamentals.profitMargin > 10} />
          <MetricCard label="Rev Growth" value={data.fundamentals.revenueGrowth.toFixed(1)} suffix="%" positive={data.fundamentals.revenueGrowth > 0} />
          <MetricCard label="EPS Growth" value={data.fundamentals.epsGrowth.toFixed(1)} suffix="%" positive={data.fundamentals.epsGrowth > 0} />
          <MetricCard label="Beta" value={data.fundamentals.beta.toFixed(2)} />
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-emerald-400 font-medium mb-2">✓ Bullish Signals</p>
            {data.analysis.fundamental.signals.map((s, i) => <p key={i} className="text-xs text-slate-300">• {s}</p>)}
          </div>
          <div>
            <p className="text-xs text-red-400 font-medium mb-2">⚠ Warnings</p>
            {data.analysis.fundamental.warnings.map((w, i) => <p key={i} className="text-xs text-slate-300">• {w}</p>)}
          </div>
        </div>
      </div>

      {/* Technicals */}
      <div className="p-5 rounded-2xl border border-slate-700/50 bg-slate-800/30">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">📈 Technical Analysis <RatingBadge rating={data.analysis.technical.rating} /></h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <MetricCard label="RSI (14)" value={data.technicals.rsi.toFixed(0)} positive={data.technicals.rsi < 30 ? true : data.technicals.rsi > 70 ? false : undefined} />
          <MetricCard label="50 SMA" value={`$${data.technicals.sma50.toFixed(2)}`} positive={data.price > data.technicals.sma50} />
          <MetricCard label="200 SMA" value={`$${data.technicals.sma200.toFixed(2)}`} positive={data.price > data.technicals.sma200} />
          <MetricCard label="Golden Cross" value={data.technicals.goldenCross ? 'Active ✓' : 'Inactive'} positive={data.technicals.goldenCross} />
          <MetricCard label="MACD" value={data.technicals.macdLine.toFixed(4)} positive={data.technicals.macdLine > data.technicals.macdSignal} />
          <MetricCard label="vs 50 SMA" value={data.technicals.priceVsSma50.toFixed(1)} suffix="%" positive={data.technicals.priceVsSma50 > 0} />
          <MetricCard label="vs 200 SMA" value={data.technicals.priceVsSma200.toFixed(1)} suffix="%" positive={data.technicals.priceVsSma200 > 0} />
          <MetricCard label="52W High" value={`$${data.fundamentals.high52Week.toFixed(2)}`} />
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-emerald-400 font-medium mb-2">✓ Bullish Signals</p>
            {data.analysis.technical.signals.map((s, i) => <p key={i} className="text-xs text-slate-300">• {s}</p>)}
          </div>
          <div>
            <p className="text-xs text-red-400 font-medium mb-2">⚠ Warnings</p>
            {data.analysis.technical.warnings.map((w, i) => <p key={i} className="text-xs text-slate-300">• {w}</p>)}
          </div>
        </div>
      </div>

      <p className="text-xs text-center text-slate-500">Last updated: {new Date(data.lastUpdated).toLocaleString()} • Source: {data.dataSource}</p>
    </div>
  );
}

// Options Tab
function OptionsTab({ data, loading }: { data: OptionsData | null; loading: boolean }) {
  if (loading) return <LoadingSpinner />;
  if (!data) return <p className="text-slate-500 text-center py-12">Enter a ticker symbol to view options</p>;

  return (
    <div className="space-y-6">
      {/* Suggestions */}
      <div className="p-5 rounded-2xl border border-blue-500/30 bg-gradient-to-br from-blue-950/30 to-cyan-950/20">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">💡 Options Trade Suggestions</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {data.suggestions.map((sug, i) => (
            <div key={i} className={`p-4 rounded-xl border ${sug.type === 'ALERT' ? 'border-amber-500/30 bg-amber-500/5' : sug.type === 'CALL' ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-red-500/30 bg-red-500/5'}`}>
              <div className="flex items-center justify-between mb-3">
                <span className="font-bold text-white">{sug.type === 'CALL' ? '📈' : sug.type === 'PUT' ? '📉' : '⚠️'} {sug.strategy}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${sug.riskLevel === 'AGGRESSIVE' ? 'bg-orange-500/20 text-orange-400' : sug.riskLevel === 'CONSERVATIVE' ? 'bg-blue-500/20 text-blue-400' : 'bg-amber-500/20 text-amber-400'}`}>{sug.riskLevel}</span>
              </div>
              {sug.type !== 'ALERT' && sug.strike && (
                <div className="grid grid-cols-3 gap-2 mb-3 text-sm">
                  <div className="p-2 rounded bg-slate-800/50"><p className="text-slate-400 text-xs">Strike</p><p className="font-mono font-bold text-white">${sug.strike}</p></div>
                  <div className="p-2 rounded bg-slate-800/50"><p className="text-slate-400 text-xs">Delta</p><p className={`font-mono font-bold ${(sug.delta || 0) > 0 ? 'text-emerald-400' : 'text-red-400'}`}>{sug.delta?.toFixed(2)}</p></div>
                  <div className="p-2 rounded bg-slate-800/50"><p className="text-slate-400 text-xs">Ask</p><p className="font-mono font-bold text-white">${sug.ask?.toFixed(2)}</p></div>
                </div>
              )}
              {sug.confidence > 0 && (
                <div className="mb-3">
                  <div className="flex justify-between text-xs mb-1"><span className="text-slate-400">Confidence</span><span className="text-white font-bold">{sug.confidence}%</span></div>
                  <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden"><div className={`h-full rounded-full ${sug.type === 'CALL' ? 'bg-emerald-500' : 'bg-red-500'}`} style={{ width: `${sug.confidence}%` }} /></div>
                </div>
              )}
              {sug.reasoning.map((r, j) => <p key={j} className="text-xs text-slate-300">• {r}</p>)}
            </div>
          ))}
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-slate-700/50 bg-slate-800/30">
          <p className="text-xs text-slate-400 mb-1">Trend</p>
          <div className={`text-lg font-bold ${data.analysis.trend.trend === 'BULLISH' ? 'text-emerald-400' : 'text-red-400'}`}>{data.analysis.trend.trend === 'BULLISH' ? '📈' : '📉'} {data.analysis.trend.trend}</div>
        </div>
        <div className="p-4 rounded-xl border border-slate-700/50 bg-slate-800/30">
          <p className="text-xs text-slate-400 mb-1">Earnings</p>
          <div className="text-lg font-bold text-white">📅 {data.analysis.earnings.daysUntil}d</div>
        </div>
        <div className="p-4 rounded-xl border border-slate-700/50 bg-slate-800/30">
          <p className="text-xs text-slate-400 mb-1">Avg IV</p>
          <div className="text-lg font-bold text-amber-400">{data.metrics.avgIV}%</div>
        </div>
        <div className="p-4 rounded-xl border border-slate-700/50 bg-slate-800/30">
          <p className="text-xs text-slate-400 mb-1">Put/Call</p>
          <div className={`text-lg font-bold font-mono ${parseFloat(data.metrics.putCallRatio) < 0.7 ? 'text-emerald-400' : parseFloat(data.metrics.putCallRatio) > 1.2 ? 'text-red-400' : 'text-white'}`}>{data.metrics.putCallRatio}</div>
        </div>
      </div>

      {/* Options Chain */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5">
          <h3 className="text-lg font-semibold text-emerald-400 mb-4">📈 Calls</h3>
          <OptionsTable data={data.calls} type="calls" />
        </div>
        <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/5">
          <h3 className="text-lg font-semibold text-red-400 mb-4">📉 Puts</h3>
          <OptionsTable data={data.puts} type="puts" />
        </div>
      </div>

      <p className="text-xs text-center text-slate-500">Expiration: {data.expiration}</p>
    </div>
  );
}

// Main App
export default function Home() {
  const [ticker, setTicker] = useState('');
  const [activeTab, setActiveTab] = useState<'stocks' | 'options'>('stocks');
  const [stockData, setStockData] = useState<StockData | null>(null);
  const [optionsData, setOptionsData] = useState<OptionsData | null>(null);
  const [loadingStock, setLoadingStock] = useState(false);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [error, setError] = useState('');

  const handleSearch = async () => {
    if (!ticker.trim()) return;
    const sym = ticker.toUpperCase().trim();
    setError('');

    setLoadingStock(true);
    setLoadingOptions(true);

    try {
      const [stockRes, optionsRes] = await Promise.all([
        fetch(`/api/stock/${sym}`),
        fetch(`/api/options/${sym}`)
      ]);

      if (stockRes.ok) {
        const data = await stockRes.json();
        if (data.error) { setError(data.error); setStockData(null); }
        else setStockData(data);
      }

      if (optionsRes.ok) {
        const data = await optionsRes.json();
        setOptionsData(data);
      }
    } catch (err) {
      setError('Network error - please try again');
    }

    setLoadingStock(false);
    setLoadingOptions(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-blue-600 flex items-center justify-center"><span className="text-xl">🧠</span></div>
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-blue-400 bg-clip-text text-transparent">AI Hedge Fund</h1>
            <p className="text-xs text-slate-400">Fundamental & Technical Analysis</p>
          </div>
        </div>

        {/* Search */}
        <div className="mb-6 flex gap-3">
          <input type="text" value={ticker} onChange={(e) => setTicker(e.target.value.toUpperCase())} onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Enter ticker (AAPL, TSLA, NVDA...)" className="flex-1 px-4 py-3 rounded-xl bg-slate-800/50 border border-slate-700/50 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 font-mono" />
          <button onClick={handleSearch} disabled={loadingStock || !ticker.trim()}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-blue-600 hover:from-emerald-500 hover:to-blue-500 text-white font-medium disabled:opacity-50">
            {loadingStock ? 'Analyzing...' : 'Analyze'}
          </button>
        </div>

        {error && <div className="mb-6 p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400">{error}</div>}

        {/* Stock Header */}
        {stockData && (
          <div className="mb-6 p-5 rounded-2xl bg-gradient-to-br from-slate-800/80 to-slate-900/80 border border-slate-700/50">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-slate-700 flex items-center justify-center border border-slate-600/50">
                  <span className="text-2xl font-bold font-mono">{stockData.ticker.charAt(0)}</span>
                </div>
                <div>
                  <div className="flex items-center gap-3">
                    <span className="text-3xl font-bold font-mono">{stockData.ticker}</span>
                    <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>LIVE
                    </span>
                  </div>
                  <p className="text-slate-400 text-sm">{stockData.name} • {stockData.exchange}</p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-3xl font-bold font-mono">${stockData.price.toFixed(2)}</span>
                <p className={`text-sm font-medium ${stockData.change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {stockData.change >= 0 ? '+' : ''}{stockData.change.toFixed(2)} ({stockData.changePercent.toFixed(2)}%)
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="mb-6 flex gap-2">
          <button onClick={() => setActiveTab('stocks')} className={`px-5 py-2.5 rounded-xl font-medium ${activeTab === 'stocks' ? 'bg-gradient-to-r from-emerald-600 to-blue-600 text-white' : 'bg-slate-800/50 text-slate-400 hover:text-white border border-slate-700/50'}`}>
            📊 Stock Analysis
          </button>
          <button onClick={() => setActiveTab('options')} className={`px-5 py-2.5 rounded-xl font-medium ${activeTab === 'options' ? 'bg-gradient-to-r from-emerald-600 to-blue-600 text-white' : 'bg-slate-800/50 text-slate-400 hover:text-white border border-slate-700/50'}`}>
            📈 Options Intel
          </button>
        </div>

        {activeTab === 'stocks' && <StockTab data={stockData} loading={loadingStock} />}
        {activeTab === 'options' && <OptionsTab data={optionsData} loading={loadingOptions} />}

        <div className="mt-8 pt-6 border-t border-slate-800">
          <p className="text-xs text-center text-slate-500">⚠️ For educational purposes only. Not financial advice.</p>
        </div>
      </div>
    </div>
  );
}
