import React, { useState } from 'react';

type Source = {
  name: string;
  signal: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  status: 'PASS' | 'WARN' | 'FAIL';
  details?: string[];
};

export function ConsensusSourcesList({ 
  fundamentals,
  technicals,
  news,
  analysts,
  chartPatterns
}: { 
  fundamentals?: any;
  technicals?: any;
  news?: any;
  analysts?: any;
  chartPatterns?: any;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  
  // Build sources array from data
  const sources: Source[] = [];
  
  // Fundamentals
  if (fundamentals) {
    const fundScore = fundamentals.score || 0;
    sources.push({
      name: 'Fundamentals',
      signal: fundScore >= 6 ? 'BULLISH' : fundScore >= 4 ? 'NEUTRAL' : 'BEARISH',
      status: fundScore >= 6 ? 'PASS' : fundScore >= 4 ? 'WARN' : 'FAIL',
      details: [
        `P/E Ratio: ${fundamentals.pe?.toFixed(1) || 'N/A'}`,
        `ROE: ${fundamentals.roe?.toFixed(1) || 'N/A'}%`,
        `Debt/Equity: ${fundamentals.debtToEquity?.toFixed(2) || 'N/A'}`,
        `Margins: ${fundamentals.profitMargin?.toFixed(1) || 'N/A'}%`
      ]
    });
  }
  
  // Technicals
  if (technicals) {
    const techScore = technicals.score || 0;
    sources.push({
      name: 'Technicals',
      signal: techScore >= 6 ? 'BULLISH' : techScore >= 4 ? 'NEUTRAL' : 'BEARISH',
      status: techScore >= 6 ? 'PASS' : techScore >= 4 ? 'WARN' : 'FAIL',
      details: [
        `RSI: ${technicals.rsi?.toFixed(1) || 'N/A'}`,
        `MACD: ${technicals.macd || 'N/A'}`,
        `50 SMA: ${technicals.sma50 ? 'Above' : 'Below'}`,
        `200 SMA: ${technicals.sma200 ? 'Above' : 'Below'}`
      ]
    });
  }
  
  // Chart Patterns
  if (chartPatterns?.confirmed?.length > 0) {
    const pattern = chartPatterns.confirmed[0];
    sources.push({
      name: 'Chart Patterns',
      signal: pattern.type === 'BULLISH' ? 'BULLISH' : 'BEARISH',
      status: 'PASS',
      details: [
        `Pattern: ${pattern.name}`,
        `Confidence: ${pattern.confidence}%`,
        `Target: ${pattern.target || 'N/A'}`,
        `Status: CONFIRMED`
      ]
    });
  } else if (chartPatterns?.forming?.length > 0) {
    sources.push({
      name: 'Chart Patterns',
      signal: 'NEUTRAL',
      status: 'WARN',
      details: [`Pattern forming: ${chartPatterns.forming[0]?.name || 'Unknown'}`]
    });
  }
  
  // News Sentiment
  if (news?.headlines?.length > 0) {
    const sentiment = news.sentiment || 'NEUTRAL';
    sources.push({
      name: 'News Sentiment',
      signal: sentiment as any,
      status: sentiment === 'BULLISH' ? 'PASS' : sentiment === 'BEARISH' ? 'FAIL' : 'WARN',
      details: news.headlines.slice(0, 3).map((h: any) => h.title || 'No headline')
    });
  }
  
  // Analysts - only show if there's actual analyst coverage
  if (analysts?.consensus && (analysts.distribution?.strongBuy > 0 || analysts.distribution?.buy > 0 || analysts.distribution?.hold > 0)) {
    const totalAnalysts = (analysts.distribution?.strongBuy || 0) + (analysts.distribution?.buy || 0) + (analysts.distribution?.hold || 0) + (analysts.distribution?.sell || 0) + (analysts.distribution?.strongSell || 0);
    if (totalAnalysts > 0) {
      sources.push({
        name: 'Analysts',
        signal: analysts.consensus === 'BUY' || analysts.consensus === 'STRONG BUY' ? 'BULLISH' : analysts.consensus === 'SELL' ? 'BEARISH' : 'NEUTRAL',
        status: analysts.consensus === 'BUY' || analysts.consensus === 'STRONG BUY' ? 'PASS' : analysts.consensus === 'SELL' ? 'FAIL' : 'WARN',
        details: [
          `Consensus: ${analysts.consensus}`,
          `Target: $${analysts.targetPrice?.toFixed(2) || 'N/A'}`,
          `Coverage: ${totalAnalysts} analysts`
        ]
      });
    }
  }
  
  return (
    <div className="p-4 rounded-2xl border border-slate-700/50 bg-slate-800/30">
      <h3 className="text-sm font-semibold text-white mb-3">Independent Sources</h3>
      
      <div className="space-y-2">
        {sources.map((source, i) => (
          <div key={i}>
            {/* Collapsed View */}
            <button
              onClick={() => setExpanded(expanded === source.name ? null : source.name)}
              className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-slate-700/30 transition"
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">
                  {source.status === 'PASS' ? '✅' : source.status === 'WARN' ? '⚠️' : '❌'}
                </span>
                <span className="text-sm text-white">{source.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                  source.signal === 'BULLISH' ? 'bg-emerald-500/20 text-emerald-400' :
                  source.signal === 'BEARISH' ? 'bg-red-500/20 text-red-400' :
                  'bg-slate-500/20 text-slate-400'
                }`}>
                  {source.signal}
                </span>
                <span className="text-slate-400">
                  {expanded === source.name ? '▼' : '▶'}
                </span>
              </div>
            </button>
            
            {/* Expanded Details */}
            {expanded === source.name && source.details && (
              <div className="ml-7 mt-2 space-y-1">
                {source.details.map((detail, j) => (
                  <p key={j} className="text-xs text-slate-400">• {detail}</p>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
