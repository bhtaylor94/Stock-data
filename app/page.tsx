'use client';

import { useState } from 'react';

const INVESTOR_AGENTS = [
  { id: 'damodaran', name: 'Aswath Damodaran', title: 'The Dean of Valuation', philosophy: 'Story + Numbers + Discipline', color: '#3B82F6', avatar: '📊' },
  { id: 'graham', name: 'Ben Graham', title: 'The Godfather of Value', philosophy: 'Margin of Safety', color: '#059669', avatar: '📚' },
  { id: 'ackman', name: 'Bill Ackman', title: 'The Activist', philosophy: 'Bold Positions & Change', color: '#DC2626', avatar: '⚔️' },
  { id: 'wood', name: 'Cathie Wood', title: 'Queen of Growth', philosophy: 'Innovation & Disruption', color: '#7C3AED', avatar: '🚀' },
  { id: 'munger', name: 'Charlie Munger', title: 'The Partner', philosophy: 'Wonderful at Fair Price', color: '#0891B2', avatar: '🧠' },
  { id: 'burry', name: 'Michael Burry', title: 'The Contrarian', philosophy: 'Deep Value Hunting', color: '#B91C1C', avatar: '🔍' },
  { id: 'pabrai', name: 'Mohnish Pabrai', title: 'Dhandho Investor', philosophy: 'Low Risk Doubles', color: '#CA8A04', avatar: '🎯' },
  { id: 'lynch', name: 'Peter Lynch', title: 'The Practitioner', philosophy: 'Ten-Baggers Everywhere', color: '#16A34A', avatar: '🏪' },
  { id: 'fisher', name: 'Phil Fisher', title: 'The Researcher', philosophy: 'Scuttlebutt Method', color: '#4F46E5', avatar: '🔬' },
  { id: 'jhunjhunwala', name: 'Rakesh Jhunjhunwala', title: 'The Big Bull', philosophy: 'India Growth Story', color: '#EA580C', avatar: '🐂' },
  { id: 'druckenmiller', name: 'Stanley Druckenmiller', title: 'Macro Legend', philosophy: 'Asymmetric Opportunities', color: '#0D9488', avatar: '🌍' },
  { id: 'buffett', name: 'Warren Buffett', title: 'Oracle of Omaha', philosophy: 'Wonderful Companies', color: '#1D4ED8', avatar: '🏛️' },
];

const ANALYSIS_AGENTS = [
  { id: 'valuation', name: 'Valuation Agent', description: 'Intrinsic Value Calculation', color: '#10B981' },
  { id: 'sentiment', name: 'Sentiment Agent', description: 'Market Sentiment Analysis', color: '#F59E0B' },
  { id: 'fundamentals', name: 'Fundamentals Agent', description: 'Fundamental Data Analysis', color: '#6366F1' },
  { id: 'technicals', name: 'Technicals Agent', description: 'Technical Indicators', color: '#EC4899' },
];

const POPULAR_TICKERS = ['AAPL', 'NVDA', 'MSFT', 'GOOGL', 'TSLA', 'META', 'AMZN', 'AMD', 'SPY', 'QQQ'];

const fmt = (val: any, decimals = 2, fallback = 'N/A'): string => {
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (num === null || num === undefined || isNaN(num)) return fallback;
  return num.toFixed(decimals);
};

