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

// ============================================================
// TRACK BUTTON COMPONENT
// ============================================================
function TrackButton({ 
  ticker, 
  suggestion, 
  entryPrice, 
  onTrack 
}: { 
  ticker: string;
  suggestion: any;
  entryPrice: number;
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
      };
      
      if (suggestion.contract) {
        trackData.optionContract = {
          strike: suggestion.contract.strike,
          expiration: suggestion.contract.expiration,
          dte: suggestion.contract.dte,
          delta: suggestion.contract.delta,
          entryAsk: suggestion.contract.ask,
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
  
  if (suggestion.type === 'ALERT') return null;
  
  return (
    <button
      onClick={handleTrack}
      disabled={tracking}
      className="mt-2 px-3 py-1.5 rounded-lg bg-blue-500/20 text-blue-400 text-xs font-medium hover:bg-blue-500/30 transition disabled:opacity-50 flex items-center gap-1"
    >
      {tracking ? <><span className="w-3 h-3 border border-blue-400 border-t-transparent rounded-full animate-spin" /> Tracking...</> : <>📌 Track</>}
    </button>
  );
}

// ============================================================
// TRACKER TAB
// ============================================================
function TrackerTab() {
  const [trackerData, setTrackerData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  const fetchTrackerData = async () => {
    try {
      const res = await fetch('/api/tracker');
      if (res.ok) setTrackerData(await res.json());
    } catch {}
    setLoading(false);
  };
  
  useEffect(() => { fetchTrackerData(); }, []);
  
  const handleClose = async (id: string, status: string) => {
    await fetch('/api/tracker', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status }) });
    fetchTrackerData();
  };
  
  const handleDelete = async (id: string) => {
    await fetch(`/api/tracker?id=${id}`, { method: 'DELETE' });
    fetchTrackerData();
  };
  
  if (loading) return <LoadingSpinner />;
  
  if (!trackerData?.suggestions?.length) {
    return (
      <div className="text-center py-12">
        <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-slate-800/50 flex items-center justify-center"><span className="text-4xl">📊</span></div>
        <h3 className="text-lg font-semibold text-white mb-2">No Tracked Suggestions</h3>
        <p className="text-slate-400 text-sm">Click "Track" on any suggestion to monitor performance.</p>
      </div>
    );
  }
  
  const { suggestions, stats } = trackerData;
  
  // Calculate total portfolio P&L
  const totalPnL = suggestions.reduce((sum: number, s: any) => sum + (s.pnl || 0), 0);
  const totalInvested = suggestions.filter((s: any) => s.status === 'ACTIVE').reduce((sum: number, s: any) => sum + (s.totalInvested || 0), 0);
  
  return (
    <div className="space-y-6">
      {/* Portfolio Summary */}
      <div className="p-4 rounded-2xl border border-purple-500/30 bg-gradient-to-r from-purple-950/30 to-blue-950/20">
        <h3 className="text-sm text-slate-400 mb-2">Portfolio Performance</h3>
        <div className="flex items-baseline gap-4">
          <span className={`text-3xl font-bold ${totalPnL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {totalPnL >= 0 ? '+' : ''}${totalPnL.toFixed(2)}
          </span>
          <span className="text-slate-400 text-sm">
            (${totalInvested.toFixed(0)} invested in active positions)
          </span>
        </div>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <div className="p-4 rounded-xl border border-slate-700/50 bg-slate-800/30 text-center">
          <p className="text-xs text-slate-400">Total</p><p className="text-2xl font-bold text-white">{stats.total}</p>
        </div>
        <div className="p-4 rounded-xl border border-blue-500/30 bg-blue-500/5 text-center">
          <p className="text-xs text-slate-400">Active</p><p className="text-2xl font-bold text-blue-400">{stats.active}</p>
        </div>
        <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 text-center">
          <p className="text-xs text-slate-400">Winners</p><p className="text-2xl font-bold text-emerald-400">{stats.winners}</p>
        </div>
        <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/5 text-center">
          <p className="text-xs text-slate-400">Losers</p><p className="text-2xl font-bold text-red-400">{stats.losers}</p>
        </div>
        <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 text-center">
          <p className="text-xs text-slate-400">Win Rate</p><p className={`text-2xl font-bold ${stats.winRate >= 50 ? 'text-emerald-400' : 'text-red-400'}`}>{stats.winRate}%</p>
        </div>
        <div className="p-4 rounded-xl border border-purple-500/30 bg-purple-500/5 text-center">
          <p className="text-xs text-slate-400">Avg Return</p><p className={`text-2xl font-bold ${stats.avgReturn >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{stats.avgReturn >= 0 ? '+' : ''}{stats.avgReturn}%</p>
        </div>
      </div>
      
      <button onClick={fetchTrackerData} className="px-4 py-2 rounded-xl bg-slate-800/50 border border-slate-700/50 text-slate-300 text-sm">🔄 Refresh Prices</button>
      
      <div className="space-y-4">
        {suggestions.map((s: any) => (
          <div key={s.id} className={`p-4 rounded-xl border ${s.status === 'ACTIVE' ? (s.pnl >= 0 ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-red-500/30 bg-red-500/5') : 'border-slate-700/50 bg-slate-800/30'}`}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-bold text-lg font-mono text-white">{s.ticker}</span>
                  <span className={`text-xs px-2 py-0.5 rounded ${s.type.includes('BUY') || s.type === 'CALL' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>{s.type.replace('STOCK_', '')}</span>
                  <span className={`text-xs px-2 py-0.5 rounded ${s.status === 'ACTIVE' ? 'bg-blue-500/20 text-blue-400' : s.status === 'HIT_TARGET' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-500/20 text-slate-400'}`}>{s.status.replace('_', ' ')}</span>
                </div>
                <p className="text-sm text-slate-400">{s.strategy}</p>
                <p className="text-xs text-slate-500 mt-1">
                  {s.positionSize} {s.positionType?.toLowerCase() || 'shares'} • ${s.totalInvested?.toFixed(0) || '0'} invested
                </p>
              </div>
              <div className="text-right">
                {/* Dollar P&L - PRIMARY */}
                <p className={`text-2xl font-bold ${s.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {s.pnl >= 0 ? '+' : ''}${s.pnl?.toFixed(2) || '0.00'}
                </p>
                {/* Percentage P&L - SECONDARY */}
                <p className={`text-sm ${s.pnlPercent >= 0 ? 'text-emerald-400/70' : 'text-red-400/70'}`}>
                  {s.pnlPercent >= 0 ? '+' : ''}{s.pnlPercent?.toFixed(2) || '0.00'}%
                </p>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2 mb-3 text-xs">
              <div className="p-2 rounded bg-slate-800/50"><p className="text-slate-400">Entry</p><p className="font-bold text-white">${s.entryPrice?.toFixed(2)}</p></div>
              <div className="p-2 rounded bg-slate-800/50"><p className="text-slate-400">Current</p><p className={`font-bold ${s.currentPrice >= s.entryPrice ? 'text-emerald-400' : 'text-red-400'}`}>${s.currentPrice?.toFixed(2)}</p></div>
              <div className="p-2 rounded bg-slate-800/50"><p className="text-slate-400">Target</p><p className="font-bold text-emerald-400">${s.targetPrice?.toFixed(2) || 'N/A'}</p></div>
              <div className="p-2 rounded bg-slate-800/50"><p className="text-slate-400">Stop</p><p className="font-bold text-red-400">${s.stopLoss?.toFixed(2) || 'N/A'}</p></div>
            </div>
            {/* Option contract details */}
            {s.optionContract && (
              <div className="mb-3 p-2 rounded bg-slate-800/30 text-xs">
                <span className="text-slate-400">Option: </span>
                <span className="text-white">${s.optionContract.strike} {s.type}</span>
                <span className="text-slate-400"> exp </span>
                <span className="text-white">{s.optionContract.expiration}</span>
                <span className="text-slate-400"> ({s.optionContract.dte} DTE)</span>
                <span className="text-slate-400"> Δ </span>
                <span className="text-white">{s.optionContract.delta?.toFixed(2)}</span>
              </div>
            )}
            {s.status === 'ACTIVE' ? (
              <div className="flex gap-2">
                <button onClick={() => handleClose(s.id, 'HIT_TARGET')} className="flex-1 px-3 py-2 rounded-lg bg-emerald-500/20 text-emerald-400 text-xs hover:bg-emerald-500/30">✓ Hit Target</button>
                <button onClick={() => handleClose(s.id, 'STOPPED_OUT')} className="flex-1 px-3 py-2 rounded-lg bg-red-500/20 text-red-400 text-xs hover:bg-red-500/30">✗ Stopped Out</button>
                <button onClick={() => handleClose(s.id, 'CLOSED')} className="flex-1 px-3 py-2 rounded-lg bg-slate-500/20 text-slate-400 text-xs hover:bg-slate-500/30">Close</button>
              </div>
            ) : (
              <button onClick={() => handleDelete(s.id)} className="px-3 py-1.5 rounded-lg bg-slate-700/50 text-slate-400 text-xs hover:text-white">🗑️ Remove</button>
            )}
          </div>
        ))}
      </div>
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
function StockTab({ data, loading, onTrack }: { data: any; loading: boolean; onTrack?: (success: boolean, message: string) => void }) {
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

      {/* Chart Pattern Analysis - Shows ONE dominant pattern only */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">📐 Chart Pattern</h2>
          <details className="text-xs">
            <summary className="text-blue-400 cursor-pointer hover:text-blue-300">ℹ️ Info</summary>
            <div className="absolute right-0 mt-2 p-3 rounded-lg bg-slate-900 border border-slate-700 text-slate-400 w-64 z-10">
              <p className="mb-1"><strong className="text-emerald-400">CONFIRMED</strong> = Breakout occurred</p>
              <p><strong className="text-amber-400">FORMING</strong> = Waiting for breakout</p>
            </div>
          </details>
        </div>
        
        {/* Status Box */}
        <div className={`p-4 rounded-xl ${
          data.chartPatterns?.actionable 
            ? 'bg-emerald-500/10 border border-emerald-500/30' 
            : data.chartPatterns?.hasConflict
              ? 'bg-red-500/10 border border-red-500/30'
              : data.chartPatterns?.forming?.length > 0
                ? 'bg-amber-500/5 border border-amber-500/30'
                : 'bg-slate-800/30 border border-slate-700/30'
        }`}>
          <p className={`font-medium ${
            data.chartPatterns?.actionable ? 'text-emerald-400' : 
            data.chartPatterns?.hasConflict ? 'text-red-400' : 
            data.chartPatterns?.forming?.length > 0 ? 'text-amber-400' : 'text-slate-400'
          }`}>
            {data.chartPatterns?.summary || 'No clear pattern detected'}
          </p>
          
          {/* Show single confirmed pattern details */}
          {data.chartPatterns?.confirmed?.[0] && (
            <div className="mt-3 pt-3 border-t border-slate-700/50">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">{data.chartPatterns.confirmed[0].type === 'BULLISH' ? '📈' : '📉'}</span>
                <span className="font-bold text-white">{data.chartPatterns.confirmed[0].name}</span>
                <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
                  {data.chartPatterns.confirmed[0].confidence}%
                </span>
              </div>
              {data.chartPatterns.confirmed[0].statusReason && (
                <p className="text-xs text-emerald-300 mb-2">✓ {data.chartPatterns.confirmed[0].statusReason}</p>
              )}
              <div className="grid grid-cols-3 gap-2 text-xs">
                {data.chartPatterns.confirmed[0].target && (
                  <div className="p-2 rounded bg-slate-800/50">
                    <p className="text-slate-400">Target</p>
                    <p className="font-bold text-emerald-400">{data.chartPatterns.confirmed[0].target}</p>
                  </div>
                )}
                {data.chartPatterns.confirmed[0].stopLoss && (
                  <div className="p-2 rounded bg-slate-800/50">
                    <p className="text-slate-400">Stop</p>
                    <p className="font-bold text-red-400">{data.chartPatterns.confirmed[0].stopLoss}</p>
                  </div>
                )}
                {(data.chartPatterns.confirmed[0].upside || data.chartPatterns.confirmed[0].downside) && (
                  <div className="p-2 rounded bg-slate-800/50">
                    <p className="text-slate-400">{data.chartPatterns.confirmed[0].upside ? 'Upside' : 'Downside'}</p>
                    <p className={`font-bold ${data.chartPatterns.confirmed[0].upside ? 'text-emerald-400' : 'text-red-400'}`}>
                      {data.chartPatterns.confirmed[0].upside || data.chartPatterns.confirmed[0].downside}%
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* Show single forming pattern details */}
          {!data.chartPatterns?.confirmed?.length && data.chartPatterns?.forming?.[0] && (
            <div className="mt-3 pt-3 border-t border-slate-700/50">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">{data.chartPatterns.forming[0].type === 'BULLISH' ? '📈' : '📉'}</span>
                <span className="font-bold text-white">{data.chartPatterns.forming[0].name}</span>
                <span className="text-xs px-2 py-0.5 rounded bg-amber-500/20 text-amber-400">
                  {data.chartPatterns.forming[0].confidence}%
                </span>
              </div>
              {data.chartPatterns.forming[0].statusReason && (
                <p className="text-xs text-amber-300 mb-1">⏳ {data.chartPatterns.forming[0].statusReason}</p>
              )}
              {data.chartPatterns.forming[0].target && (
                <p className="text-xs text-slate-400">Target on breakout: {data.chartPatterns.forming[0].target}</p>
              )}
            </div>
          )}
        </div>
        
        {/* Pattern impact on suggestion */}
        {data.chartPatterns?.patternBonus !== 0 && data.chartPatterns?.patternBonus !== undefined && (
          <p className={`mt-3 text-xs ${data.chartPatterns.patternBonus > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {data.chartPatterns.patternBonus > 0 ? '✓' : '⚠️'} {data.chartPatterns.patternBonus > 0 ? '+' : ''}{data.chartPatterns.patternBonus}% confidence adjustment
          </p>
        )}
      </div>

      {/* Suggestions */}
      <div className="card p-5">
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
              
              {/* Track Button */}
              {onTrack && <TrackButton ticker={data.ticker} suggestion={sug} entryPrice={data.price} onTrack={onTrack} />}
              
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

      {/* Trust Score & Analysis Quality */}
      {data.verification && (
        <div className="p-5 rounded-2xl border border-cyan-500/30 bg-gradient-to-br from-cyan-950/20 to-blue-950/10">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-cyan-400">🎯 Should You Trust This Analysis?</h3>
          </div>
          
          {/* Main Trust Score */}
          <div className={`p-4 rounded-xl mb-4 ${
            data.verification.completenessScore >= 80 && data.verification.signalAlignment.agreementCount >= 4 
              ? 'bg-emerald-500/10 border border-emerald-500/30' 
              : data.verification.completenessScore >= 60 && data.verification.signalAlignment.agreementCount >= 3
              ? 'bg-amber-500/10 border border-amber-500/30'
              : 'bg-red-500/10 border border-red-500/30'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-white font-bold text-lg">
                {data.verification.completenessScore >= 80 && data.verification.signalAlignment.agreementCount >= 4 
                  ? '✅ HIGH CONFIDENCE' 
                  : data.verification.completenessScore >= 60 && data.verification.signalAlignment.agreementCount >= 3
                  ? '⚠️ MODERATE CONFIDENCE'
                  : '❌ LOW CONFIDENCE - DO MORE RESEARCH'}
              </span>
              <span className={`text-2xl font-bold ${
                data.verification.completenessScore >= 80 ? 'text-emerald-400' :
                data.verification.completenessScore >= 60 ? 'text-amber-400' : 'text-red-400'
              }`}>{data.verification.completenessScore}%</span>
            </div>
            <p className="text-sm text-slate-300">
              {data.verification.completenessScore >= 80 && data.verification.signalAlignment.agreementCount >= 4 
                ? 'Strong data quality + multiple indicators agree. This analysis is well-supported.'
                : data.verification.completenessScore >= 60 && data.verification.signalAlignment.agreementCount >= 3
                ? 'Decent data but some signals conflict. Consider smaller position size.'
                : 'Missing data or conflicting signals. Not recommended for real money without further research.'}
            </p>
          </div>

          {/* What the indicators are telling us */}
          <div className="mb-4">
            <h4 className="text-sm font-semibold text-white mb-3">📊 What Are 5 Independent Sources Saying?</h4>
            <div className="space-y-2">
              {/* Fundamentals */}
              <div className={`flex items-center justify-between p-2 rounded-lg ${data.verification.signalAlignment.details?.fundamentalsBullish ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
                <div className="flex items-center gap-2">
                  <span className={`text-lg ${data.verification.signalAlignment.details?.fundamentalsBullish ? 'text-emerald-400' : 'text-red-400'}`}>
                    {data.verification.signalAlignment.details?.fundamentalsBullish ? '✓' : '✗'}
                  </span>
                  <div>
                    <p className="text-sm text-white font-medium">Company Fundamentals</p>
                    <p className="text-xs text-slate-400">P/E, ROE, debt levels, profit margins</p>
                  </div>
                </div>
                <span className={`text-xs px-2 py-1 rounded ${data.verification.signalAlignment.details?.fundamentalsBullish ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                  {data.verification.signalAlignment.details?.fundamentalsBullish ? 'BULLISH' : 'BEARISH'}
                </span>
              </div>
              
              {/* Technicals */}
              <div className={`flex items-center justify-between p-2 rounded-lg ${data.verification.signalAlignment.details?.technicalsBullish ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
                <div className="flex items-center gap-2">
                  <span className={`text-lg ${data.verification.signalAlignment.details?.technicalsBullish ? 'text-emerald-400' : 'text-red-400'}`}>
                    {data.verification.signalAlignment.details?.technicalsBullish ? '✓' : '✗'}
                  </span>
                  <div>
                    <p className="text-sm text-white font-medium">Price Action & Technicals</p>
                    <p className="text-xs text-slate-400">Trend, RSI, moving averages, support/resistance</p>
                  </div>
                </div>
                <span className={`text-xs px-2 py-1 rounded ${data.verification.signalAlignment.details?.technicalsBullish ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                  {data.verification.signalAlignment.details?.technicalsBullish ? 'BULLISH' : 'BEARISH'}
                </span>
              </div>
              
              {/* News */}
              <div className={`flex items-center justify-between p-2 rounded-lg ${data.verification.signalAlignment.details?.newsBullish ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
                <div className="flex items-center gap-2">
                  <span className={`text-lg ${data.verification.signalAlignment.details?.newsBullish ? 'text-emerald-400' : 'text-red-400'}`}>
                    {data.verification.signalAlignment.details?.newsBullish ? '✓' : '✗'}
                  </span>
                  <div>
                    <p className="text-sm text-white font-medium">Recent News Sentiment</p>
                    <p className="text-xs text-slate-400">Headlines from past 7 days analyzed</p>
                  </div>
                </div>
                <span className={`text-xs px-2 py-1 rounded ${data.verification.signalAlignment.details?.newsBullish ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                  {data.verification.signalAlignment.details?.newsBullish ? 'BULLISH' : 'BEARISH'}
                </span>
              </div>
              
              {/* Analysts */}
              <div className={`flex items-center justify-between p-2 rounded-lg ${data.verification.signalAlignment.details?.analystsBullish ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
                <div className="flex items-center gap-2">
                  <span className={`text-lg ${data.verification.signalAlignment.details?.analystsBullish ? 'text-emerald-400' : 'text-red-400'}`}>
                    {data.verification.signalAlignment.details?.analystsBullish ? '✓' : '✗'}
                  </span>
                  <div>
                    <p className="text-sm text-white font-medium">Wall Street Analysts</p>
                    <p className="text-xs text-slate-400">Buy/sell ratings from professional analysts</p>
                  </div>
                </div>
                <span className={`text-xs px-2 py-1 rounded ${data.verification.signalAlignment.details?.analystsBullish ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                  {data.verification.signalAlignment.details?.analystsBullish ? 'BULLISH' : 'BEARISH'}
                </span>
              </div>
              
              {/* Insiders */}
              <div className={`flex items-center justify-between p-2 rounded-lg ${data.verification.signalAlignment.details?.insidersBullish ? 'bg-emerald-500/10' : 'bg-slate-500/10'}`}>
                <div className="flex items-center gap-2">
                  <span className={`text-lg ${data.verification.signalAlignment.details?.insidersBullish ? 'text-emerald-400' : 'text-slate-400'}`}>
                    {data.verification.signalAlignment.details?.insidersBullish ? '✓' : '—'}
                  </span>
                  <div>
                    <p className="text-sm text-white font-medium">Insider Activity</p>
                    <p className="text-xs text-slate-400">Executives buying or selling shares</p>
                  </div>
                </div>
                <span className={`text-xs px-2 py-1 rounded ${data.verification.signalAlignment.details?.insidersBullish ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-500/20 text-slate-400'}`}>
                  {data.verification.signalAlignment.details?.insidersBullish ? 'BUYING' : 'NEUTRAL/SELLING'}
                </span>
              </div>
              
              {/* NEW: Chart Patterns */}
              <div className={`flex items-center justify-between p-2 rounded-lg ${
                data.verification.signalAlignment.details?.patternsConflict ? 'bg-red-500/10' :
                data.verification.signalAlignment.details?.patternsBullish ? 'bg-emerald-500/10' :
                data.verification.signalAlignment.details?.patternsBearish ? 'bg-red-500/10' :
                'bg-slate-500/10'
              }`}>
                <div className="flex items-center gap-2">
                  <span className={`text-lg ${
                    data.verification.signalAlignment.details?.patternsConflict ? 'text-red-400' :
                    data.verification.signalAlignment.details?.patternsBullish ? 'text-emerald-400' :
                    data.verification.signalAlignment.details?.patternsBearish ? 'text-red-400' :
                    'text-slate-400'
                  }`}>
                    {data.verification.signalAlignment.details?.patternsConflict ? '⚠' :
                     data.verification.signalAlignment.details?.patternsBullish ? '✓' :
                     data.verification.signalAlignment.details?.patternsBearish ? '✗' : '—'}
                  </span>
                  <div>
                    <p className="text-sm text-white font-medium">Chart Patterns</p>
                    <p className="text-xs text-slate-400">Cup & Handle, H&S, Double Top/Bottom</p>
                  </div>
                </div>
                <span className={`text-xs px-2 py-1 rounded ${
                  data.verification.signalAlignment.details?.patternsConflict ? 'bg-red-500/20 text-red-400' :
                  data.verification.signalAlignment.details?.patternsBullish ? 'bg-emerald-500/20 text-emerald-400' :
                  data.verification.signalAlignment.details?.patternsBearish ? 'bg-red-500/20 text-red-400' :
                  'bg-slate-500/20 text-slate-400'
                }`}>
                  {data.verification.signalAlignment.details?.patternsConflict ? 'CONFLICT ⚠️' :
                   data.verification.signalAlignment.details?.patternsBullish ? 'BULLISH (Confirmed)' :
                   data.verification.signalAlignment.details?.patternsBearish ? 'BEARISH (Confirmed)' :
                   'NO PATTERN'}
                </span>
              </div>
            </div>
            
            {/* Pattern Trust Box */}
            {data.verification.patternTrust && (
              <div className={`mt-3 p-3 rounded-lg border ${
                data.verification.patternTrust.trustLevel.startsWith('HIGH') ? 'border-emerald-500/30 bg-emerald-500/5' :
                data.verification.patternTrust.trustLevel.startsWith('MEDIUM') ? 'border-amber-500/30 bg-amber-500/5' :
                data.verification.patternTrust.trustLevel.startsWith('LOW') ? 'border-red-500/30 bg-red-500/5' :
                'border-slate-700/30 bg-slate-800/30'
              }`}>
                <p className="text-xs text-slate-400 mb-1">📐 Pattern Analysis Trust:</p>
                <p className={`text-sm font-medium ${
                  data.verification.patternTrust.trustLevel.startsWith('HIGH') ? 'text-emerald-400' :
                  data.verification.patternTrust.trustLevel.startsWith('MEDIUM') ? 'text-amber-400' :
                  data.verification.patternTrust.trustLevel.startsWith('LOW') ? 'text-red-400' :
                  'text-slate-300'
                }`}>
                  {data.verification.patternTrust.trustLevel}
                </p>
                {data.verification.patternTrust.hasConfirmedPatterns && (
                  <p className="text-xs text-slate-400 mt-1">
                    Highest pattern confidence: {data.verification.patternTrust.highestConfidence}%
                  </p>
                )}
              </div>
            )}
            
            <div className="mt-3 p-2 rounded-lg bg-slate-800/50 text-center">
              <span className="text-sm text-white font-bold">
                {data.verification.signalAlignment.agreementCount}/{data.verification.signalAlignment.totalSignals || 6} indicators agree
              </span>
              <span className="text-sm text-slate-400"> → </span>
              <span className={`text-sm font-bold ${
                data.verification.signalAlignment.aligned === 'STRONG' ? 'text-emerald-400' :
                data.verification.signalAlignment.aligned === 'MODERATE' ? 'text-blue-400' :
                data.verification.signalAlignment.aligned === 'CONFLICTING' ? 'text-amber-400' :
                'text-red-400'
              }`}>
                {data.verification.signalAlignment.aligned === 'STRONG' ? 'Strong consensus! ✓' :
                 data.verification.signalAlignment.aligned === 'MODERATE' ? 'Moderate consensus' :
                 data.verification.signalAlignment.aligned === 'CONFLICTING' ? 'Mixed signals ⚠️' :
                 'Weak/No consensus ⚠️'}
              </span>
            </div>
          </div>
          
          {/* Bottom Line */}
          <div className="p-3 rounded-lg bg-slate-800/70 border border-slate-700">
            <p className="text-sm font-medium text-white mb-1">💡 Bottom Line:</p>
            <p className="text-sm text-slate-300">
              {data.verification.completenessScore >= 80 && data.verification.signalAlignment.agreementCount >= 4 
                ? `This analysis has ${data.verification.completenessScore}% data completeness with ${data.verification.signalAlignment.agreementCount}/5 indicators in agreement. The recommendation is well-supported - suitable for trading with proper risk management.`
                : data.verification.completenessScore >= 60 && data.verification.signalAlignment.agreementCount >= 3
                ? `Data is ${data.verification.completenessScore}% complete with ${data.verification.signalAlignment.agreementCount}/5 indicators agreeing. Consider a smaller position or wait for more confirmation before committing capital.`
                : `Only ${data.verification.completenessScore}% data completeness and ${data.verification.signalAlignment.agreementCount}/5 indicator agreement. NOT RECOMMENDED for real money. Do additional research or wait for better setup.`}
            </p>
          </div>
          
          {/* Expandable Details */}
          <details className="mt-3 text-xs">
            <summary className="text-slate-500 cursor-pointer hover:text-slate-400">📋 View data sources & limitations</summary>
            <div className="mt-2 p-2 rounded bg-slate-800/50 space-y-2">
              <div>
                <p className="text-slate-400 font-medium">Data Sources:</p>
                <p className="text-slate-500">• Price: {data.dataSource === 'schwab' ? 'Schwab (real-time)' : 'Finnhub'}</p>
                <p className="text-slate-500">• Fundamentals: Finnhub (quarterly reports)</p>
                <p className="text-slate-500">• News: Finnhub (last 7 days)</p>
                <p className="text-slate-500">• Analysts: Finnhub (latest consensus)</p>
              </div>
              <div>
                <p className="text-slate-400 font-medium">Important Limitations:</p>
                <ul className="text-slate-500">
                  <li>• Fundamentals may be 1-3 months old</li>
                  <li>• News sentiment is AI-analyzed, not human-reviewed</li>
                  <li>• Analyst ratings can lag market conditions</li>
                  <li>• Past performance ≠ future results</li>
                </ul>
              </div>
            </div>
          </details>
        </div>
      )}

      <p className="text-xs text-center text-slate-500">
        Updated: {data.lastUpdated ? new Date(data.lastUpdated).toLocaleString() : 'N/A'} • Source: {data.dataSource} • {data.responseTimeMs}ms
      </p>
    </div>
  );
}

// ============================================================
// OPTIONS TAB
// ============================================================
function OptionsTab({ data, loading, onTrack }: { data: any; loading: boolean; onTrack?: (success: boolean, message: string) => void }) {
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
                          entryPrice: data.currentPrice,
                          confidence: u.score || 70,
                          reasoning: u.signals || [],
                          optionContract: {
                            strike: u.contract?.strike || u.strike,
                            expiration: u.contract?.expiration || u.expiration || 'N/A',
                            dte: u.contract?.dte || u.dte,
                            delta: u.contract?.delta || 0.5,
                            entryAsk: u.contract?.ask || u.contract?.mark || 1.00,
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
// POPULAR TICKERS
// ============================================================
const POPULAR_TICKERS = [
  { symbol: 'AAPL', name: 'Apple' },
  { symbol: 'NVDA', name: 'NVIDIA' },
  { symbol: 'MSFT', name: 'Microsoft' },
  { symbol: 'GOOGL', name: 'Google' },
  { symbol: 'AMZN', name: 'Amazon' },
  { symbol: 'META', name: 'Meta' },
  { symbol: 'TSLA', name: 'Tesla' },
  { symbol: 'AMD', name: 'AMD' },
  { symbol: 'NFLX', name: 'Netflix' },
  { symbol: 'JPM', name: 'JPMorgan' },
  { symbol: 'SPY', name: 'S&P 500 ETF' },
  { symbol: 'QQQ', name: 'Nasdaq ETF' },
  { symbol: 'IWM', name: 'Russell 2000' },
  { symbol: 'GLD', name: 'Gold ETF' },
  { symbol: 'TLT', name: 'Treasury ETF' },
];

// ============================================================
// MAIN APP
// ============================================================
export default function Home() {
  const [ticker, setTicker] = useState('');
  const [searchedTicker, setSearchedTicker] = useState('');
  const [activeTab, setActiveTab] = useState<'stocks' | 'options' | 'tracker'>('stocks');
  const [stockData, setStockData] = useState<any>(null);
  const [optionsData, setOptionsData] = useState<any>(null);
  const [loadingStock, setLoadingStock] = useState(false);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [trackMessage, setTrackMessage] = useState<{ success: boolean; text: string } | null>(null);

  const handleTrack = (success: boolean, message: string) => {
    setTrackMessage({ success, text: message });
    setTimeout(() => setTrackMessage(null), 3000);
  };

  const handleSearch = async (sym?: string) => {
    const searchSym = (sym || ticker).toUpperCase().trim();
    if (!searchSym) return;
    setTicker(searchSym);
    setSearchedTicker(searchSym);
    setLoadingStock(true);
    setLoadingOptions(true);
    try {
      const [stockRes, optionsRes] = await Promise.all([fetch(`/api/stock/${searchSym}`), fetch(`/api/options/${searchSym}`)]);
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

        {/* Search Input */}
        <div className="mb-4 flex gap-3">
          <input type="text" value={ticker} onChange={(e) => setTicker(e.target.value.toUpperCase())} onKeyPress={(e) => e.key === 'Enter' && handleSearch()} placeholder="Enter ticker symbol..." className="flex-1 px-4 py-3 rounded-xl bg-slate-800/50 border border-slate-700/50 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 font-mono" />
          <button onClick={() => handleSearch()} disabled={loadingStock || !ticker.trim()} className="px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-blue-600 hover:from-emerald-500 hover:to-blue-500 text-white font-medium disabled:opacity-50">{loadingStock ? 'Analyzing...' : 'Analyze'}</button>
        </div>

        {/* Popular Tickers */}
        <div className="mb-6">
          <p className="text-xs text-slate-500 mb-2">📌 Popular:</p>
          <div className="flex flex-wrap gap-2">
            {POPULAR_TICKERS.map((t) => (
              <button
                key={t.symbol}
                onClick={() => handleSearch(t.symbol)}
                disabled={loadingStock}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  searchedTicker === t.symbol 
                    ? 'bg-blue-500/30 text-blue-300 border border-blue-500/50' 
                    : 'bg-slate-800/50 text-slate-400 hover:text-white hover:bg-slate-700/50 border border-slate-700/50'
                }`}
              >
                <span className="font-mono font-bold">{t.symbol}</span>
                <span className="text-slate-500 ml-1 hidden sm:inline">{t.name}</span>
              </button>
            ))}
          </div>
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
            <button onClick={() => setActiveTab('tracker')} className={`px-5 py-2.5 rounded-xl font-medium transition ${activeTab === 'tracker' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'text-slate-400 hover:text-white bg-slate-800/30'}`}>📌 Tracker</button>
          </div>
          {searchedTicker && activeTab !== 'tracker' && <button onClick={handleRefresh} disabled={loadingStock || loadingOptions} className="px-4 py-2 rounded-xl bg-slate-800/50 border border-slate-700/50 text-slate-300 hover:text-white text-sm flex items-center gap-2 disabled:opacity-50"><span className={loadingStock || loadingOptions ? 'animate-spin' : ''}>🔄</span> Refresh</button>}
        </div>

        {/* Track Message Toast */}
        {trackMessage && (
          <div className={`mb-4 p-3 rounded-xl text-sm font-medium animate-fadeIn ${trackMessage.success ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}>
            {trackMessage.text}
          </div>
        )}

        {activeTab === 'stocks' && <StockTab data={stockData} loading={loadingStock} onTrack={handleTrack} />}
        {activeTab === 'options' && <OptionsTab data={optionsData} loading={loadingOptions} onTrack={handleTrack} />}
        {activeTab === 'tracker' && <TrackerTab />}

        <div className="mt-8 p-4 rounded-xl bg-slate-800/20 border border-slate-700/30">
          <p className="text-xs text-slate-500 text-center">⚠️ Educational purposes only. Not financial advice. Data: Schwab, Finnhub</p>
        </div>
      </div>
    </div>
  );
}
