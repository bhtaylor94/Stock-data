'use client';
import React, { useState } from 'react';

// Mock data simulating what the API would return
const mockOptionsData = {
  ticker: "AAPL",
  currentPrice: 260.33,
  expiration: "2026-01-17",

  analysis: {
    trend: { trend: "BULLISH", changePercent: 8.5, volatility: 1.8 },
    newsSentiment: {
      sentiment: "BULLISH",
      score: 3,
      keywords: ["+surge", "+beat", "+growth", "-concern"],
      recentHeadlines: [
        "Apple Reports Record Q4 Revenue, Beats Expectations",
        "iPhone 16 Sales Surge in Holiday Quarter",
        "Apple's AI Features Drive Growth in Services",
        "Analysts Raise Price Targets After Strong Earnings",
        "Some Concern Over China Market Slowdown"
      ]
    },
    earnings: { date: "2026-01-29", daysUntil: 22, epsEstimate: 2.35 },
    analystRating: {
      consensus: "buy",
      buyPercent: "72",
      strongBuy: 18,
      buy: 12,
      hold: 8,
      sell: 2,
      strongSell: 1
    }
  },

  metrics: {
    putCallRatio: "0.85",
    totalCallVolume: 1250000,
    totalPutVolume: 1062500,
    avgIV: "28.5"
  },

  suggestions: [
    {
      type: "CALL",
      strategy: "Aggressive Call",
      strike: 265,
      expiration: "2026-01-17",
      daysToExpiration: 10,
      bid: 3.20,
      ask: 3.45,
      delta: 0.42,
      gamma: 0.045,
      theta: -0.15,
      iv: 28.2,
      maxRisk: "345.00",
      breakeven: "268.45",
      reasoning: [
        "30-day trend UP 8.5%",
        "Positive news sentiment (beat, surge)",
        "IV at 28% is moderate - options fairly priced",
        "Delta 0.42 offers good leverage"
      ],
      riskLevel: "AGGRESSIVE",
      confidence: 78
    },
    {
      type: "CALL",
      strategy: "Conservative Call",
      strike: 270,
      expiration: "2026-02-21",
      daysToExpiration: 45,
      bid: 5.80,
      ask: 6.10,
      delta: 0.32,
      gamma: 0.028,
      theta: -0.08,
      iv: 27.5,
      maxRisk: "610.00",
      breakeven: "276.10",
      reasoning: [
        "30-day uptrend supports bullish thesis",
        "Analyst consensus: 72% bullish",
        "45 DTE gives time for thesis to play out",
        "Lower theta decay (-$8/day) vs aggressive"
      ],
      riskLevel: "CONSERVATIVE",
      confidence: 72
    },
    {
      type: "PUT",
      strategy: "Aggressive Put",
      strike: 255,
      expiration: "2026-01-17",
      daysToExpiration: 10,
      bid: 2.80,
      ask: 3.05,
      delta: -0.38,
      gamma: 0.042,
      theta: -0.14,
      iv: 29.1,
      maxRisk: "305.00",
      breakeven: "251.95",
      reasoning: [
        "Hedge against potential reversal",
        "Some negative keywords in news (-concern)",
        "Earnings in 22 days - potential volatility"
      ],
      riskLevel: "AGGRESSIVE",
      confidence: 45
    },
    {
      type: "ALERT",
      strategy: "Earnings Approaching",
      reasoning: [
        "Earnings in 22 days (Jan 29)",
        "IV may increase as earnings approach",
        "Consider position sizing carefully"
      ],
      riskLevel: "WARNING",
      confidence: 0
    }
  ],

  calls: [
    { strike: 255, bid: 7.20, ask: 7.45, delta: 0.62, gamma: 0.038, theta: -0.12, volume: 15420, openInterest: 45000, impliedVolatility: 0.275 },
    { strike: 260, bid: 4.80, ask: 5.05, delta: 0.52, gamma: 0.044, theta: -0.14, volume: 28500, openInterest: 82000, impliedVolatility: 0.282 },
    { strike: 265, bid: 3.20, ask: 3.45, delta: 0.42, gamma: 0.045, theta: -0.15, volume: 42000, openInterest: 95000, impliedVolatility: 0.285 },
    { strike: 270, bid: 1.95, ask: 2.15, delta: 0.32, gamma: 0.042, theta: -0.13, volume: 35000, openInterest: 78000, impliedVolatility: 0.290 },
    { strike: 275, bid: 1.10, ask: 1.25, delta: 0.22, gamma: 0.035, theta: -0.10, volume: 22000, openInterest: 55000, impliedVolatility: 0.295 },
  ],

  puts: [
    { strike: 245, bid: 1.05, ask: 1.20, delta: -0.18, gamma: 0.028, theta: -0.08, volume: 12000, openInterest: 35000, impliedVolatility: 0.305 },
    { strike: 250, bid: 1.85, ask: 2.05, delta: -0.28, gamma: 0.038, theta: -0.11, volume: 18500, openInterest: 52000, impliedVolatility: 0.298 },
    { strike: 255, bid: 2.80, ask: 3.05, delta: -0.38, gamma: 0.042, theta: -0.14, volume: 25000, openInterest: 68000, impliedVolatility: 0.291 },
    { strike: 260, bid: 4.20, ask: 4.45, delta: -0.48, gamma: 0.044, theta: -0.15, volume: 32000, openInterest: 75000, impliedVolatility: 0.285 },
    { strike: 265, bid: 6.10, ask: 6.35, delta: -0.58, gamma: 0.040, theta: -0.13, volume: 18000, openInterest: 42000, impliedVolatility: 0.280 },
  ]
};