function analyzeAgent(agent: typeof INVESTOR_AGENTS[0], stock: any, options: any) {
  const { pe = 25, beta = 1, targetPrice = 0, priceToBook: pb = 0, debtToEquity: de = 0, profitMargin: margin = 0, revenueGrowth: growth = 0, roe = 0, price = 0 } = stock || {};
  const iv = options?.metrics?.avgIV || 25;
  const pcr = parseFloat(options?.metrics?.putCallRatio) || 1;
  
  const sig = (b: number, bear: number) => { 
    const x = b - bear; 
    return x >= 3 ? 'STRONG_BUY' : x >= 1 ? 'BUY' : x <= -3 ? 'STRONG_SELL' : x <= -1 ? 'SELL' : 'HOLD'; 
  };
  
  let signal: string, conf: number, reason: string;
  
  switch (agent.id) {
    case 'damodaran': { 
      const b = (pe > 0 && pe < 25 ? 1 : 0) + (targetPrice && targetPrice > price ? 2 : 0);
      const bear = (pe > 40 ? 2 : 0) + (beta > 1.5 ? 1 : 0); 
      signal = sig(b, bear); 
      conf = Math.min(90, 60 + Math.abs(b - bear) * 10); 
      reason = `DCF fair value ~$${fmt(targetPrice || price * 1.1)}. P/E ${fmt(pe, 1)} ${pe < 25 ? 'reasonable' : pe > 40 ? 'growth premium' : 'fair'}. Beta ${fmt(beta)} ${beta > 1.5 ? 'high risk' : 'acceptable'}.`; 
      break; 
    }
    case 'graham': { 
      const b = (pe > 0 && pe < 15 ? 2 : pe < 20 ? 1 : 0) + (pb && pb < 1.5 ? 2 : pb < 3 ? 1 : 0) + (de && de < 50 ? 1 : 0);
      const bear = (pe > 30 ? 2 : 0) + (pb > 10 ? 2 : 0) + (de > 100 ? 1 : 0); 
      signal = sig(b, bear); 
      conf = Math.min(90, 55 + Math.abs(b - bear) * 10); 
      reason = `P/E ${fmt(pe, 1)} ${pe < 15 ? 'meets' : 'exceeds'} 15x threshold. P/B ${fmt(pb, 1)}. D/E ${fmt(de, 0)}%. ${pe > 30 && pb > 10 ? 'No margin of safety' : 'Some value present'}.`; 
      break; 
    }
    case 'ackman': { 
      const upside = targetPrice && price ? ((targetPrice / price - 1) * 100) : 0; 
      const b = (upside > 20 ? 2 : upside > 10 ? 1 : 0) + (margin && margin < 0.15 ? 1 : 0);
      const bear = (margin > 0.35 ? 1 : 0); 
      signal = sig(b + 1, bear); 
      conf = Math.min(85, 62 + Math.abs(b - bear) * 8); 
      reason = `Target upside ${fmt(upside, 0)}%. ${margin && margin < 0.15 ? 'Margin expansion opportunity!' : 'Margins already optimized'}. ${upside > 15 ? 'Activist opportunity' : 'Limited catalyst'}.`; 
      break; 
    }
    case 'wood': { 
      const b = (growth && growth > 0.20 ? 3 : growth > 0.10 ? 2 : growth > 0 ? 1 : 0) + (beta > 1.3 ? 1 : 0);
      const bear = (growth && growth < 0 ? 2 : 0) + (pe > 150 ? 1 : 0); 
      signal = sig(b, bear); 
      conf = Math.min(90, 55 + Math.abs(b - bear) * 10); 
      reason = `Revenue growth ${growth ? fmt(growth * 100, 0) + '%' : 'N/A'} ${growth > 0.15 ? '🔥 DISRUPTION confirmed!' : growth > 0 ? 'growing' : 'concerning'}. Innovation score: ${Math.floor(55 + (growth || 0) * 200)}/100.`; 
      break; 
    }
    case 'munger': { 
      const b = (roe && roe > 0.20 ? 2 : roe > 0.15 ? 1 : 0) + (margin && margin > 0.20 ? 1 : 0) + (de && de < 50 ? 1 : 0);
      const bear = (roe && roe < 0.10 ? 1 : 0) + (pe > 45 ? 1 : 0); 
      signal = sig(b, bear); 
      conf = Math.min(88, 60 + Math.abs(b - bear) * 10); 
      reason = `ROE ${roe ? fmt(roe * 100, 0) + '%' : 'N/A'} ${roe > 0.20 ? '- wonderful business!' : roe > 0.15 ? '- quality' : '- below threshold'}. ${roe > 0.25 && de < 50 ? 'Would hold forever' : 'Not a permanent holding'}.`; 
      break; 
    }
    case 'burry': { 
      const b = (pb && pb < 2 ? 3 : pb < 5 ? 1 : 0) + (pe && pe < 15 ? 2 : pe < 20 ? 1 : 0) + (pcr > 1.5 ? 1 : 0);
      const bear = (pe > 50 ? 2 : 0) + (pb > 20 ? 2 : 0); 
      signal = sig(b, bear); 
      conf = Math.min(85, 55 + Math.abs(b - bear) * 10); 
      reason = `${pb && pb < 3 ? '🔍 Deep value detected!' : 'No obvious mispricing'}. P/B ${fmt(pb, 1)}. P/C ratio ${fmt(pcr)} ${pcr > 1.3 ? '- contrarian signal!' : ''}.`; 
      break; 
    }
    case 'pabrai': { 
      const upside = targetPrice && price ? (targetPrice / price - 1) * 100 : 0; 
      const b = (upside > 30 ? 2 : upside > 15 ? 1 : 0) + (beta < 1.2 ? 1 : 0) + (de && de < 40 ? 1 : 0);
      const bear = (beta > 1.8 ? 1 : 0) + (de > 100 ? 1 : 0); 
      signal = sig(b, bear); 
      conf = Math.min(87, 58 + Math.abs(b - bear) * 10); 
      reason = `Dhandho: Risk ${fmt(beta * 2.5, 1)}/10, Reward ${fmt(Math.min(10, upside / 4), 1)}/10. ${upside > 25 && beta < 1.3 ? '✨ Heads I win!' : 'Risk/reward unfavorable'}. Upside: ${fmt(upside, 0)}%.`; 
      break; 
    }
    case 'lynch': { 
      const peg = pe && growth ? pe / Math.max(growth * 100, 1) : null; 
      const cat = growth > 0.20 ? 'Fast Grower 🚀' : growth > 0.10 ? 'Stalwart' : growth > 0 ? 'Slow Grower' : 'Turnaround'; 
      const b = (peg && peg < 1 ? 2 : peg && peg < 2 ? 1 : 0) + (cat.includes('Fast') ? 2 : 0);
      const bear = (peg && peg > 3 ? 2 : 0); 
      signal = sig(b, bear); 
      conf = Math.min(85, 60 + Math.abs(b - bear) * 10); 
      reason = `Category: ${cat}. PEG: ${peg ? fmt(peg) : 'N/A'} ${peg && peg < 1 ? '(undervalued! 🎯)' : peg && peg < 2 ? '(fair)' : '(expensive)'}.`; 
      break; 
    }
    case 'fisher': { 
      const b = (growth && growth > 0.10 ? 1 : 0) + (margin && margin > 0.15 ? 1 : 0) + (roe && roe > 0.15 ? 1 : 0);
      const bear = (growth && growth < 0 ? 1 : 0) + (margin && margin < 0.05 ? 1 : 0); 
      signal = sig(b, bear); 
      conf = Math.min(82, 55 + Math.abs(b - bear) * 12); 
      reason = `Scuttlebutt score: ${Math.floor(60 + b * 12)}/100. Management quality: ${roe && roe > 0.20 ? 'Exceptional' : roe > 0.12 ? 'Good' : 'Adequate'}.`; 
      break; 
    }
    case 'jhunjhunwala': { 
      const b = (growth && growth > 0.15 ? 2 : growth > 0.08 ? 1 : 0) + (pe < 30 ? 1 : 0) + (beta > 1 ? 1 : 0);
      const bear = (growth && growth < 0 ? 2 : 0) + (pe > 60 ? 1 : 0); 
      signal = sig(b, bear); 
      conf = Math.min(88, 60 + Math.abs(b - bear) * 10); 
      reason = `Growth: ${growth ? fmt(growth * 100, 0) + '%' : 'N/A'} YoY. ${growth > 0.15 ? '🐂 Big Bull says ACCUMULATE!' : 'Patience required'}. Conviction: ${conf}%.`; 
      break; 
    }
    case 'druckenmiller': { 
      const asym = targetPrice && price ? targetPrice / price : 1; 
      const b = (asym > 1.25 ? 2 : asym > 1.10 ? 1 : 0) + (iv < 30 ? 1 : 0);
      const bear = (asym < 0.95 ? 2 : 0) + (iv > 60 ? 1 : 0); 
      signal = sig(b, bear); 
      conf = Math.min(86, 58 + Math.abs(b - bear) * 12); 
      reason = `Asymmetry: ${fmt(asym)}:1. IV ${fmt(iv, 0)}% ${iv < 30 ? '- options CHEAP!' : iv > 50 ? '- expensive' : ''}. ${asym > 1.25 ? '🎯 Sizing UP!' : 'Limited edge'}.`; 
      break; 
    }
    case 'buffett': { 
      const b = (roe && roe > 0.20 ? 2 : roe > 0.15 ? 1 : 0) + (de && de < 50 ? 1 : 0) + (margin && margin > 0.20 ? 1 : 0) + (pe < 25 ? 1 : 0);
      const bear = (roe && roe < 0.10 ? 1 : 0) + (de > 100 ? 1 : 0) + (pe > 40 ? 1 : 0); 
      signal = sig(b, bear); 
      conf = Math.min(90, 60 + Math.abs(b - bear) * 8); 
      const moat = roe > 0.25 && margin > 0.25 ? 'WIDE 🏰' : roe > 0.15 ? 'Moderate' : 'Narrow'; 
      reason = `Economic moat: ${moat}. ROE ${roe ? fmt(roe * 100, 0) + '%' : 'N/A'}. ${roe > 0.20 && de < 50 && pe < 30 ? '💎 Would buy the WHOLE company!' : 'Pass at this price'}.`; 
      break; 
    }
    default: 
      signal = 'HOLD'; 
      conf = 50; 
      reason = 'Analysis complete.';
  }
  
  return { id: agent.id, signal, conf, reason };
}

