'use client';

import { useState } from 'react';

// Investor agent definitions
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

// Analysis functions
function analyzeAgent(agent: typeof INVESTOR_AGENTS[0], stock: any, options: any) {
  const { pe = 25, beta = 1, targetPrice, priceToBook: pb, debtToEquity: de, profitMargin: margin, revenueGrowth: growth, roe, price } = stock;
  const iv = options?.metrics?.avgIV || 25;
  const pcr = options?.metrics?.putCallRatio || 1;
  
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
      reason = `DCF fair value ~$${(targetPrice || price * 1.1).toFixed(2)}. P/E ${pe?.toFixed(1)} ${pe < 25 ? 'reasonable' : pe > 40 ? 'growth premium' : 'fair'}. Beta ${beta?.toFixed(2)} ${beta > 1.5 ? 'high risk' : 'acceptable'}.`; 
      break; 
    }
    case 'graham': { 
      const b = (pe > 0 && pe < 15 ? 2 : pe < 20 ? 1 : 0) + (pb && pb < 1.5 ? 2 : pb < 3 ? 1 : 0) + (de && de < 50 ? 1 : 0);
      const bear = (pe > 30 ? 2 : 0) + (pb > 10 ? 2 : 0) + (de > 100 ? 1 : 0); 
      signal = sig(b, bear); 
      conf = Math.min(90, 55 + Math.abs(b - bear) * 10); 
      reason = `P/E ${pe?.toFixed(1)} ${pe < 15 ? 'meets' : 'exceeds'} 15x threshold. P/B ${pb?.toFixed(1) || 'N/A'}. D/E ${de?.toFixed(0) || 'N/A'}%. ${pe > 30 && pb > 10 ? 'No margin of safety' : 'Some value present'}.`; 
      break; 
    }
    case 'ackman': { 
      const upside = targetPrice ? ((targetPrice / price - 1) * 100) : 0; 
      const b = (upside > 20 ? 2 : upside > 10 ? 1 : 0) + (margin && margin < 0.15 ? 1 : 0);
      const bear = (margin > 0.35 ? 1 : 0); 
      signal = sig(b + 1, bear); 
      conf = Math.min(85, 62 + Math.abs(b - bear) * 8); 
      reason = `Target upside ${upside.toFixed(0)}%. ${margin && margin < 0.15 ? 'Margin expansion opportunity!' : 'Margins already optimized'}. ${upside > 15 ? 'Activist opportunity' : 'Limited catalyst'}.`; 
      break; 
    }
    case 'wood': { 
      const b = (growth && growth > 0.20 ? 3 : growth > 0.10 ? 2 : growth > 0 ? 1 : 0) + (beta > 1.3 ? 1 : 0);
      const bear = (growth && growth < 0 ? 2 : 0) + (pe > 150 ? 1 : 0); 
      signal = sig(b, bear); 
      conf = Math.min(90, 55 + Math.abs(b - bear) * 10); 
      reason = `Revenue growth ${growth ? (growth * 100).toFixed(0) + '%' : 'N/A'} ${growth > 0.15 ? '🔥 DISRUPTION confirmed!' : growth > 0 ? 'growing' : 'concerning'}. Innovation score: ${Math.floor(55 + (growth || 0) * 200)}/100.`; 
      break; 
    }
    case 'munger': { 
      const b = (roe && roe > 0.20 ? 2 : roe > 0.15 ? 1 : 0) + (margin && margin > 0.20 ? 1 : 0) + (de && de < 50 ? 1 : 0);
      const bear = (roe && roe < 0.10 ? 1 : 0) + (pe > 45 ? 1 : 0); 
      signal = sig(b, bear); 
      conf = Math.min(88, 60 + Math.abs(b - bear) * 10); 
      reason = `ROE ${roe ? (roe * 100).toFixed(0) + '%' : 'N/A'} ${roe > 0.20 ? '- wonderful business!' : roe > 0.15 ? '- quality' : '- below threshold'}. ${roe > 0.25 && de < 50 ? 'Would hold forever' : 'Not a permanent holding'}.`; 
      break; 
    }
    case 'burry': { 
      const b = (pb && pb < 2 ? 3 : pb < 5 ? 1 : 0) + (pe && pe < 15 ? 2 : pe < 20 ? 1 : 0) + (pcr > 1.5 ? 1 : 0);
      const bear = (pe > 50 ? 2 : 0) + (pb > 20 ? 2 : 0); 
      signal = sig(b, bear); 
      conf = Math.min(85, 55 + Math.abs(b - bear) * 10); 
      reason = `${pb && pb < 3 ? '🔍 Deep value detected!' : 'No obvious mispricing'}. P/B ${pb?.toFixed(1) || 'N/A'}. P/C ratio ${pcr.toFixed(2)} ${pcr > 1.3 ? '- contrarian signal!' : ''}.`; 
      break; 
    }
    case 'pabrai': { 
      const upside = targetPrice ? (targetPrice / price - 1) * 100 : 0; 
      const b = (upside > 30 ? 2 : upside > 15 ? 1 : 0) + (beta < 1.2 ? 1 : 0) + (de && de < 40 ? 1 : 0);
      const bear = (beta > 1.8 ? 1 : 0) + (de > 100 ? 1 : 0); 
      signal = sig(b, bear); 
      conf = Math.min(87, 58 + Math.abs(b - bear) * 10); 
      reason = `Dhandho: Risk ${(beta * 2.5).toFixed(1)}/10, Reward ${Math.min(10, upside / 4).toFixed(1)}/10. ${upside > 25 && beta < 1.3 ? '✨ Heads I win!' : 'Risk/reward unfavorable'}. Upside: ${upside.toFixed(0)}%.`; 
      break; 
    }
    case 'lynch': { 
      const peg = pe && growth ? pe / Math.max(growth * 100, 1) : null; 
      const cat = growth > 0.20 ? 'Fast Grower 🚀' : growth > 0.10 ? 'Stalwart' : growth > 0 ? 'Slow Grower' : 'Turnaround'; 
      const b = (peg && peg < 1 ? 2 : peg && peg < 2 ? 1 : 0) + (cat.includes('Fast') ? 2 : 0);
      const bear = (peg && peg > 3 ? 2 : 0); 
      signal = sig(b, bear); 
      conf = Math.min(85, 60 + Math.abs(b - bear) * 10); 
      reason = `Category: ${cat}. PEG: ${peg?.toFixed(2) || 'N/A'} ${peg && peg < 1 ? '(undervalued! 🎯)' : peg && peg < 2 ? '(fair)' : '(expensive)'}.`; 
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
      reason = `Growth: ${growth ? (growth * 100).toFixed(0) + '%' : 'N/A'} YoY. ${growth > 0.15 ? '🐂 Big Bull says ACCUMULATE!' : 'Patience required'}. Conviction: ${conf}%.`; 
      break; 
    }
    case 'druckenmiller': { 
      const asym = targetPrice ? targetPrice / price : 1; 
      const b = (asym > 1.25 ? 2 : asym > 1.10 ? 1 : 0) + (iv < 30 ? 1 : 0);
      const bear = (asym < 0.95 ? 2 : 0) + (iv > 60 ? 1 : 0); 
      signal = sig(b, bear); 
      conf = Math.min(86, 58 + Math.abs(b - bear) * 12); 
      reason = `Asymmetry: ${asym.toFixed(2)}:1. IV ${iv.toFixed(0)}% ${iv < 30 ? '- options CHEAP!' : iv > 50 ? '- expensive' : ''}. ${asym > 1.25 ? '🎯 Sizing UP!' : 'Limited edge'}.`; 
      break; 
    }
    case 'buffett': { 
      const b = (roe && roe > 0.20 ? 2 : roe > 0.15 ? 1 : 0) + (de && de < 50 ? 1 : 0) + (margin && margin > 0.20 ? 1 : 0) + (pe < 25 ? 1 : 0);
      const bear = (roe && roe < 0.10 ? 1 : 0) + (de > 100 ? 1 : 0) + (pe > 40 ? 1 : 0); 
      signal = sig(b, bear); 
      conf = Math.min(90, 60 + Math.abs(b - bear) * 8); 
      const moat = roe > 0.25 && margin > 0.25 ? 'WIDE 🏰' : roe > 0.15 ? 'Moderate' : 'Narrow'; 
      reason = `Economic moat: ${moat}. ROE ${roe ? (roe * 100).toFixed(0) + '%' : 'N/A'}. ${roe > 0.20 && de < 50 && pe < 30 ? '💎 Would buy the WHOLE company!' : 'Pass at this price'}.`; 
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
  const beta = stock.beta || 1;
  const iv = options?.metrics?.avgIV || 25;
  const pcr = options?.metrics?.putCallRatio || 1;
  
  return { 
    var95: (beta * 2.8).toFixed(2), 
    maxDD: (beta * 12).toFixed(2), 
    sharpe: ((avg - 50) / 18 + 0.6).toFixed(2), 
    beta: beta.toFixed(2), 
    pos: Math.min(Math.floor(buys / 12 * 15) + 3, 15), 
    risk: Math.floor(100 - sells * 7 + buys * 4 - (beta > 1.5 ? 8 : 0)), 
    cons: avg.toFixed(0),
    iv: iv.toFixed(1),
    pcr: pcr.toFixed(2),
  };
}

