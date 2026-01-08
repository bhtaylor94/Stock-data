'use client';
import React, { useState, useEffect } from 'react';

// ============================================================
// COMPREHENSIVE TRADING DASHBOARD
// ============================================================

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function ScoreBar({ score, maxScore, label, size = 'md' }: { score: number; maxScore: number; label: string; size?: 'sm' | 'md' }) {
  const pct = (score / maxScore) * 100;
  const color = pct >= 70 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className={size === 'sm' ? 'mb-1' : 'mb-2'}>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-slate-400">{label}</span>
        <span className="text-white font-bold">{score}/{maxScore}</span>
      </div>
      <div className={`${size === 'sm' ? 'h-1.5' : 'h-2'} bg-slate-700 rounded-full overflow-hidden`}>
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function FactorItem({ factor }: { factor: { name: string; passed: boolean; value: string } }) {
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
function StockTab({ data, loading }: { data: any; loading: boolean }) {
  if (loading) return <LoadingSpinner />;
  if (!data) return <p className="text-slate-500 text-center py-12">Enter a ticker symbol to analyze</p>;
  if (data.error) {
    return (
      <div className="p-6 rounded-2xl border border-red-500/30 bg-red-500/5">
        <h3 className="text-lg font-semibold text-red-400 mb-3">⚠️ {data.error}</h3>
        {data.instructions?.map((i: string, idx: number) => <p key={idx} className="text-xs text-slate-400">• {i}</p>)}
      </div>
    );
  }

  const { analysis, suggestions, news, analysts, insiders, earnings, technicals, fundamentals } = data;

  return (
    <div className="space-y-6">
      {/* Overall Score */}
      <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-800/80 to-slate-900/80 border border-slate-700/50">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">📊 Analysis Score</h2>
          <span className={`text-3xl font-bold ${
            analysis?.combined?.score >= 14 ? 'text-emerald-400' :
            analysis?.combined?.score >= 11 ? 'text-blue-400' :
            analysis?.combined?.score >= 7 ? 'text-amber-400' : 'text-red-400'
          }`}>{analysis?.combined?.score || 0}/{analysis?.combined?.maxScore || 18}</span>
        </div>
        <ScoreBar score={analysis?.combined?.score || 0} maxScore={18} label="Combined Score" />
        <div className="grid grid-cols-2 gap-4 mt-3">
          <ScoreBar score={analysis?.fundamental?.score || 0} maxScore={9} label="Fundamental" size="sm" />
          <ScoreBar score={analysis?.technical?.score || 0} maxScore={9} label="Technical" size="sm" />
        </div>
        <div className="text-center mt-4">
          <span className={`px-4 py-1.5 rounded-full text-sm font-medium ${
            analysis?.combined?.rating === 'STRONG_BUY' ? 'bg-emerald-500/20 text-emerald-400' :
            analysis?.combined?.rating === 'BUY' ? 'bg-blue-500/20 text-blue-400' :
            analysis?.combined?.rating === 'HOLD' ? 'bg-amber-500/20 text-amber-400' :
            'bg-red-500/20 text-red-400'
          }`}>{analysis?.combined?.rating?.replace('_', ' ') || 'N/A'}</span>
        </div>
      </div>

      {/* Suggestions */}
      <div className="p-5 rounded-2xl border border-blue-500/30 bg-gradient-to-br from-blue-950/30 to-cyan-950/20">
        <h2 className="text-lg font-semibold text-white mb-4">💡 Recommendations</h2>
        <div className="space-y-4">
          {suggestions?.map((sug: any, i: number) => (
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
                {sug.confidence > 0 && <span className="text-sm text-slate-400">Confidence: <span className="text-white font-bold">{sug.confidence}%</span></span>}
              </div>
              
              {/* Summary */}
              {sug.detailedExplanation?.summary && (
                <p className="text-sm text-slate-200 mb-3 leading-relaxed">{sug.detailedExplanation.summary}</p>
              )}
              
              {/* Quick reasoning */}
              <div className="mb-3">
                {sug.reasoning?.map((r: string, j: number) => <p key={j} className="text-xs text-slate-400">• {r}</p>)}
              </div>
              
              {/* Detailed Explanation (expandable) */}
              {sug.detailedExplanation && sug.type !== 'ALERT' && (
                <details className="mt-3 pt-3 border-t border-slate-700/50">
                  <summary className="text-xs text-blue-400 cursor-pointer hover:text-blue-300">📖 View Detailed Analysis</summary>
                  <div className="mt-3 space-y-3 text-xs">
                    {/* Key Metrics */}
                    {sug.detailedExplanation.keyMetrics && (
                      <div className="grid grid-cols-1 gap-1 p-2 rounded bg-slate-800/50">
                        <p className="text-slate-400">📊 <span className="text-slate-300">{sug.detailedExplanation.keyMetrics.valuation}</span></p>
                        <p className="text-slate-400">💰 <span className="text-slate-300">{sug.detailedExplanation.keyMetrics.profitability}</span></p>
                        <p className="text-slate-400">🏦 <span className="text-slate-300">{sug.detailedExplanation.keyMetrics.financial_health}</span></p>
                        <p className="text-slate-400">📈 <span className="text-slate-300">{sug.detailedExplanation.keyMetrics.momentum}</span></p>
                        <p className="text-slate-400">📍 <span className="text-slate-300">{sug.detailedExplanation.keyMetrics.trend}</span></p>
                      </div>
                    )}
                    
                    {/* Confidence Adjustments */}
                    {sug.detailedExplanation.confidenceFactors?.adjustments?.length > 0 && (
                      <div className="p-2 rounded bg-slate-800/50">
                        <p className="text-slate-400 mb-1">🎯 Confidence Factors:</p>
                        <p className="text-slate-300">Base: {sug.detailedExplanation.confidenceFactors.baseConfidence}</p>
                        {sug.detailedExplanation.confidenceFactors.adjustments.map((adj: string, k: number) => (
                          <p key={k} className={`${adj.startsWith('+') ? 'text-emerald-400' : adj.startsWith('-') ? 'text-red-400' : 'text-slate-300'}`}>• {adj}</p>
                        ))}
                        <p className="text-white font-medium mt-1">Final: {sug.detailedExplanation.confidenceFactors.finalConfidence}</p>
                      </div>
                    )}
                    
                    {/* Reasoning */}
                    {sug.detailedExplanation.reasoning?.length > 0 && (
                      <div className="p-2 rounded bg-slate-800/50">
                        <p className="text-slate-400 mb-1">🧠 Analysis:</p>
                        {sug.detailedExplanation.reasoning.map((r: string, k: number) => (
                          <p key={k} className="text-slate-300">• {r}</p>
                        ))}
                      </div>
                    )}
                    
                    {/* Score Breakdown */}
                    {sug.detailedExplanation.scoreBreakdown && (
                      <div className="grid md:grid-cols-2 gap-2">
                        <div className="p-2 rounded bg-emerald-500/10">
                          <p className="text-emerald-400 font-medium mb-1">✓ Passed Factors ({sug.detailedExplanation.scoreBreakdown.fundamental?.passed?.length || 0})</p>
                          {sug.detailedExplanation.scoreBreakdown.fundamental?.passed?.slice(0, 5).map((p: string, k: number) => (
                            <p key={k} className="text-emerald-300/80 text-xs">{p}</p>
                          ))}
                          {sug.detailedExplanation.scoreBreakdown.technical?.passed?.slice(0, 5).map((p: string, k: number) => (
                            <p key={k} className="text-emerald-300/80 text-xs">{p}</p>
                          ))}
                        </div>
                        <div className="p-2 rounded bg-red-500/10">
                          <p className="text-red-400 font-medium mb-1">✗ Failed Factors ({sug.detailedExplanation.scoreBreakdown.fundamental?.failed?.length || 0})</p>
                          {sug.detailedExplanation.scoreBreakdown.fundamental?.failed?.slice(0, 5).map((f: string, k: number) => (
                            <p key={k} className="text-red-300/80 text-xs">{f}</p>
                          ))}
                          {sug.detailedExplanation.scoreBreakdown.technical?.failed?.slice(0, 5).map((f: string, k: number) => (
                            <p key={k} className="text-red-300/80 text-xs">{f}</p>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </details>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* News Headlines */}
      {news?.headlines?.length > 0 && (
        <div className="p-5 rounded-2xl border border-slate-700/50 bg-slate-800/30">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-md font-semibold text-white">📰 Recent News</h3>
            <span className={`text-xs px-2 py-0.5 rounded ${
              news.sentiment === 'BULLISH' ? 'bg-emerald-500/20 text-emerald-400' :
              news.sentiment === 'BEARISH' ? 'bg-red-500/20 text-red-400' :
              'bg-slate-500/20 text-slate-400'
            }`}>{news.sentiment} ({news.score}%)</span>
          </div>
          {news.buzzwords?.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-3">
              {news.buzzwords.map((w: string, i: number) => (
                <span key={i} className={`text-xs px-2 py-0.5 rounded ${w.startsWith('+') ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>{w}</span>
              ))}
            </div>
          )}
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {news.headlines.slice(0, 6).map((h: any, i: number) => (
              <div key={i} className="flex items-start gap-2">
                <span className={`text-xs mt-0.5 ${h.sentiment === 'BULLISH' ? 'text-emerald-400' : h.sentiment === 'BEARISH' ? 'text-red-400' : 'text-slate-400'}`}>
                  {h.sentiment === 'BULLISH' ? '▲' : h.sentiment === 'BEARISH' ? '▼' : '•'}
                </span>
                <div className="flex-1">
                  <p className="text-xs text-slate-300 line-clamp-2">{h.title}</p>
                  <p className="text-xs text-slate-500">{h.source} • {h.datetime}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Analyst & Insider Row */}
      <div className="grid md:grid-cols-2 gap-4">
        {analysts && (
          <div className="p-4 rounded-2xl border border-slate-700/50 bg-slate-800/30">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-md font-semibold text-white">📊 Analysts</h3>
              <span className={`text-xs px-2 py-0.5 rounded ${
                analysts.consensus === 'STRONG BUY' ? 'bg-emerald-500/20 text-emerald-400' :
                analysts.consensus === 'BUY' ? 'bg-blue-500/20 text-blue-400' :
                'bg-slate-500/20 text-slate-400'
              }`}>{analysts.consensus}</span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Buy %</span>
                <span className="text-emerald-400 font-bold">{analysts.buyPercent}%</span>
              </div>
              <div className="flex gap-1 h-3 rounded overflow-hidden">
                <div className="bg-emerald-600" style={{ width: `${(analysts.distribution?.strongBuy || 0) * 5}%` }} />
                <div className="bg-emerald-400" style={{ width: `${(analysts.distribution?.buy || 0) * 5}%` }} />
                <div className="bg-amber-400" style={{ width: `${(analysts.distribution?.hold || 0) * 5}%` }} />
                <div className="bg-red-400" style={{ width: `${(analysts.distribution?.sell || 0) * 5}%` }} />
              </div>
              {analysts.targetPrice > 0 && (
                <div className="pt-2 border-t border-slate-700">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">Price Target</span>
                    <span className="text-white font-bold">${analysts.targetPrice}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">Upside</span>
                    <span className={`font-bold ${analysts.targetUpside >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {analysts.targetUpside >= 0 ? '+' : ''}{analysts.targetUpside?.toFixed(1)}%
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {insiders && (
          <div className="p-4 rounded-2xl border border-slate-700/50 bg-slate-800/30">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-md font-semibold text-white">👔 Insiders</h3>
              <span className={`text-xs px-2 py-0.5 rounded ${
                insiders.netActivity === 'BUYING' ? 'bg-emerald-500/20 text-emerald-400' :
                insiders.netActivity === 'SELLING' ? 'bg-red-500/20 text-red-400' :
                'bg-slate-500/20 text-slate-400'
              }`}>{insiders.netActivity}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2 rounded bg-emerald-500/10 text-center">
                <p className="text-slate-400">Buys</p>
                <p className="text-emerald-400 font-bold text-lg">{insiders.buyCount || 0}</p>
              </div>
              <div className="p-2 rounded bg-red-500/10 text-center">
                <p className="text-slate-400">Sells</p>
                <p className="text-red-400 font-bold text-lg">{insiders.sellCount || 0}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Earnings */}
      {earnings && (
        <div className="p-4 rounded-2xl border border-purple-500/30 bg-purple-500/5">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📅</span>
            <div>
              <p className="text-sm font-medium text-white">Next Earnings: {earnings.date}</p>
              <p className="text-xs text-slate-400">EPS Est: ${earnings.epsEstimate || 'N/A'}</p>
            </div>
          </div>
        </div>
      )}

      {/* Factor Details */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="p-4 rounded-2xl border border-slate-700/50 bg-slate-800/30">
          <h3 className="text-md font-semibold text-white mb-3">📊 Fundamental Factors</h3>
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {analysis?.fundamental?.factors?.map((f: any, i: number) => <FactorItem key={i} factor={f} />)}
          </div>
        </div>
        <div className="p-4 rounded-2xl border border-slate-700/50 bg-slate-800/30">
          <h3 className="text-md font-semibold text-white mb-3">📈 Technical Factors</h3>
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {analysis?.technical?.factors?.map((f: any, i: number) => <FactorItem key={i} factor={f} />)}
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="p-4 rounded-xl border border-slate-700/50 bg-slate-800/30">
        <div className="grid grid-cols-4 md:grid-cols-8 gap-3 text-center text-xs">
          <div><p className="text-slate-500">P/E</p><p className="font-bold text-white">{fundamentals?.pe?.toFixed(1) || 'N/A'}</p></div>
          <div><p className="text-slate-500">ROE</p><p className="font-bold text-white">{fundamentals?.roe?.toFixed(1)}%</p></div>
          <div><p className="text-slate-500">D/E</p><p className="font-bold text-white">{fundamentals?.debtEquity?.toFixed(2)}</p></div>
          <div><p className="text-slate-500">Margin</p><p className="font-bold text-white">{fundamentals?.profitMargin?.toFixed(1)}%</p></div>
          <div><p className="text-slate-500">RSI</p><p className={`font-bold ${technicals?.rsi > 70 ? 'text-red-400' : technicals?.rsi < 30 ? 'text-emerald-400' : 'text-white'}`}>{technicals?.rsi}</p></div>
          <div><p className="text-slate-500">vs 50SMA</p><p className={`font-bold ${technicals?.priceVsSma50 >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{technicals?.priceVsSma50?.toFixed(1)}%</p></div>
          <div><p className="text-slate-500">Support</p><p className="font-bold text-white">${technicals?.support?.toFixed(2)}</p></div>
          <div><p className="text-slate-500">Resist</p><p className="font-bold text-white">${technicals?.resistance?.toFixed(2)}</p></div>
        </div>
      </div>

      <p className="text-xs text-center text-slate-500">
        Updated: {data.lastUpdated ? new Date(data.lastUpdated).toLocaleString() : 'N/A'} • Source: {data.dataSource} • {data.responseTimeMs}ms
      </p>
    </div>
  );
}

// ============================================================
// OPTIONS TAB
// ============================================================
function OptionsTab({ data, loading }: { data: any; loading: boolean }) {
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

      {/* Unusual Options Activity */}
      {data.unusualActivity?.length > 0 && (
        <div className="p-5 rounded-2xl border border-orange-500/30 bg-gradient-to-br from-orange-950/20 to-red-950/10">
          <h2 className="text-lg font-semibold text-orange-400 mb-4">🔥 Unusual Options Activity</h2>
          <div className="space-y-3">
            {data.unusualActivity.slice(0, 5).map((u: any, i: number) => (
              <div key={i} className={`p-3 rounded-xl border ${u.sentiment === 'BULLISH' ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-red-500/30 bg-red-500/5'}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-white">{u.type === 'call' ? '📈' : '📉'} ${u.strike} {u.type?.toUpperCase()}</span>
                  <span className={`text-xs px-2 py-0.5 rounded ${u.sentiment === 'BULLISH' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>{u.sentiment}</span>
                </div>
                <div className="grid grid-cols-4 gap-2 text-xs mb-2">
                  <div><span className="text-slate-400">Vol:</span> <span className="text-amber-400 font-bold">{u.volume?.toLocaleString()}</span></div>
                  <div><span className="text-slate-400">OI:</span> <span className="text-white">{u.openInterest?.toLocaleString()}</span></div>
                  <div><span className="text-slate-400">V/OI:</span> <span className="text-orange-400 font-bold">{u.volumeOIRatio}x</span></div>
                  <div><span className="text-slate-400">Exp:</span> <span className="text-white">{u.expiration}</span></div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {u.signals?.map((s: string, j: number) => (
                    <span key={j} className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300">{s}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Trade Suggestions */}
      {data.suggestions?.filter((s: any) => s.type !== 'ALERT').length > 0 && (
        <div className="p-5 rounded-2xl border border-blue-500/30 bg-gradient-to-br from-blue-950/30 to-cyan-950/20">
          <h2 className="text-lg font-semibold text-white mb-4">💡 Trade Setups</h2>
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
                  <div className="flex gap-1 mb-2">
                    <span className={`px-1.5 py-0.5 rounded text-xs ${sug.score.delta >= 1 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-400'}`}>Δ{sug.score.delta}</span>
                    <span className={`px-1.5 py-0.5 rounded text-xs ${sug.score.iv >= 1 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-400'}`}>IV{sug.score.iv}</span>
                    <span className={`px-1.5 py-0.5 rounded text-xs ${sug.score.liquidity >= 1 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-400'}`}>Liq{sug.score.liquidity}</span>
                    <span className={`px-1.5 py-0.5 rounded text-xs ${sug.score.unusual >= 1 ? 'bg-orange-500/20 text-orange-400' : 'bg-slate-700 text-slate-400'}`}>UOA{sug.score.unusual}</span>
                  </div>
                )}
                <div className="space-y-1 mb-2">
                  {sug.reasoning?.slice(0, 3).map((r: string, j: number) => <p key={j} className="text-xs text-slate-300">• {r}</p>)}
                </div>
                
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
// MAIN APP
// ============================================================
export default function Home() {
  const [ticker, setTicker] = useState('');
  const [searchedTicker, setSearchedTicker] = useState('');
  const [activeTab, setActiveTab] = useState<'stocks' | 'options'>('stocks');
  const [stockData, setStockData] = useState<any>(null);
  const [optionsData, setOptionsData] = useState<any>(null);
  const [loadingStock, setLoadingStock] = useState(false);
  const [loadingOptions, setLoadingOptions] = useState(false);

  const handleSearch = async () => {
    if (!ticker.trim()) return;
    const sym = ticker.toUpperCase().trim();
    setSearchedTicker(sym);
    setLoadingStock(true);
    setLoadingOptions(true);
    try {
      const [stockRes, optionsRes] = await Promise.all([fetch(`/api/stock/${sym}`), fetch(`/api/options/${sym}`)]);
      if (stockRes.ok) setStockData(await stockRes.json());
      if (optionsRes.ok) setOptionsData(await optionsRes.json());
    } catch (err) { console.error(err); }
    setLoadingStock(false);
    setLoadingOptions(false);
  };

  const handleRefresh = async () => {
    if (!searchedTicker) return;
    if (activeTab === 'stocks') {
      setLoadingStock(true);
      try { const res = await fetch(`/api/stock/${searchedTicker}`); if (res.ok) setStockData(await res.json()); } catch {}
      setLoadingStock(false);
    } else {
      setLoadingOptions(true);
      try { const res = await fetch(`/api/options/${searchedTicker}`); if (res.ok) setOptionsData(await res.json()); } catch {}
      setLoadingOptions(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-blue-600 flex items-center justify-center"><span className="text-xl">🧠</span></div>
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-blue-400 bg-clip-text text-transparent">AI Hedge Fund</h1>
            <p className="text-xs text-slate-400">Professional Analysis • News • Unusual Activity</p>
          </div>
        </div>

        <div className="mb-6 flex gap-3">
          <input type="text" value={ticker} onChange={(e) => setTicker(e.target.value.toUpperCase())} onKeyPress={(e) => e.key === 'Enter' && handleSearch()} placeholder="Enter ticker..." className="flex-1 px-4 py-3 rounded-xl bg-slate-800/50 border border-slate-700/50 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 font-mono" />
          <button onClick={handleSearch} disabled={loadingStock || !ticker.trim()} className="px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-blue-600 hover:from-emerald-500 hover:to-blue-500 text-white font-medium disabled:opacity-50">{loadingStock ? 'Analyzing...' : 'Analyze'}</button>
        </div>

        {stockData && !stockData.error && (
          <div className="mb-6 p-5 rounded-2xl bg-gradient-to-br from-slate-800/80 to-slate-900/80 border border-slate-700/50">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-slate-700 flex items-center justify-center"><span className="text-2xl font-bold font-mono">{stockData.ticker?.charAt(0)}</span></div>
                <div>
                  <div className="flex items-center gap-3">
                    <span className="text-3xl font-bold font-mono">{stockData.ticker}</span>
                    <span className={`text-xs px-2.5 py-1 rounded-full flex items-center gap-1.5 ${stockData.dataSource === 'schwab' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-blue-500/20 text-blue-400'}`}>
                      <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />{stockData.dataSource?.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-slate-400 text-sm">{stockData.name} • {stockData.industry}</p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-3xl font-bold font-mono">${stockData.price?.toFixed(2)}</span>
                <p className={`text-sm font-medium ${stockData.change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{stockData.change >= 0 ? '+' : ''}{stockData.change?.toFixed(2)} ({stockData.changePercent >= 0 ? '+' : ''}{stockData.changePercent?.toFixed(2)}%)</p>
              </div>
            </div>
          </div>
        )}

        <div className="mb-6 flex items-center justify-between">
          <div className="flex gap-2">
            <button onClick={() => setActiveTab('stocks')} className={`px-5 py-2.5 rounded-xl font-medium transition ${activeTab === 'stocks' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'text-slate-400 hover:text-white bg-slate-800/30'}`}>📊 Stock</button>
            <button onClick={() => setActiveTab('options')} className={`px-5 py-2.5 rounded-xl font-medium transition ${activeTab === 'options' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'text-slate-400 hover:text-white bg-slate-800/30'}`}>📈 Options</button>
          </div>
          {searchedTicker && <button onClick={handleRefresh} disabled={loadingStock || loadingOptions} className="px-4 py-2 rounded-xl bg-slate-800/50 border border-slate-700/50 text-slate-300 hover:text-white text-sm flex items-center gap-2 disabled:opacity-50"><span className={loadingStock || loadingOptions ? 'animate-spin' : ''}>🔄</span> Refresh</button>}
        </div>

        {activeTab === 'stocks' && <StockTab data={stockData} loading={loadingStock} />}
        {activeTab === 'options' && <OptionsTab data={optionsData} loading={loadingOptions} />}

        <div className="mt-8 p-4 rounded-xl bg-slate-800/20 border border-slate-700/30">
          <p className="text-xs text-slate-500 text-center">⚠️ Educational purposes only. Not financial advice. Data: Schwab, Finnhub</p>
        </div>
      </div>
    </div>
  );
}