function calcRisk(stock: any, options: any, results: any[]) {
  const buys = results.filter(r => r.signal.includes('BUY')).length;
  const sells = results.filter(r => r.signal.includes('SELL')).length;
  const avg = results.reduce((sum, r) => sum + r.conf, 0) / results.length;
  const beta = stock?.beta || 1;
  const iv = parseFloat(options?.metrics?.avgIV) || 25;
  const pcr = parseFloat(options?.metrics?.putCallRatio) || 1;
  
  return { 
    var95: fmt(beta * 2.8), 
    maxDD: fmt(beta * 12), 
    sharpe: fmt((avg - 50) / 18 + 0.6), 
    beta: fmt(beta), 
    pos: Math.min(Math.floor(buys / 12 * 15) + 3, 15), 
    risk: Math.floor(100 - sells * 7 + buys * 4 - (beta > 1.5 ? 8 : 0)), 
    cons: fmt(avg, 0),
    iv: fmt(iv, 1),
    pcr: fmt(pcr),
  };
}

function decide(stock: any, results: any[], risk: any) {
  const buys = results.filter(r => r.signal.includes('BUY')).length;
  const sells = results.filter(r => r.signal.includes('SELL')).length;
  const sb = results.filter(r => r.signal === 'STRONG_BUY').length;
  const ss = results.filter(r => r.signal === 'STRONG_SELL').length;
  const avg = results.reduce((sum, r) => sum + r.conf, 0) / results.length;
  const target = stock?.targetPrice || 0;
  const price = stock?.price || 1;
  const up = target ? fmt((target / price - 1) * 100, 1) : null;
  
  let action: string, shares: number, rationale: string;
  
  if (sb >= 4 || (buys >= 8 && avg > 70)) { 
    action = 'BUY'; 
    shares = Math.floor(risk.pos * 100 * (sb >= 4 ? 1 : 0.75)); 
    rationale = `Strong consensus: ${buys + sb} bullish signals at ${fmt(avg, 0)}% avg confidence. ${up ? `Analyst target implies ${up}% upside.` : ''} Risk metrics acceptable.`; 
  }
  else if (ss >= 4 || (sells >= 8 && avg > 70)) { 
    action = 'SELL'; 
    shares = Math.floor(risk.pos * 100 * (ss >= 4 ? 1 : 0.75)); 
    rationale = `Bearish consensus: ${sells + ss} sell signals. Reducing exposure immediately.`; 
  }
  else { 
    action = 'HOLD'; 
    shares = 0; 
    rationale = `Mixed signals: ${buys} buy, ${sells} sell, ${12 - buys - sells} hold. Consensus ${fmt(avg, 0)}% insufficient for action.`; 
  }
  
  return { action, shares, rationale, value: fmt(shares * price), target, up };
}

function Badge({ signal }: { signal: string }) {
  const colors: Record<string, string> = {
    'STRONG_BUY': 'bg-emerald-500 text-white shadow-emerald-500/30',
    'BUY': 'bg-green-400 text-green-950',
    'HOLD': 'bg-amber-400 text-amber-950',
    'SELL': 'bg-orange-400 text-orange-950',
    'STRONG_SELL': 'bg-red-500 text-white shadow-red-500/30',
  };
  return <span className={`px-2.5 py-1 rounded-md text-xs font-bold tracking-wide shadow-lg ${colors[signal] || 'bg-slate-500'}`}>{signal.replace('_', ' ')}</span>;
}