function decide(stock: any, results: any[], risk: any) {
  const buys = results.filter(r => r.signal.includes('BUY')).length;
  const sells = results.filter(r => r.signal.includes('SELL')).length;
  const sb = results.filter(r => r.signal === 'STRONG_BUY').length;
  const ss = results.filter(r => r.signal === 'STRONG_SELL').length;
  const avg = results.reduce((sum, r) => sum + r.conf, 0) / results.length;
  const target = stock.targetPrice;
  const up = target ? ((target / stock.price - 1) * 100).toFixed(1) : null;
  
  let action: string, shares: number, rationale: string;
  
  if (sb >= 4 || (buys >= 8 && avg > 70)) { 
    action = 'BUY'; 
    shares = Math.floor(risk.pos * 100 * (sb >= 4 ? 1 : 0.75)); 
    rationale = `Strong consensus: ${buys + sb} bullish signals at ${avg.toFixed(0)}% avg confidence. ${up ? `Analyst target implies ${up}% upside.` : ''} Risk metrics acceptable.`; 
  }
  else if (ss >= 4 || (sells >= 8 && avg > 70)) { 
    action = 'SELL'; 
    shares = Math.floor(risk.pos * 100 * (ss >= 4 ? 1 : 0.75)); 
    rationale = `Bearish consensus: ${sells + ss} sell signals. Reducing exposure immediately.`; 
  }
  else { 
    action = 'HOLD'; 
    shares = 0; 
    rationale = `Mixed signals: ${buys} buy, ${sells} sell, ${12 - buys - sells} hold. Consensus ${avg.toFixed(0)}% insufficient for action.`; 
  }
  
  return { action, shares, rationale, value: (shares * stock.price).toFixed(2), target, up };
}