interface OptionContract {
  strike: number;
  bid: number;
  ask: number;
  delta: number;
  gamma: number;
  theta: number;
  volume: number;
  openInterest: number;
  impliedVolatility: number;
}

interface OptionsData {
  ticker: string;
  currentPrice: number;
  expiration: string;
  analysis: {
    trend: { trend: string; changePercent: number; volatility: number };
    newsSentiment: {
      sentiment: string;
      score: number;
      keywords: string[];
      recentHeadlines: string[];
    };
    earnings: { date: string; daysUntil: number; epsEstimate: number };
    analystRating: {
      consensus: string;
      buyPercent: string;
      strongBuy: number;
      buy: number;
      hold: number;
      sell: number;
      strongSell: number;
    };
  };
  metrics: {
    putCallRatio: string;
    totalCallVolume: number;
    totalPutVolume: number;
    avgIV: string;
  };
  suggestions: Array<{
    type: string;
    strategy: string;
    strike?: number;
    expiration?: string;
    daysToExpiration?: number;
    bid?: number;
    ask?: number;
    delta?: number;
    gamma?: number;
    theta?: number;
    iv?: number;
    maxRisk?: string;
    breakeven?: string;
    reasoning: string[];
    riskLevel: string;
    confidence: number;
  }>;
  calls: OptionContract[];
  puts: OptionContract[];
}