function Spinner({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  const sizeClass = size === 'md' ? 'w-5 h-5' : 'w-4 h-4';
  return (
    <svg className={`${sizeClass} animate-spin`} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
}

function AgentCard({ agent, result, loading }: { agent: typeof INVESTOR_AGENTS[0], result: any, loading: boolean }) {
  return (
    <div className="group relative p-4 rounded-2xl border border-slate-700/50 bg-gradient-to-br from-slate-800/90 to-slate-900/90 backdrop-blur-xl hover:border-slate-600/70 transition-all duration-300 hover:shadow-xl hover:shadow-black/20 hover:-translate-y-0.5">
      <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" style={{ background: `radial-gradient(circle at 50% 0%, ${agent.color}20, transparent 60%)` }} />
      <div className="relative">
        <div className="flex items-start gap-3 mb-3">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0 shadow-lg" style={{ background: `linear-gradient(135deg, ${agent.color}30, ${agent.color}10)`, boxShadow: `0 4px 20px ${agent.color}15` }}>
            {agent.avatar}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-white text-sm truncate">{agent.name}</h3>
            <p className="text-xs text-slate-400 truncate">{agent.title}</p>
          </div>
          {loading ? <span className="text-slate-400"><Spinner /></span> : result && <Badge signal={result.signal} />}
        </div>
        <p className="text-xs text-slate-500 italic border-l-2 pl-2 ml-1" style={{ borderColor: `${agent.color}50` }}>&quot;{agent.philosophy}&quot;</p>
        {result && !loading && (
          <div className="mt-4 pt-3 border-t border-slate-700/50">
            <div className="flex justify-between mb-2">
              <span className="text-xs text-slate-400 uppercase tracking-wider">Confidence</span>
              <span className="text-xs font-bold text-white">{result.conf}%</span>
            </div>
            <div className="w-full h-1.5 bg-slate-700/50 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-1000 ease-out" style={{ width: `${result.conf}%`, background: `linear-gradient(90deg, ${agent.color}, ${agent.color}aa)` }} />
            </div>
            <p className="mt-3 text-xs text-slate-300 leading-relaxed">{result.reason}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function OptionsTable({ options, type }: { options: any, type: 'calls' | 'puts' }) {
  const data = type === 'calls' ? options?.calls : options?.puts;
  if (!data || data.length === 0) return <p className="text-slate-500 text-sm text-center py-8">No options data available</p>;
  
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-slate-400 border-b border-slate-700/50">
            <th className="text-left py-2.5 px-2 font-medium">Strike</th>
            <th className="text-right py-2.5 px-2 font-medium">Bid</th>
            <th className="text-right py-2.5 px-2 font-medium">Ask</th>
            <th className="text-right py-2.5 px-2 font-medium">Delta</th>
            <th className="text-right py-2.5 px-2 font-medium">Gamma</th>
            <th className="text-right py-2.5 px-2 font-medium">Theta</th>
            <th className="text-right py-2.5 px-2 font-medium">IV</th>
            <th className="text-right py-2.5 px-2 font-medium">Vol</th>
          </tr>
        </thead>
        <tbody>
          {data.slice(0, 12).map((opt: any, i: number) => (
            <tr key={i} className={`border-b border-slate-800/50 hover:bg-slate-700/20 transition-colors ${opt.itm ? (type === 'calls' ? 'bg-emerald-500/5' : 'bg-red-500/5') : ''}`}>
              <td className="py-2 px-2 font-mono font-semibold text-white">${opt.strike}</td>
              <td className="text-right py-2 px-2 font-mono text-slate-300">${fmt(opt.bid)}</td>
              <td className="text-right py-2 px-2 font-mono text-slate-300">${fmt(opt.ask)}</td>
              <td className={`text-right py-2 px-2 font-mono font-medium ${type === 'calls' ? 'text-emerald-400' : 'text-red-400'}`}>{fmt(opt.delta)}</td>
              <td className="text-right py-2 px-2 font-mono text-amber-400">{fmt(opt.gamma, 3)}</td>
              <td className="text-right py-2 px-2 font-mono text-red-400">{fmt(opt.theta)}</td>
              <td className="text-right py-2 px-2 font-mono text-slate-400">{opt.impliedVolatility ? fmt(opt.impliedVolatility * 100, 0) + '%' : '-'}</td>
              <td className="text-right py-2 px-2 font-mono text-slate-500">{opt.volume?.toLocaleString() || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SuggestionCard({ suggestion }: { suggestion: any }) {
  if (suggestion.type === 'ALERT') {
    return (
      <div className="p-4 rounded-xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-orange-500/5">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xl">⚠️</span>
          <span className="font-bold text-amber-400">{suggestion.strategy}</span>
        </div>
        <div className="space-y-1.5">
          {suggestion.reasoning?.map((reason: string, i: number) => (
            <p key={i} className="text-xs text-slate-300 flex items-start gap-2">
              <span className="text-amber-500 mt-0.5">•</span>
              {reason}
            </p>
          ))}
        </div>
      </div>
    );
  }
  
  const isCall = suggestion.type === 'CALL';
  const isAggressive = suggestion.riskLevel === 'AGGRESSIVE';
  
  return (
    <div className={`p-4 rounded-xl border transition-all hover:shadow-lg ${
      isCall 
        ? 'border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 to-green-500/5 hover:border-emerald-500/50' 
        : 'border-red-500/30 bg-gradient-to-br from-red-500/10 to-orange-500/5 hover:border-red-500/50'
    }`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">{isCall ? '📈' : '📉'}</span>
          <span className="font-bold text-white">{suggestion.strategy}</span>
        </div>
        <span className={`text-xs px-2 py-1 rounded-full font-semibold ${
          isAggressive 
            ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' 
            : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
        }`}>
          {suggestion.riskLevel}
        </span>
      </div>
      
      <div className="grid grid-cols-3 gap-3 mb-3">
        <div className="bg-slate-800/50 rounded-lg p-2">
          <p className="text-slate-400 text-xs">Strike</p>
          <p className="font-mono font-bold text-white">${suggestion.strike}</p>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-2">
          <p className="text-slate-400 text-xs">Ask</p>
          <p className="font-mono font-bold text-white">${fmt(suggestion.ask)}</p>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-2">
          <p className="text-slate-400 text-xs">Breakeven</p>
          <p className="font-mono font-bold text-white">${suggestion.breakeven}</p>
        </div>
      </div>
      
      <div className="grid grid-cols-4 gap-2 mb-3 text-xs">
        <div>
          <p className="text-slate-500">Delta</p>
          <p className={`font-mono font-semibold ${isCall ? 'text-emerald-400' : 'text-red-400'}`}>{fmt(suggestion.delta)}</p>
        </div>
        <div>
          <p className="text-slate-500">Gamma</p>
          <p className="font-mono font-semibold text-amber-400">{fmt(suggestion.gamma, 3)}</p>
        </div>
        <div>
          <p className="text-slate-500">Theta</p>
          <p className="font-mono font-semibold text-red-400">{fmt(suggestion.theta)}</p>
        </div>
        <div>
          <p className="text-slate-500">Max Risk</p>
          <p className="font-mono font-semibold text-white">${suggestion.maxRisk}</p>
        </div>
      </div>
      
      {suggestion.confidence > 0 && (
        <div className="mb-3">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-slate-400">Confidence</span>
            <span className="font-bold text-white">{suggestion.confidence}%</span>
          </div>
          <div className="h-1.5 bg-slate-700/50 rounded-full overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all duration-500 ${isCall ? 'bg-gradient-to-r from-emerald-500 to-green-400' : 'bg-gradient-to-r from-red-500 to-orange-400'}`}
              style={{ width: `${suggestion.confidence}%` }} 
            />
          </div>
        </div>
      )}
      
      <div className="space-y-1.5 pt-2 border-t border-slate-700/50">
        {suggestion.reasoning?.slice(0, 5).map((reason: string, i: number) => (
          <p key={i} className="text-xs text-slate-300 flex items-start gap-2">
            <span className={`mt-0.5 ${reason.includes('⚠️') ? 'text-amber-500' : isCall ? 'text-emerald-500' : 'text-red-500'}`}>
              {reason.includes('⚠️') ? '' : '•'}
            </span>
            {reason}
          </p>
        ))}
      </div>
    </div>
  );
}

export default function Home() {
  const [ticker, setTicker] = useState('');
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [stock, setStock] = useState<any>(null);
  const [options, setOptions] = useState<any>(null);
  const [analysis, setAnalysis] = useState<Record<string, any>>({});
  const [risk, setRisk] = useState<any>(null);
  const [decision, setDecision] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [loadingAgents, setLoadingAgents] = useState<Set<string>>(new Set());
  const [phase, setPhase] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'agents' | 'options'>('agents');

  const runAnalysis = async (tickerSymbol: string) => {
    const t = tickerSymbol.toUpperCase().trim();
    if (!t) return;
    
    setSelectedTicker(t);
    setTicker('');
    setLoading(true);
    setAnalysis({});
    setRisk(null);
    setDecision(null);
    setStock(null);
    setOptions(null);
    setError(null);
    setTab('agents');
    
    try {
      setPhase('Connecting to market data feeds...');
      const [stockRes, optionsRes] = await Promise.all([
        fetch(`/api/stock/${t}`),
        fetch(`/api/options/${t}`),
      ]);
      
      if (!stockRes.ok) throw new Error('Failed to fetch stock data');
      
      const stockData = await stockRes.json();
      const optionsData = optionsRes.ok ? await optionsRes.json() : null;
      
      setStock(stockData);
      setOptions(optionsData);
      
      setPhase('Deploying investor agents...');
      const results: any[] = [];
      
      for (let i = 0; i < INVESTOR_AGENTS.length; i++) {
        const agent = INVESTOR_AGENTS[i];
        setLoadingAgents(prev => new Set([...Array.from(prev), agent.id]));
        await new Promise(r => setTimeout(r, 80));
        
        const result = analyzeAgent(agent, stockData, optionsData);
        results.push(result);
        setAnalysis(prev => ({ ...prev, [agent.id]: result }));
        setLoadingAgents(prev => { const next = new Set(Array.from(prev)); next.delete(agent.id); return next; });
      }
      
      setPhase('Computing risk metrics...');
      await new Promise(r => setTimeout(r, 150));
      const riskMetrics = calcRisk(stockData, optionsData, results);
      setRisk(riskMetrics);
      
      setPhase('Generating portfolio decision...');
      await new Promise(r => setTimeout(r, 150));
      const finalDecision = decide(stockData, results, riskMetrics);
      setDecision(finalDecision);
      
    } catch (err: any) {
      setError(err.message || 'Failed to fetch data');
    }
    
    setPhase(null);
    setLoading(false);
  };

  const counts = Object.keys(analysis).length === 12 ? {
    sb: Object.values(analysis).filter((a: any) => a.signal === 'STRONG_BUY').length,
    b: Object.values(analysis).filter((a: any) => a.signal === 'BUY').length,
    h: Object.values(analysis).filter((a: any) => a.signal === 'HOLD').length,
    s: Object.values(analysis).filter((a: any) => a.signal === 'SELL').length,
    ss: Object.values(analysis).filter((a: any) => a.signal === 'STRONG_SELL').length,
  } : null;

  const formatMarketCap = (cap: number) => {
    if (!cap) return 'N/A';
    if (cap >= 1e12) return `$${(cap / 1e12).toFixed(2)}T`;
    if (cap >= 1e9) return `$${(cap / 1e9).toFixed(0)}B`;
    return `$${(cap / 1e6).toFixed(0)}M`;
  };

  return (
    <div className="min-h-screen bg-[#0a0e17] text-slate-100">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-blue-500/8 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-cyan-500/8 rounded-full blur-[100px]" />
        <div className="absolute top-1/3 right-1/3 w-[400px] h-[400px] bg-purple-500/5 rounded-full blur-[80px]" />
      </div>
      
      <div className="fixed inset-0 opacity-[0.02] pointer-events-none" style={{ 
        backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)', 
        backgroundSize: '60px 60px' 
      }} />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <header className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border border-blue-500/20 mb-6 backdrop-blur-sm">
            <span className="text-blue-400 text-sm">🧠</span>
            <span className="text-xs font-medium text-blue-300 tracking-widest uppercase">Live Multi-Agent Analysis</span>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-4 bg-gradient-to-r from-white via-blue-100 to-cyan-200 bg-clip-text text-transparent tracking-tight">
            AI Hedge Fund
          </h1>
          <p className="text-slate-400 max-w-2xl mx-auto text-sm sm:text-base leading-relaxed">
            Multi-agent investment analysis powered by 12 legendary investor strategies, real-time market data, and Greeks-based options intelligence.
          </p>
          <p className="text-xs text-amber-400/80 mt-4 flex items-center justify-center gap-1">
            <span>⚠️</span> Educational purposes only • Not financial advice
          </p>
        </header>

        <section className="mb-6">
          <div className="relative max-w-2xl mx-auto">
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-blue-500/20 to-cyan-500/20 blur-xl opacity-50" />
            <div className="relative">
              <span className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 text-lg">🔍</span>
              <input 
                type="text" 
                value={ticker} 
                onChange={(e) => setTicker(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && runAnalysis(ticker)}
                placeholder="Enter any stock ticker (AAPL, NVDA, TSLA...)" 
                className="w-full pl-14 pr-28 py-4 rounded-2xl bg-slate-800/80 border border-slate-700/50 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all text-lg font-mono backdrop-blur-sm" 
              />
              <button 
                onClick={() => runAnalysis(ticker)} 
                disabled={loading || !ticker.trim()}
                className="absolute right-2 top-1/2 -translate-y-1/2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 disabled:from-slate-600 disabled:to-slate-600 disabled:cursor-not-allowed text-white text-sm font-semibold transition-all shadow-lg shadow-blue-500/25 disabled:shadow-none"
              >
                {loading ? <Spinner size="md" /> : 'Analyze'}
              </button>
            </div>
          </div>
        </section>

        <section className="mb-10 flex items-center justify-center gap-2 flex-wrap">
          {POPULAR_TICKERS.map(t => (
            <button 
              key={t} 
              onClick={() => runAnalysis(t)} 
              disabled={loading}
              className={`px-4 py-2.5 rounded-xl font-mono font-bold text-sm transition-all duration-200 disabled:opacity-50 ${
                selectedTicker === t 
                  ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg shadow-blue-500/30 scale-105' 
                  : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700/50 hover:border-slate-600/50'
              }`}
            >
              {t}
            </button>
          ))}
        </section>

        {phase && (
          <div className="mb-6 p-4 rounded-2xl bg-blue-500/10 border border-blue-500/30 text-blue-300 text-center flex items-center justify-center gap-3 backdrop-blur-sm">
            <Spinner size="md" /> <span className="font-medium">{phase}</span>
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-300 text-center backdrop-blur-sm">
            <span className="font-medium">⚠️ {error}</span>
          </div>
        )}

        {stock && (
          <section className="mb-8">
            <div className="p-6 rounded-2xl border border-slate-700/50 bg-gradient-to-br from-slate-800/60 to-slate-900/60 backdrop-blur-xl shadow-2xl shadow-black/20">
              <div className="flex flex-wrap items-center justify-between gap-6">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h2 className="text-3xl sm:text-4xl font-bold text-white font-mono tracking-tight">{stock.ticker}</h2>
                    <span className="text-xs px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5 font-medium">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400"></span>
                      </span>
                      LIVE
                    </span>
                    <button onClick={() => runAnalysis(stock.ticker)} disabled={loading} className="p-2 rounded-lg bg-slate-700/50 hover:bg-slate-600/50 disabled:opacity-50 transition-colors">
                      <span className={`${loading ? 'animate-spin' : ''} inline-block`}>🔄</span>
                    </button>
                  </div>
                  <p className="text-sm text-slate-400 mb-3">{stock.name}</p>
                  <div className="flex items-baseline gap-3">
                    <span className="text-3xl sm:text-4xl font-bold text-white font-mono">${fmt(stock.price)}</span>
                    <span className={`flex items-center gap-1 text-lg font-semibold ${stock.change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {stock.change >= 0 ? '▲' : '▼'} {stock.change >= 0 ? '+' : ''}{fmt(stock.change)} ({fmt(stock.changePercent)}%)
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-2">{stock.exchange} • {new Date(stock.timestamp).toLocaleString()}</p>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-4 text-sm">
                  {[
                    ['Market Cap', formatMarketCap(stock.marketCap)],
                    ['P/E Ratio', fmt(stock.pe, 1)],
                    ['Beta', fmt(stock.beta)],
                    ['Target', `$${fmt(stock.targetPrice, 0)}`],
                    ['52W Range', `$${fmt(stock.low52, 0)} - $${fmt(stock.high52, 0)}`],
                  ].map(([label, value]) => (
                    <div key={label} className="bg-slate-800/50 rounded-xl p-3">
                      <p className="text-slate-400 text-xs mb-1">{label}</p>
                      <p className="font-bold text-white">{value}</p>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="mt-6 pt-5 border-t border-slate-700/30 grid grid-cols-4 sm:grid-cols-8 gap-3 text-xs">
                {[
                  ['ROE', stock.roe ? fmt(stock.roe * 100, 0) + '%' : 'N/A'],
                  ['Profit Margin', stock.profitMargin ? fmt(stock.profitMargin * 100, 0) + '%' : 'N/A'],
                  ['Rev Growth', stock.revenueGrowth ? fmt(stock.revenueGrowth * 100, 0) + '%' : 'N/A'],
                  ['D/E Ratio', stock.debtToEquity ? fmt(stock.debtToEquity, 0) + '%' : 'N/A'],
                  ['P/B Ratio', fmt(stock.priceToBook, 1)],
                  ['EPS', `$${fmt(stock.eps)}`],
                  ['Div Yield', fmt(stock.dividendYield) + '%'],
                  ['Upside', stock.targetPrice && stock.price ? ((stock.targetPrice / stock.price - 1) * 100 > 0 ? '+' : '') + fmt((stock.targetPrice / stock.price - 1) * 100, 0) + '%' : 'N/A'],
                ].map(([label, value]) => (
                  <div key={label}>
                    <p className="text-slate-500">{label}</p>
                    <p className={`font-semibold ${label === 'Upside' && String(value).includes('+') ? 'text-emerald-400' : label === 'Upside' && String(value).includes('-') ? 'text-red-400' : 'text-white'}`}>{value}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {selectedTicker && (
          <section className="mb-6 flex gap-1 p-1 bg-slate-800/50 rounded-xl w-fit backdrop-blur-sm border border-slate-700/30">
            <button 
              onClick={() => setTab('agents')} 
              className={`px-5 py-2.5 text-sm font-medium rounded-lg transition-all ${
                tab === 'agents' 
                  ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg' 
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              🎯 Investor Agents
            </button>
            <button 
              onClick={() => setTab('options')} 
              className={`px-5 py-2.5 text-sm font-medium flex items-center gap-2 rounded-lg transition-all ${
                tab === 'options' 
                  ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg' 
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              📊 Options Intel
              {options && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-medium">LIVE</span>
              )}
            </button>
          </section>
        )}

        {selectedTicker && tab === 'options' && (
          <section className="mb-8 space-y-6">
            {options ? (
              <>
                {options.suggestions && options.suggestions.length > 0 && (
                  <div className="p-6 rounded-2xl border border-blue-500/30 bg-gradient-to-br from-blue-500/5 via-slate-900/50 to-cyan-500/5 backdrop-blur-xl">
                    <div className="flex items-center gap-3 mb-5">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/30 to-cyan-500/20 flex items-center justify-center text-2xl shadow-lg shadow-blue-500/20">💡</div>
                      <div>
                        <h2 className="text-xl font-bold text-white">Trade Suggestions</h2>
                        <p className="text-sm text-slate-400">Based on trend, sentiment, earnings, Greeks &amp; volatility</p>
                      </div>
                    </div>
                    
                    <div className="grid gap-4 md:grid-cols-2">
                      {options.suggestions.map((sug: any, i: number) => (
                        <SuggestionCard key={i} suggestion={sug} />
                      ))}
                    </div>
                  </div>
                )}
                
                {options.analysis && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 rounded-xl border border-slate-700/50 bg-slate-800/30 backdrop-blur-sm">
                      <p className="text-xs text-slate-400 mb-2 uppercase tracking-wider">30-Day Trend</p>
                      <div className={`text-xl font-bold flex items-center gap-2 ${
                        options.analysis.trend?.trend === 'BULLISH' ? 'text-emerald-400' : 
                        options.analysis.trend?.trend === 'BEARISH' ? 'text-red-400' : 'text-slate-300'
                      }`}>
                        {options.analysis.trend?.trend === 'BULLISH' ? '📈' : options.analysis.trend?.trend === 'BEARISH' ? '📉' : '➡️'}
                        {options.analysis.trend?.trend || 'N/A'}
                      </div>
                      <p className="text-sm text-slate-400 mt-1">
                        {options.analysis.trend?.changePercent > 0 ? '+' : ''}{options.analysis.trend?.changePercent || 0}%
                      </p>
                    </div>
                    
                    <div className="p-4 rounded-xl border border-slate-700/50 bg-slate-800/30 backdrop-blur-sm">
                      <p className="text-xs text-slate-400 mb-2 uppercase tracking-wider">News Sentiment</p>
                      <div className={`text-xl font-bold flex items-center gap-2 ${
                        options.analysis.newsSentiment?.sentiment === 'BULLISH' ? 'text-emerald-400' : 
                        options.analysis.newsSentiment?.sentiment === 'BEARISH' ? 'text-red-400' : 'text-slate-300'
                      }`}>
                        {options.analysis.newsSentiment?.sentiment === 'BULLISH' ? '😀' : 
                         options.analysis.newsSentiment?.sentiment === 'BEARISH' ? '😟' : '😐'}
                        {options.analysis.newsSentiment?.sentiment || 'N/A'}
                      </div>
                      <p className="text-xs text-slate-500 mt-1 truncate">
                        {options.analysis.newsSentiment?.keywords?.slice(0, 3).join(', ') || 'No keywords'}
                      </p>
                    </div>
                    
                    <div className="p-4 rounded-xl border border-slate-700/50 bg-slate-800/30 backdrop-blur-sm">
                      <p className="text-xs text-slate-400 mb-2 uppercase tracking-wider">Next Earnings</p>
                      <div className="text-xl font-bold text-white flex items-center gap-2">
                        📅 {options.analysis.earnings?.date || 'N/A'}
                      </div>
                      <p className={`text-sm mt-1 ${
                        options.analysis.earnings?.daysUntil <= 7 ? 'text-amber-400' : 'text-slate-400'
                      }`}>
                        {options.analysis.earnings?.daysUntil 
                          ? `${options.analysis.earnings.daysUntil} days away` 
                          : 'Unknown'}
                        {options.analysis.earnings?.daysUntil <= 7 && ' ⚠️'}
                      </p>
                    </div>
                    
                    <div className="p-4 rounded-xl border border-slate-700/50 bg-slate-800/30 backdrop-blur-sm">
                      <p className="text-xs text-slate-400 mb-2 uppercase tracking-wider">Analyst Consensus</p>
                      <div className={`text-xl font-bold uppercase ${
                        options.analysis.analystRating?.consensus === 'buy' ? 'text-emerald-400' : 
                        options.analysis.analystRating?.consensus === 'sell' ? 'text-red-400' : 'text-amber-400'
                      }`}>
                        {options.analysis.analystRating?.consensus || 'HOLD'}
                      </div>
                      <p className="text-sm text-slate-400 mt-1">
                        {options.analysis.analystRating?.buyPercent || 50}% bullish
                      </p>
                    </div>
                  </div>
                )}
                
                {options.analysis?.newsSentiment?.recentHeadlines?.length > 0 && (
                  <div className="p-4 rounded-xl border border-slate-700/50 bg-slate-800/30 backdrop-blur-sm">
                    <p className="text-xs text-slate-400 mb-3 uppercase tracking-wider flex items-center gap-2">📰 Recent Headlines</p>
                    <div className="space-y-2">
                      {options.analysis.newsSentiment.recentHeadlines.slice(0, 5).map((headline: string, i: number) => (
                        <p key={i} className="text-sm text-slate-300 truncate flex items-start gap-2">
                          <span className="text-slate-500">•</span>
                          {headline}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
                
                <div className="p-5 rounded-xl border border-slate-700/50 bg-slate-800/30 backdrop-blur-sm">
                  <div className="flex flex-wrap items-center gap-8">
                    <div><p className="text-xs text-slate-400 uppercase tracking-wider">Expiration</p><p className="text-base font-semibold text-white mt-1">📅 {options.expiration || 'N/A'}</p></div>
                    <div><p className="text-xs text-slate-400 uppercase tracking-wider">Put/Call Ratio</p><p className={`text-base font-semibold mt-1 ${parseFloat(options.metrics?.putCallRatio) > 1 ? 'text-red-400' : 'text-emerald-400'}`}>{options.metrics?.putCallRatio || 'N/A'}</p></div>
                    <div><p className="text-xs text-slate-400 uppercase tracking-wider">Call Volume</p><p className="text-base font-semibold text-emerald-400 mt-1">{options.metrics?.totalCallVolume?.toLocaleString() || 'N/A'}</p></div>
                    <div><p className="text-xs text-slate-400 uppercase tracking-wider">Put Volume</p><p className="text-base font-semibold text-red-400 mt-1">{options.metrics?.totalPutVolume?.toLocaleString() || 'N/A'}</p></div>
                    <div><p className="text-xs text-slate-400 uppercase tracking-wider">Avg IV</p><p className={`text-base font-semibold mt-1 ${parseFloat(options.metrics?.avgIV) > 50 ? 'text-amber-400' : 'text-white'}`}>{options.metrics?.avgIV || 'N/A'}%</p></div>
                    <div className="ml-auto"><span className="text-xs px-2.5 py-1 rounded-lg bg-slate-700/50 text-slate-400 border border-slate-600/50">Source: {options.source?.toUpperCase() || 'API'}</span></div>
                  </div>
                </div>
                
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="p-5 rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/5 to-green-500/5 backdrop-blur-sm">
                    <h3 className="text-lg font-bold text-emerald-400 mb-4 flex items-center gap-2">📈 Calls<span className="text-xs font-normal text-slate-400">({options.calls?.length || 0} contracts)</span></h3>
                    <OptionsTable options={options} type="calls" />
                  </div>
                  <div className="p-5 rounded-2xl border border-red-500/30 bg-gradient-to-br from-red-500/5 to-orange-500/5 backdrop-blur-sm">
                    <h3 className="text-lg font-bold text-red-400 mb-4 flex items-center gap-2">📉 Puts<span className="text-xs font-normal text-slate-400">({options.puts?.length || 0} contracts)</span></h3>
                    <OptionsTable options={options} type="puts" />
                  </div>
                </div>
                
                <p className="text-xs text-center text-slate-500 flex items-center justify-center gap-2">
                  <span className="text-emerald-400">✓</span> Real-time options data • Greeks, IV, and volume included
                </p>
              </>
            ) : (
              <div className="text-center py-16 text-slate-400">
                {loading ? (<div className="flex items-center justify-center gap-3"><Spinner size="md" /> <span>Loading options data...</span></div>) : (<div><div className="text-4xl mb-4">📊</div><p>Options data not available for this ticker</p></div>)}
              </div>
            )}
          </section>
        )}
                ))}
              </div>
            </div>
          </section>
        )}

        {decision && (
          <section className="mb-8">
            <div className={`p-6 rounded-2xl border backdrop-blur-xl ${decision.action === 'BUY' ? 'border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 to-green-500/5' : decision.action === 'SELL' ? 'border-red-500/30 bg-gradient-to-br from-red-500/10 to-orange-500/5' : 'border-slate-500/30 bg-gradient-to-br from-slate-500/10 to-slate-600/5'}`}>
              <div className="flex items-center gap-3 mb-5">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl shadow-lg ${decision.action === 'BUY' ? 'bg-gradient-to-br from-emerald-500/30 to-green-500/20 shadow-emerald-500/20' : decision.action === 'SELL' ? 'bg-gradient-to-br from-red-500/30 to-orange-500/20 shadow-red-500/20' : 'bg-gradient-to-br from-slate-500/30 to-slate-600/20'}`}>
                  {decision.action === 'BUY' ? '✅' : decision.action === 'SELL' ? '❌' : '⏸️'}
                </div>
                <div><h2 className="text-xl font-bold text-white">Portfolio Manager Decision</h2><p className="text-sm text-slate-400">Final trading recommendation</p></div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-5">
                <div className={`p-4 rounded-xl ${decision.action === 'BUY' ? 'bg-emerald-500/10' : decision.action === 'SELL' ? 'bg-red-500/10' : 'bg-slate-500/10'}`}><p className="text-xs text-slate-400 mb-1">Action</p><p className={`text-2xl font-bold ${decision.action === 'BUY' ? 'text-emerald-400' : decision.action === 'SELL' ? 'text-red-400' : 'text-slate-300'}`}>{decision.action}</p></div>
                <div className="p-4 rounded-xl bg-slate-800/50"><p className="text-xs text-slate-400 mb-1">Shares</p><p className="text-2xl font-bold text-white">{decision.shares.toLocaleString()}</p></div>
                <div className="p-4 rounded-xl bg-slate-800/50"><p className="text-xs text-slate-400 mb-1">Est. Value</p><p className="text-2xl font-bold text-white">${Number(decision.value).toLocaleString()}</p></div>
                <div className="p-4 rounded-xl bg-slate-800/50"><p className="text-xs text-slate-400 mb-1">Target</p><p className="text-2xl font-bold text-white">${fmt(decision.target, 0)}</p></div>
                <div className="p-4 rounded-xl bg-slate-800/50"><p className="text-xs text-slate-400 mb-1">Upside</p><p className={`text-2xl font-bold ${decision.up && parseFloat(decision.up) > 0 ? 'text-emerald-400' : 'text-red-400'}`}>{decision.up ? `${decision.up}%` : 'N/A'}</p></div>
              </div>
              <div className="p-4 rounded-xl bg-slate-800/30"><p className="text-xs text-slate-400 mb-2 uppercase tracking-wider">Rationale</p><p className="text-sm text-slate-200 leading-relaxed">{decision.rationale}</p></div>
            </div>
          </section>
        )}

        {!selectedTicker && (
          <div className="text-center py-20">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 mb-6 text-4xl shadow-lg shadow-blue-500/20">📈</div>
            <h2 className="text-2xl font-bold text-white mb-3">Select a Stock to Analyze</h2>
            <p className="text-slate-400 max-w-md mx-auto leading-relaxed">Choose from popular tickers above or enter any stock symbol to run comprehensive multi-agent analysis with live market data and Greeks-based options intelligence.</p>
          </div>
        )}

        <footer className="mt-16 pt-8 border-t border-slate-800/50 text-center">
          <p className="text-sm text-slate-500 mb-2">AI Hedge Fund • Live Multi-Agent Investment Analysis</p>
          <p className="text-xs text-slate-600">Powered by Finnhub, Yahoo Finance &amp; Real-time Options Data</p>
          <p className="text-xs text-slate-700 mt-3">Educational demonstration only. Not financial advice.</p>
        </footer>
      </div>
    </div>
  );
}