// Components
function Badge({ signal }: { signal: string }) {
  const colors: Record<string, string> = {
    'STRONG_BUY': 'bg-emerald-500 text-white',
    'BUY': 'bg-green-400 text-green-950',
    'HOLD': 'bg-amber-400 text-amber-950',
    'SELL': 'bg-orange-400 text-orange-950',
    'STRONG_SELL': 'bg-red-500 text-white',
  };
  return <span className={`px-2 py-0.5 rounded text-xs font-bold ${colors[signal] || 'bg-slate-500'}`}>{signal.replace('_', ' ')}</span>;
}

function Spinner() {
  return <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v4m0 12v4m10-10h-4M6 12H2m15.07-5.07l-2.83 2.83M8.76 15.24l-2.83 2.83m11.31 0l-2.83-2.83M8.76 8.76L5.93 5.93"/></svg>;
}

function AgentCard({ agent, result, loading }: { agent: typeof INVESTOR_AGENTS[0], result: any, loading: boolean }) {
  return (
    <div className="relative p-4 rounded-xl border border-slate-700/50 bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-sm hover:border-slate-600/50 transition-all group">
      <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: `radial-gradient(circle at 50% 0%, ${agent.color}15, transparent 70%)` }} />
      <div className="relative">
        <div className="flex items-start gap-3 mb-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xl shrink-0" style={{ background: `${agent.color}25`, boxShadow: `0 0 20px ${agent.color}20` }}>{agent.avatar}</div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-white text-sm truncate">{agent.name}</h3>
            <p className="text-xs text-slate-400 truncate">{agent.title}</p>
          </div>
          {loading ? <span className="text-slate-400"><Spinner /></span> : result && <Badge signal={result.signal} />}
        </div>
        <p className="text-xs text-slate-500 italic">&quot;{agent.philosophy}&quot;</p>
        {result && !loading && (
          <div className="mt-3 pt-3 border-t border-slate-700/50">
            <div className="flex justify-between mb-2"><span className="text-xs text-slate-400">Confidence</span><span className="text-xs font-bold text-white">{result.conf}%</span></div>
            <div className="w-full h-1.5 bg-slate-700/50 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${result.conf}%`, background: `linear-gradient(90deg, ${agent.color}, ${agent.color}cc)` }} />
            </div>
            <p className="mt-2 text-xs text-slate-300 leading-relaxed">{result.reason}</p>
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
            <th className="text-left py-2 px-2">Strike</th>
            <th className="text-right py-2 px-2">Last</th>
            <th className="text-right py-2 px-2">Bid</th>
            <th className="text-right py-2 px-2">Ask</th>
            <th className="text-right py-2 px-2">Vol</th>
            <th className="text-right py-2 px-2">OI</th>
            <th className="text-right py-2 px-2">IV</th>
          </tr>
        </thead>
        <tbody>
          {data.map((opt: any, i: number) => (
            <tr key={i} className={`border-b border-slate-800/50 ${opt.itm ? (type === 'calls' ? 'bg-emerald-500/5' : 'bg-red-500/5') : ''}`}>
              <td className="py-1.5 px-2 font-mono font-medium text-white">${opt.strike}</td>
              <td className="text-right py-1.5 px-2 font-mono text-white">${opt.last?.toFixed(2) || '-'}</td>
              <td className="text-right py-1.5 px-2 font-mono text-slate-400">${opt.bid?.toFixed(2) || '-'}</td>
              <td className="text-right py-1.5 px-2 font-mono text-slate-400">${opt.ask?.toFixed(2) || '-'}</td>
              <td className="text-right py-1.5 px-2 font-mono text-slate-400">{opt.volume?.toLocaleString() || '-'}</td>
              <td className="text-right py-1.5 px-2 font-mono text-slate-400">{opt.openInterest?.toLocaleString() || '-'}</td>
              <td className="text-right py-1.5 px-2 font-mono text-slate-400">{opt.impliedVolatility ? (opt.impliedVolatility * 100).toFixed(0) + '%' : '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Main component
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
      // Fetch stock and options data
      setPhase('Fetching live market data...');
      const [stockRes, optionsRes] = await Promise.all([
        fetch(`/api/stock/${t}`),
        fetch(`/api/options/${t}`),
      ]);
      
      if (!stockRes.ok) throw new Error('Failed to fetch stock data');
      
      const stockData = await stockRes.json();
      const optionsData = optionsRes.ok ? await optionsRes.json() : null;
      
      setStock(stockData);
      setOptions(optionsData);
      
      // Run investor agents
      setPhase('Running investor agents...');
      const results: any[] = [];
      
      for (let i = 0; i < INVESTOR_AGENTS.length; i++) {
        const agent = INVESTOR_AGENTS[i];
        setLoadingAgents(prev => new Set([...Array.from(prev), agent.id]));
        await new Promise(r => setTimeout(r, 100)); // Stagger for visual effect
        
        const result = analyzeAgent(agent, stockData, optionsData);
        results.push(result);
        setAnalysis(prev => ({ ...prev, [agent.id]: result }));
        setLoadingAgents(prev => { const next = new Set(Array.from(prev)); next.delete(agent.id); return next; });
      }
      
      // Calculate risk
      setPhase('Calculating risk metrics...');
      await new Promise(r => setTimeout(r, 200));
      const riskMetrics = calcRisk(stockData, optionsData, results);
      setRisk(riskMetrics);
      
      // Make decision
      setPhase('Portfolio manager deciding...');
      await new Promise(r => setTimeout(r, 200));
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
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Background effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-full blur-3xl" />
      </div>
      <div className="fixed inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)', backgroundSize: '50px 50px' }} />

      <div className="relative max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <header className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border border-blue-500/20 mb-6">
            <span className="text-blue-400">🧠</span>
            <span className="text-xs font-medium text-blue-300 tracking-wide uppercase">Live AI-Powered Investment Analysis</span>
            <span className="animate-pulse text-emerald-400">●</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-white via-blue-100 to-cyan-100 bg-clip-text text-transparent">AI Hedge Fund</h1>
          <p className="text-slate-400 max-w-2xl mx-auto">Multi-agent investment analysis with 12 legendary investor personalities, real-time market data via Polygon.io + Finnhub, and live options chains.</p>
          <p className="text-xs text-amber-400/80 mt-3">⚠️ Educational purposes only. Not financial advice.</p>
        </header>

        {/* Search */}
        <section className="mb-6">
          <div className="relative max-w-xl mx-auto">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
            <input 
              type="text" 
              value={ticker} 
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && runAnalysis(ticker)}
              placeholder="Enter any stock ticker (e.g., AAPL, NVDA)..." 
              className="w-full pl-12 pr-24 py-3 rounded-xl bg-slate-800/80 border border-slate-700/50 text-white placeholder-slate-400 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20" 
            />
            <button 
              onClick={() => runAnalysis(ticker)} 
              disabled={loading || !ticker.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-1.5 rounded-lg bg-blue-500 hover:bg-blue-600 disabled:bg-slate-600 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
            >
              {loading ? <Spinner /> : 'Analyze'}
            </button>
          </div>
        </section>

        {/* Popular tickers */}
        <section className="mb-8 flex items-center justify-center gap-2 flex-wrap">
          {POPULAR_TICKERS.map(t => (
            <button 
              key={t} 
              onClick={() => runAnalysis(t)} 
              disabled={loading}
              className={`px-4 py-2 rounded-lg font-mono font-bold text-sm transition-all disabled:opacity-50 ${selectedTicker === t ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg shadow-blue-500/25' : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700/50'}`}
            >
              {t}
            </button>
          ))}
        </section>

        {/* Loading phase */}
        {phase && (
          <div className="mb-6 p-4 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-300 text-center flex items-center justify-center gap-3">
            <Spinner /> {phase}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-center">
            {error}
          </div>
        )}

        {/* Stock info */}
        {stock && (
          <section className="mb-8 animate-fade-in">
            <div className="p-6 rounded-2xl border border-slate-700/50 bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-3xl font-bold text-white font-mono">{stock.ticker}</h2>
                    <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                      <span className="animate-pulse">●</span> LIVE
                    </span>
                    <button onClick={() => runAnalysis(stock.ticker)} disabled={loading} className="p-1.5 rounded-lg bg-slate-700/50 hover:bg-slate-600/50 disabled:opacity-50">
                      <span className={loading ? 'animate-spin inline-block' : ''}>🔄</span>
                    </button>
                  </div>
                  <p className="text-sm text-slate-400 mt-1">{stock.name}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-2xl font-bold text-white">${stock.price?.toFixed(2)}</span>
                    <span className={`flex items-center gap-1 text-sm font-semibold ${stock.change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {stock.change >= 0 ? '▲' : '▼'} {stock.change >= 0 ? '+' : ''}{stock.change?.toFixed(2)} ({stock.changePercent?.toFixed(2)}%)
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{stock.exchange} • {new Date(stock.timestamp).toLocaleString()}</p>
                </div>
                <div className="grid grid-cols-3 md:grid-cols-5 gap-4 text-sm">
                  <div><p className="text-slate-400 text-xs">Market Cap</p><p className="font-bold text-white">{formatMarketCap(stock.marketCap)}</p></div>
                  <div><p className="text-slate-400 text-xs">P/E Ratio</p><p className="font-bold text-white">{stock.pe?.toFixed(1) || 'N/A'}</p></div>
                  <div><p className="text-slate-400 text-xs">Beta</p><p className="font-bold text-white">{stock.beta?.toFixed(2) || 'N/A'}</p></div>
                  <div><p className="text-slate-400 text-xs">Target</p><p className="font-bold text-white">${stock.targetPrice?.toFixed(0) || 'N/A'}</p></div>
                  <div><p className="text-slate-400 text-xs">52W Range</p><p className="font-bold text-white">${stock.low52?.toFixed(0)} - ${stock.high52?.toFixed(0)}</p></div>
                </div>
              </div>
              
              {/* Additional metrics */}
              <div className="mt-4 pt-4 border-t border-slate-700/30 grid grid-cols-4 md:grid-cols-8 gap-3 text-xs">
                <div><p className="text-slate-500">ROE</p><p className="font-semibold text-white">{stock.roe ? (stock.roe * 100).toFixed(0) + '%' : 'N/A'}</p></div>
                <div><p className="text-slate-500">Profit Margin</p><p className="font-semibold text-white">{stock.profitMargin ? (stock.profitMargin * 100).toFixed(0) + '%' : 'N/A'}</p></div>
                <div><p className="text-slate-500">Rev Growth</p><p className="font-semibold text-white">{stock.revenueGrowth ? (stock.revenueGrowth * 100).toFixed(0) + '%' : 'N/A'}</p></div>
                <div><p className="text-slate-500">D/E Ratio</p><p className="font-semibold text-white">{stock.debtToEquity?.toFixed(0) || 'N/A'}%</p></div>
                <div><p className="text-slate-500">P/B Ratio</p><p className="font-semibold text-white">{stock.priceToBook?.toFixed(1) || 'N/A'}</p></div>
                <div><p className="text-slate-500">EPS</p><p className="font-semibold text-white">${stock.eps?.toFixed(2) || 'N/A'}</p></div>
                <div><p className="text-slate-500">Div Yield</p><p className="font-semibold text-white">{stock.dividendYield?.toFixed(2) || '0'}%</p></div>
                <div><p className="text-slate-500">Upside</p><p className={`font-semibold ${stock.targetPrice && stock.targetPrice > stock.price ? 'text-emerald-400' : 'text-red-400'}`}>{stock.targetPrice ? ((stock.targetPrice / stock.price - 1) * 100).toFixed(0) + '%' : 'N/A'}</p></div>
              </div>
            </div>
          </section>
        )}

        {/* Tabs */}
        {selectedTicker && (
          <section className="mb-6 flex gap-2 border-b border-slate-700/50">
            <button onClick={() => setTab('agents')} className={`px-4 py-2 text-sm font-medium relative ${tab === 'agents' ? 'text-white' : 'text-slate-400 hover:text-white'}`}>
              🎯 Investor Agents
              {tab === 'agents' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500 to-cyan-500" />}
            </button>
            <button onClick={() => setTab('options')} className={`px-4 py-2 text-sm font-medium flex items-center gap-2 relative ${tab === 'options' ? 'text-white' : 'text-slate-400 hover:text-white'}`}>
              📊 Options Chain
              {options && <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">LIVE</span>}
              {tab === 'options' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500 to-cyan-500" />}
            </button>
          </section>
        )}

        {/* Options tab */}
        {selectedTicker && tab === 'options' && (
          <section className="mb-8">
            {options ? (
              <div className="space-y-6">
                <div className="p-4 rounded-xl border border-slate-700/50 bg-slate-800/30">
                  <div className="flex flex-wrap items-center gap-6">
                    <div><p className="text-xs text-slate-400">Expiration</p><p className="text-sm font-semibold text-white">📅 {options.expiration || 'N/A'}</p></div>
                    <div><p className="text-xs text-slate-400">Put/Call Ratio</p><p className={`text-sm font-semibold ${options.metrics?.putCallRatio > 1 ? 'text-red-400' : 'text-emerald-400'}`}>{options.metrics?.putCallRatio?.toFixed(2) || 'N/A'}</p></div>
                    <div><p className="text-xs text-slate-400">Call Volume</p><p className="text-sm font-semibold text-emerald-400">{options.metrics?.totalCallVolume?.toLocaleString() || 'N/A'}</p></div>
                    <div><p className="text-xs text-slate-400">Put Volume</p><p className="text-sm font-semibold text-red-400">{options.metrics?.totalPutVolume?.toLocaleString() || 'N/A'}</p></div>
                    <div><p className="text-xs text-slate-400">Avg IV</p><p className="text-sm font-semibold text-amber-400">{options.metrics?.avgIV?.toFixed(1) || 'N/A'}%</p></div>
                  </div>
                </div>
                <p className="text-xs text-emerald-400/70 mt-3 text-center">✓ Real-time options data via Yahoo Finance - bid/ask, volume, OI, and IV included</p>
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
              </div>
            ) : (
              <div className="text-center py-12 text-slate-400">
                {loading ? <><Spinner /> Loading options...</> : 'Options data not available for this ticker'}
              </div>
            )}
          </section>
        )}

        {/* Agents tab */}
        {selectedTicker && tab === 'agents' && (
          <>
            {/* Analysis agents status */}
            <section className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-3">
              {ANALYSIS_AGENTS.map(a => (
                <div key={a.id} className={`p-3 rounded-xl border transition-all ${Object.keys(analysis).length > 0 && Object.keys(analysis).length < 12 ? 'border-slate-500 bg-slate-800/80' : 'border-slate-700/50 bg-slate-800/40'}`}>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm" style={{ background: `${a.color}20` }}>
                      {Object.keys(analysis).length > 0 && Object.keys(analysis).length < 12 ? <span style={{ color: a.color }}><Spinner /></span> : Object.keys(analysis).length === 12 ? <span className="text-emerald-400">✓</span> : <span className="text-slate-500">○</span>}
                    </div>
                    <div>
                      <p className="text-xs font-medium text-white">{a.name}</p>
                      <p className="text-xs text-slate-500">{a.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </section>

            {/* Consensus bar */}
            {counts && (
              <section className="mb-6">
                <div className="p-4 rounded-xl border border-slate-700/50 bg-slate-800/30">
                  <h3 className="text-sm font-medium text-slate-400 mb-3">Investor Consensus</h3>
                  <div className="flex gap-4 flex-wrap text-sm">
                    <span className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-emerald-500"></span> Strong Buy: {counts.sb}</span>
                    <span className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-green-400"></span> Buy: {counts.b}</span>
                    <span className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-amber-400"></span> Hold: {counts.h}</span>
                    <span className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-orange-400"></span> Sell: {counts.s}</span>
                    <span className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-red-500"></span> Strong Sell: {counts.ss}</span>
                  </div>
                  <div className="mt-3 h-3 rounded-full overflow-hidden flex bg-slate-700/50">
                    {counts.sb > 0 && <div className="bg-emerald-500 transition-all duration-500" style={{ width: `${(counts.sb / 12) * 100}%` }} />}
                    {counts.b > 0 && <div className="bg-green-400 transition-all duration-500" style={{ width: `${(counts.b / 12) * 100}%` }} />}
                    {counts.h > 0 && <div className="bg-amber-400 transition-all duration-500" style={{ width: `${(counts.h / 12) * 100}%` }} />}
                    {counts.s > 0 && <div className="bg-orange-400 transition-all duration-500" style={{ width: `${(counts.s / 12) * 100}%` }} />}
                    {counts.ss > 0 && <div className="bg-red-500 transition-all duration-500" style={{ width: `${(counts.ss / 12) * 100}%` }} />}
                  </div>
                </div>
              </section>
            )}

            {/* Agent cards */}
            <section className="mb-8">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">🎯 Legendary Investor Agents</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {INVESTOR_AGENTS.map((agent) => (
                  <AgentCard key={agent.id} agent={agent} result={analysis[agent.id]} loading={loadingAgents.has(agent.id)} />
                ))}
              </div>
            </section>
          </>
        )}

        {/* Risk Manager */}
        {risk && (
          <section className="mb-6">
            <div className="p-5 rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/5 to-orange-500/5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center text-xl">🛡️</div>
                <div>
                  <h2 className="text-lg font-semibold text-white">Risk Manager</h2>
                  <p className="text-xs text-slate-400">Position limits and risk metrics</p>
                </div>
              </div>
              <div className="grid grid-cols-3 md:grid-cols-9 gap-3">
                {[
                  ['VaR 95%', `${risk.var95}%`], 
                  ['Max DD', `${risk.maxDD}%`], 
                  ['Sharpe', risk.sharpe], 
                  ['Beta', risk.beta], 
                  ['Position', `${risk.pos}%`], 
                  ['Risk Score', `${risk.risk}/100`], 
                  ['Consensus', `${risk.cons}%`],
                  ['Avg IV', `${risk.iv}%`],
                  ['P/C Ratio', risk.pcr],
                ].map(([label, value]) => (
                  <div key={label as string} className="p-2 rounded-lg bg-slate-800/50 text-center">
                    <p className="text-xs text-slate-400">{label}</p>
                    <p className="text-lg font-bold text-white">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Portfolio Decision */}
        {decision && (
          <section className="mb-8">
            <div className={`p-5 rounded-2xl border ${decision.action === 'BUY' ? 'border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 to-green-500/5' : decision.action === 'SELL' ? 'border-red-500/30 bg-gradient-to-br from-red-500/10 to-orange-500/5' : 'border-slate-500/30 bg-gradient-to-br from-slate-500/10 to-slate-600/5'}`}>
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl ${decision.action === 'BUY' ? 'bg-emerald-500/20' : decision.action === 'SELL' ? 'bg-red-500/20' : 'bg-slate-500/20'}`}>
                  {decision.action === 'BUY' ? '✅' : decision.action === 'SELL' ? '❌' : '⏸️'}
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">Portfolio Manager Decision</h2>
                  <p className="text-xs text-slate-400">Final trading recommendation</p>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
                <div className={`p-3 rounded-xl ${decision.action === 'BUY' ? 'bg-emerald-500/10' : decision.action === 'SELL' ? 'bg-red-500/10' : 'bg-slate-500/10'}`}>
                  <p className="text-xs text-slate-400">Action</p>
                  <p className={`text-2xl font-bold ${decision.action === 'BUY' ? 'text-emerald-400' : decision.action === 'SELL' ? 'text-red-400' : 'text-slate-300'}`}>{decision.action}</p>
                </div>
                <div className="p-3 rounded-xl bg-slate-800/50"><p className="text-xs text-slate-400">Shares</p><p className="text-2xl font-bold text-white">{decision.shares.toLocaleString()}</p></div>
                <div className="p-3 rounded-xl bg-slate-800/50"><p className="text-xs text-slate-400">Est. Value</p><p className="text-2xl font-bold text-white">${Number(decision.value).toLocaleString()}</p></div>
                <div className="p-3 rounded-xl bg-slate-800/50"><p className="text-xs text-slate-400">Target</p><p className="text-2xl font-bold text-white">${decision.target?.toFixed(0) || 'N/A'}</p></div>
                <div className="p-3 rounded-xl bg-slate-800/50"><p className="text-xs text-slate-400">Upside</p><p className={`text-2xl font-bold ${parseFloat(decision.up) > 0 ? 'text-emerald-400' : 'text-red-400'}`}>{decision.up ? `${decision.up}%` : 'N/A'}</p></div>
              </div>
              <div className="p-3 rounded-xl bg-slate-800/30">
                <p className="text-xs text-slate-400 mb-1">Rationale</p>
                <p className="text-sm text-slate-200">{decision.rationale}</p>
              </div>
            </div>
          </section>
        )}

        {/* Empty state */}
        {!selectedTicker && (
          <div className="text-center py-16">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 mb-6 text-3xl">📈</div>
            <h2 className="text-2xl font-semibold text-white mb-3">Select a Stock to Analyze</h2>
            <p className="text-slate-400 max-w-md mx-auto">Choose from popular tickers above or enter any stock symbol to run comprehensive multi-agent analysis with live market data.</p>
          </div>
        )}

        {/* Footer */}
        <footer className="mt-12 pt-6 border-t border-slate-800 text-center">
          <p className="text-sm text-slate-500">AI Hedge Fund • Live Multi-Agent Investment Analysis</p>
          <p className="text-xs text-slate-600 mt-1">Powered by Polygon.io + Finnhub. Educational demonstration only.</p>
        </footer>
      </div>
    </div>
  );
}