function OptionsTable({ options, type }: { options: OptionsData; type: 'calls' | 'puts' }) {
  const data = type === 'calls' ? options?.calls : options?.puts;
  if (!data || data.length === 0) return <p className="text-slate-500 text-sm text-center py-8">No options data</p>;

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
              <td className="py-1.5 px-2 font-mono font-medium text-white">${opt.strike}</td>
              <td className="text-right py-1.5 px-2 font-mono text-slate-300">${opt.bid?.toFixed(2)}</td>
              <td className="text-right py-1.5 px-2 font-mono text-slate-300">${opt.ask?.toFixed(2)}</td>
              <td className={`text-right py-1.5 px-2 font-mono ${opt.delta > 0 ? 'text-emerald-400' : 'text-red-400'}`}>{opt.delta?.toFixed(2)}</td>
              <td className="text-right py-1.5 px-2 font-mono text-amber-400">{opt.gamma?.toFixed(3)}</td>
              <td className="text-right py-1.5 px-2 font-mono text-red-400">{opt.theta?.toFixed(2)}</td>
              <td className="text-right py-1.5 px-2 font-mono text-slate-400">{(opt.impliedVolatility * 100).toFixed(0)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function OptionsPreview() {
  const [options] = useState<OptionsData>(mockOptionsData);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4">
      {/* Header */}
      <div className="mb-6 p-4 rounded-xl bg-slate-800/50 border border-slate-700/50">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-3xl font-bold font-mono">{options.ticker}</span>
          <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">● LIVE</span>
        </div>
        <span className="text-2xl font-bold">${options.currentPrice}</span>
      </div>

      <div className="space-y-6">
        {/* Trade Suggestions */}
        <div className="p-5 rounded-2xl border border-blue-500/30 bg-gradient-to-br from-blue-500/5 to-cyan-500/5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center text-xl">💡</div>
            <div>
              <h2 className="text-lg font-semibold text-white">Trade Suggestions</h2>
              <p className="text-xs text-slate-400">Based on trend, news, volume, Greeks & options data</p>
            </div>
          </div>
          
          <div className="grid gap-4 md:grid-cols-2">
            {options.suggestions.map((sug, i) => (
              <div 
                key={i} 
                className={`p-4 rounded-xl border ${
                  sug.type === 'ALERT' 
                    ? 'border-amber-500/30 bg-amber-500/5' 
                    : sug.type === 'CALL' 
                      ? 'border-emerald-500/30 bg-emerald-500/5' 
                      : 'border-red-500/30 bg-red-500/5'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{sug.type === 'CALL' ? '📈' : sug.type === 'PUT' ? '📉' : '⚠️'}</span>
                    <span className="font-bold text-white">{sug.strategy}</span>
                  </div>
                  {sug.riskLevel && (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      sug.riskLevel === 'AGGRESSIVE' ? 'bg-orange-500/20 text-orange-400' :
                      sug.riskLevel === 'CONSERVATIVE' ? 'bg-blue-500/20 text-blue-400' :
                      'bg-amber-500/20 text-amber-400'
                    }`}>
                      {sug.riskLevel}
                    </span>
                  )}
                </div>
                
                {sug.type !== 'ALERT' && (
                  <>
                    <div className="grid grid-cols-3 gap-2 mb-3 text-sm">
                      <div>
                        <p className="text-slate-400 text-xs">Strike</p>
                        <p className="font-mono font-bold text-white">${sug.strike}</p>
                      </div>
                      <div>
                        <p className="text-slate-400 text-xs">Exp</p>
                        <p className="font-mono font-bold text-white">{sug.daysToExpiration}d</p>
                      </div>
                      <div>
                        <p className="text-slate-400 text-xs">Ask</p>
                        <p className="font-mono font-bold text-white">${sug.ask?.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-slate-400 text-xs">Delta</p>
                        <p className={`font-mono font-bold ${(sug.delta ?? 0) > 0 ? 'text-emerald-400' : 'text-red-400'}`}>{sug.delta?.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-slate-400 text-xs">Theta</p>
                        <p className="font-mono font-bold text-red-400">{sug.theta?.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-slate-400 text-xs">Breakeven</p>
                        <p className="font-mono font-bold text-white">${sug.breakeven}</p>
                      </div>
                    </div>
                    
                    <div className="p-2 rounded-lg bg-slate-800/50 mb-3">
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-slate-400">Max Risk: </span>
                          <span className="text-white font-bold">${sug.maxRisk}</span>
                        </div>
                        <div>
                          <span className="text-slate-400">Gamma: </span>
                          <span className="text-amber-400 font-bold">{sug.gamma?.toFixed(3)}</span>
                        </div>
                      </div>
                    </div>
                  </>
                )}
                
                {sug.confidence > 0 && (
                  <div className="mb-3">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-400">Confidence</span>
                      <span className="text-white font-bold">{sug.confidence}%</span>
                    </div>
                    <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full ${sug.type === 'CALL' ? 'bg-emerald-500' : 'bg-red-500'}`} 
                        style={{ width: `${sug.confidence}%` }} 
                      />
                    </div>
                  </div>
                )}
                
                <div className="space-y-1">
                  {sug.reasoning?.map((reason, j) => (
                    <p key={j} className="text-xs text-slate-300 flex items-start gap-2">
                      <span className="text-slate-500 mt-0.5">•</span>
                      {reason}
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Analysis Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl border border-slate-700/50 bg-slate-800/30">
            <p className="text-xs text-slate-400 mb-1">30-Day Trend</p>
            <div className="text-lg font-bold text-emerald-400">
              📈 {options.analysis.trend.trend}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              +{options.analysis.trend.changePercent}%
            </p>
          </div>
          
          <div className="p-4 rounded-xl border border-slate-700/50 bg-slate-800/30">
            <p className="text-xs text-slate-400 mb-1">News Sentiment</p>
            <div className="text-lg font-bold text-emerald-400">
              😀 {options.analysis.newsSentiment.sentiment}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {options.analysis.newsSentiment.keywords.slice(0,2).join(', ')}
            </p>
          </div>
          
          <div className="p-4 rounded-xl border border-slate-700/50 bg-slate-800/30">
            <p className="text-xs text-slate-400 mb-1">Next Earnings</p>
            <div className="text-lg font-bold text-white">
              📅 {options.analysis.earnings.date}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {options.analysis.earnings.daysUntil} days away
            </p>
          </div>
          
          <div className="p-4 rounded-xl border border-slate-700/50 bg-slate-800/30">
            <p className="text-xs text-slate-400 mb-1">Analyst Consensus</p>
            <div className="text-lg font-bold text-emerald-400">
              BUY
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {options.analysis.analystRating.buyPercent}% bullish
            </p>
          </div>
        </div>
        
        {/* Recent Headlines */}
        <div className="p-4 rounded-xl border border-slate-700/50 bg-slate-800/30">
          <p className="text-xs text-slate-400 mb-2">📰 Recent Headlines</p>
          <div className="space-y-2">
            {options.analysis.newsSentiment.recentHeadlines.map((headline, i) => (
              <p key={i} className="text-sm text-slate-300 truncate">• {headline}</p>
            ))}
          </div>
        </div>
        
        {/* Options Metrics */}
        <div className="p-4 rounded-xl border border-slate-700/50 bg-slate-800/30">
          <div className="flex flex-wrap items-center gap-6">
            <div><p className="text-xs text-slate-400">Put/Call</p><p className="text-sm font-semibold text-emerald-400">{options.metrics.putCallRatio}</p></div>
            <div><p className="text-xs text-slate-400">Call Vol</p><p className="text-sm font-semibold text-emerald-400">{options.metrics.totalCallVolume.toLocaleString()}</p></div>
            <div><p className="text-xs text-slate-400">Put Vol</p><p className="text-sm font-semibold text-red-400">{options.metrics.totalPutVolume.toLocaleString()}</p></div>
            <div><p className="text-xs text-slate-400">Avg IV</p><p className="text-sm font-semibold text-amber-400">{options.metrics.avgIV}%</p></div>
          </div>
        </div>
        
        {/* Options Chain */}
        <div className="grid md:grid-cols-2 gap-6">
          <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5">
            <h3 className="text-lg font-semibold text-emerald-400 mb-4">📈 Calls</h3>
            <OptionsTable options={options} type="calls" />
          </div>
          <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/5">
            <h3 className="text-lg font-semibold text-red-400 mb-4">📉 Puts</h3>
            <OptionsTable options={options} type="puts" />
          </div>
        </div>
        
        <p className="text-xs text-center text-slate-500">
          ✓ Real-time data via Schwab API • News & earnings via Finnhub
        </p>
      </div>
    </div>
  );
}
