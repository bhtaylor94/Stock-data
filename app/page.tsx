'use client';
import React, { useState, useEffect, useCallback } from 'react';

// ============================================================
// ELITE TRADING DASHBOARD - Complete UI Overhaul
// ============================================================

function LoadingSpinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = { sm: 'w-4 h-4', md: 'w-8 h-8', lg: 'w-12 h-12' };
  return (
    <div className="flex items-center justify-center py-8">
      <div className={`${sizeClasses[size]} border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin`} />
    </div>
  );
}

function Badge({ children, variant = 'default', size = 'sm' }: { children: React.ReactNode; variant?: string; size?: string }) {
  const variants: Record<string, string> = {
    default: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
    success: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    warning: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    danger: 'bg-red-500/20 text-red-400 border-red-500/30',
    info: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    bullish: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40',
    bearish: 'bg-red-500/15 text-red-400 border-red-500/40',
  };
  const sizes: Record<string, string> = { xs: 'px-1.5 py-0.5 text-[10px]', sm: 'px-2 py-0.5 text-xs', md: 'px-3 py-1 text-sm' };
  return <span className={`inline-flex items-center font-medium rounded-full border ${variants[variant] || variants.default} ${sizes[size] || sizes.sm}`}>{children}</span>;
}

function Card({ children, className = '', variant = 'default', glow = false }: { children: React.ReactNode; className?: string; variant?: string; glow?: boolean }) {
  const variants: Record<string, string> = {
    default: 'border-slate-700/50 bg-slate-900/50',
    success: 'border-emerald-500/30 bg-emerald-500/5',
    warning: 'border-amber-500/30 bg-amber-500/5',
    danger: 'border-red-500/30 bg-red-500/5',
  };
  return (
    <div className={`rounded-2xl border backdrop-blur-sm transition-all duration-200 ${variants[variant] || variants.default} ${glow ? 'shadow-lg shadow-blue-500/5' : ''} ${className}`}>
      {children}
    </div>
  );
}

function StatBox({ label, value, trend, icon }: { label: string; value: string | number; trend?: 'up' | 'down' | 'neutral'; icon?: string }) {
  const trendColors: Record<string, string> = { up: 'text-emerald-400', down: 'text-red-400', neutral: 'text-slate-300' };
  return (
    <div className="p-3 rounded-xl bg-slate-800/30 border border-slate-700/30">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-slate-500 uppercase tracking-wide">{label}</span>
        {icon && <span className="text-sm">{icon}</span>}
      </div>
      <p className={`text-lg font-bold ${trend ? trendColors[trend] : 'text-white'}`}>{value}</p>
    </div>
  );
}

function ProgressBar({ value, max = 100, color = 'blue' }: { value: number; max?: number; color?: string }) {
  const percentage = Math.min(100, (value / max) * 100);
  const colors: Record<string, string> = { blue: 'bg-blue-500', green: 'bg-emerald-500', red: 'bg-red-500', amber: 'bg-amber-500' };
  return (
    <div className="h-1.5 bg-slate-700/50 rounded-full overflow-hidden mt-2">
      <div className={`h-full ${colors[color] || colors.blue} rounded-full transition-all duration-500`} style={{ width: `${percentage}%` }} />
    </div>
  );
}

function TrackButton({ ticker, suggestion, entryPrice, onTrack, variant = 'default' }: any) {
  const [tracking, setTracking] = useState(false);
  
  const handleTrack = async () => {
    setTracking(true);
    try {
      const trackData: any = {
        ticker,
        type: suggestion.type === 'BUY' ? 'STOCK_BUY' : suggestion.type === 'SELL' ? 'STOCK_SELL' : suggestion.type,
        strategy: suggestion.strategy,
        entryPrice,
        confidence: suggestion.confidence || 0,
        reasoning: suggestion.reasoning || [],
      };
      if (suggestion.contract) {
        trackData.optionContract = { strike: suggestion.contract.strike, expiration: suggestion.contract.expiration, dte: suggestion.contract.dte, delta: suggestion.contract.delta, entryAsk: suggestion.contract.ask };
      }
      if (['BUY', 'STOCK_BUY', 'CALL'].includes(suggestion.type)) {
        trackData.targetPrice = Math.round(entryPrice * 1.10 * 100) / 100;
        trackData.stopLoss = Math.round(entryPrice * 0.95 * 100) / 100;
      } else if (['SELL', 'STOCK_SELL', 'PUT'].includes(suggestion.type)) {
        trackData.targetPrice = Math.round(entryPrice * 0.90 * 100) / 100;
        trackData.stopLoss = Math.round(entryPrice * 1.05 * 100) / 100;
      }
      const res = await fetch('/api/tracker', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(trackData) });
      const result = await res.json();
      onTrack(result.success, result.success ? `✓ Tracking ${ticker}` : result.error);
    } catch { onTrack(false, 'Network error'); }
    setTracking(false);
  };
  
  if (suggestion.type === 'ALERT') return null;
  
  if (variant === 'full') {
    return (
      <button onClick={handleTrack} disabled={tracking}
        className="w-full mt-3 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600/20 to-cyan-600/20 text-blue-400 text-sm font-medium border border-blue-500/30 hover:from-blue-600/30 hover:to-cyan-600/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
        {tracking ? <><span className="w-4 h-4 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" /> Adding...</> : <>📊 Track This Trade</>}
      </button>
    );
  }
  return (
    <button onClick={handleTrack} disabled={tracking}
      className="px-3 py-1.5 rounded-lg bg-blue-500/10 text-blue-400 text-xs font-medium hover:bg-blue-500/20 border border-blue-500/20 transition-all disabled:opacity-50">
      {tracking ? '...' : '📌 Track'}
    </button>
  );
}

// ============================================================
// TRACKER TAB
// ============================================================
function TrackerTab() {
  const [trackerData, setTrackerData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  const fetchData = async () => {
    try {
      const res = await fetch('/api/tracker');
      setTrackerData(await res.json());
    } catch (e) { console.error(e); }
    setLoading(false);
  };
  
  useEffect(() => { fetchData(); }, []);
  
  const handleClose = async (id: string, outcome: string) => {
    await fetch('/api/tracker', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, outcome }) });
    fetchData();
  };
  
  if (loading) return <LoadingSpinner />;
  
  const active = trackerData?.active || [];
  const closed = trackerData?.closed || [];
  const stats = trackerData?.stats || {};
  const totalPnl = active.reduce((s: number, p: any) => s + (p.pnl || 0), 0);
  const totalInvested = active.reduce((s: number, p: any) => s + (p.totalInvested || 0), 0);
  
  return (
    <div className="space-y-6">
      <Card className="p-5" glow>
        <div className="flex items-center justify-between mb-4">
          <div><h2 className="text-lg font-bold text-white">Portfolio Overview</h2><p className="text-xs text-slate-500">Track performance</p></div>
          <button onClick={() => { setLoading(true); fetchData(); }} className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-sm hover:bg-slate-700 border border-slate-700">🔄 Refresh</button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-700/50">
            <p className="text-xs text-slate-500 uppercase mb-1">Total P&L</p>
            <p className={`text-2xl font-bold ${totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(2)}</p>
          </div>
          <div className="p-4 rounded-xl bg-slate-800/30 border border-slate-700/30"><p className="text-xs text-slate-500 uppercase mb-1">Invested</p><p className="text-2xl font-bold text-white">${totalInvested.toFixed(0)}</p></div>
          <div className="p-4 rounded-xl bg-slate-800/30 border border-slate-700/30"><p className="text-xs text-slate-500 uppercase mb-1">Win Rate</p><p className="text-2xl font-bold text-white">{stats.winRate || 0}%</p></div>
          <div className="p-4 rounded-xl bg-slate-800/30 border border-slate-700/30"><p className="text-xs text-slate-500 uppercase mb-1">Active</p><p className="text-2xl font-bold text-blue-400">{active.length}</p></div>
        </div>
      </Card>
      
      <Card className="p-5">
        <h3 className="text-md font-semibold text-white mb-4 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />Active Positions</h3>
        {active.length === 0 ? <p className="text-center py-8 text-slate-500">No active positions</p> : (
          <div className="space-y-3">
            {active.map((p: any) => (
              <div key={p.id} className={`p-4 rounded-xl border ${(p.pnl || 0) >= 0 ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3"><span className="text-lg font-bold text-white">{p.ticker}</span><Badge variant={p.type?.includes('BUY') || p.type === 'CALL' ? 'bullish' : 'bearish'}>{p.type}</Badge></div>
                  <div className="text-right"><p className={`text-lg font-bold ${(p.pnl || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{(p.pnl || 0) >= 0 ? '+' : ''}${(p.pnl || 0).toFixed(2)}</p><p className="text-xs text-slate-500">{(p.pnlPercent || 0).toFixed(2)}%</p></div>
                </div>
                <div className="grid grid-cols-4 gap-3 text-xs mb-3">
                  <div><p className="text-slate-500">Entry</p><p className="text-white">${p.entryPrice?.toFixed(2)}</p></div>
                  <div><p className="text-slate-500">Current</p><p className="text-white">${p.currentPrice?.toFixed(2)}</p></div>
                  <div><p className="text-slate-500">Size</p><p className="text-white">{p.positionSize} {p.positionType?.toLowerCase()}</p></div>
                  <div><p className="text-slate-500">Invested</p><p className="text-white">${p.totalInvested?.toFixed(0)}</p></div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleClose(p.id, 'WIN')} className="flex-1 py-2 rounded-lg bg-emerald-500/10 text-emerald-400 text-xs hover:bg-emerald-500/20 border border-emerald-500/20">✓ Win</button>
                  <button onClick={() => handleClose(p.id, 'LOSS')} className="flex-1 py-2 rounded-lg bg-red-500/10 text-red-400 text-xs hover:bg-red-500/20 border border-red-500/20">✗ Loss</button>
                  <button onClick={() => handleClose(p.id, 'BREAKEVEN')} className="flex-1 py-2 rounded-lg bg-slate-500/10 text-slate-400 text-xs hover:bg-slate-500/20 border border-slate-500/20">○ Even</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
      
      {closed.length > 0 && (
        <Card className="p-5">
          <h3 className="text-md font-semibold text-white mb-4">📜 History</h3>
          <div className="space-y-2">
            {closed.slice(0, 5).map((p: any) => (
              <div key={p.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-800/30">
                <div className="flex items-center gap-3"><span className="text-white">{p.ticker}</span><Badge size="xs">{p.type}</Badge></div>
                <Badge variant={p.outcome === 'WIN' ? 'success' : p.outcome === 'LOSS' ? 'danger' : 'default'}>{p.outcome}</Badge>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

// ============================================================
// STOCK TAB - Elite Design
// ============================================================
function StockTab({ data, loading, onTrack }: { data: any; loading: boolean; onTrack?: (success: boolean, message: string) => void }) {
  if (loading) return <LoadingSpinner />;
  if (!data) return <div className="text-center py-16"><div className="text-5xl mb-4">📈</div><p className="text-slate-400 text-lg">Enter a ticker symbol to analyze</p><p className="text-xs text-slate-600 mt-2">Get comprehensive AI-powered stock analysis</p></div>;
  if (data.error) return <Card variant="danger" className="p-6"><h3 className="text-lg font-semibold text-red-400">⚠️ {data.error}</h3>{data.details && <p className="text-sm text-red-300/70 mt-2">{data.details}</p>}</Card>;

  const { analysis, suggestions, fundamentalScore, technicalScore, trustScore } = data;
  const price = data.price || data.currentPrice;
  const change = data.change || 0;
  const changePercent = data.changePercent || 0;

  return (
    <div className="space-y-6">
      {/* Price Header */}
      <Card className="p-6" glow>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold text-white">{data.ticker}</h1>
              <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /><span className="text-xs text-emerald-400 font-medium">LIVE</span></div>
            </div>
            <div className="flex items-baseline gap-3">
              <span className="text-4xl font-bold text-white">${price?.toFixed(2)}</span>
              <span className={`text-lg font-semibold ${change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{change >= 0 ? '+' : ''}{change?.toFixed(2)} ({changePercent >= 0 ? '+' : ''}{changePercent?.toFixed(2)}%)</span>
            </div>
          </div>
          <div className={`px-6 py-3 rounded-2xl text-center ${analysis?.combined?.rating === 'STRONG_BUY' ? 'bg-emerald-500/20 border-2 border-emerald-500/50' : analysis?.combined?.rating === 'BUY' ? 'bg-emerald-500/10 border border-emerald-500/30' : analysis?.combined?.rating?.includes('SELL') ? 'bg-red-500/10 border border-red-500/30' : 'bg-amber-500/10 border border-amber-500/30'}`}>
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">AI Rating</p>
            <p className={`text-xl font-bold ${analysis?.combined?.rating?.includes('BUY') ? 'text-emerald-400' : analysis?.combined?.rating?.includes('SELL') ? 'text-red-400' : 'text-amber-400'}`}>{analysis?.combined?.rating?.replace('_', ' ') || 'ANALYZING'}</p>
          </div>
        </div>
      </Card>
      
      {/* Score Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Fundamental</p>
          <div className="flex items-end justify-between"><span className="text-3xl font-bold text-white">{fundamentalScore?.score || 0}</span><span className="text-sm text-slate-500">/{fundamentalScore?.maxScore || 9}</span></div>
          <ProgressBar value={fundamentalScore?.score || 0} max={fundamentalScore?.maxScore || 9} color={fundamentalScore?.score >= 6 ? 'green' : fundamentalScore?.score >= 4 ? 'amber' : 'red'} />
        </Card>
        <Card className="p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Technical</p>
          <div className="flex items-end justify-between"><span className="text-3xl font-bold text-white">{technicalScore?.score || 0}</span><span className="text-sm text-slate-500">/{technicalScore?.maxScore || 9}</span></div>
          <ProgressBar value={technicalScore?.score || 0} max={technicalScore?.maxScore || 9} color={technicalScore?.score >= 6 ? 'green' : technicalScore?.score >= 4 ? 'amber' : 'red'} />
        </Card>
        <Card className="p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Trust Score</p>
          <div className="flex items-end justify-between"><span className="text-3xl font-bold text-white">{trustScore?.score || 0}</span><span className="text-sm text-slate-500">/{trustScore?.maxScore || 6}</span></div>
          <ProgressBar value={trustScore?.score || 0} max={trustScore?.maxScore || 6} color="blue" />
        </Card>
        <Card className="p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Confidence</p>
          <div className="flex items-end justify-between"><span className="text-3xl font-bold text-white">{analysis?.combined?.confidence || 0}</span><span className="text-sm text-slate-500">%</span></div>
          <ProgressBar value={analysis?.combined?.confidence || 0} max={100} color={analysis?.combined?.confidence >= 70 ? 'green' : analysis?.combined?.confidence >= 50 ? 'amber' : 'red'} />
        </Card>
      </div>
      
      {/* Chart Pattern Analysis */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">📐 Chart Pattern Analysis</h2>
          {data.chartPatterns?.dominantPattern && <Badge variant={data.chartPatterns.dominantDirection === 'BULLISH' ? 'bullish' : data.chartPatterns.dominantDirection === 'BEARISH' ? 'bearish' : 'default'}>{data.chartPatterns.dominantDirection}</Badge>}
        </div>
        
        {/* Pattern Status Box */}
        <div className={`p-4 rounded-xl mb-4 ${data.chartPatterns?.actionable ? 'bg-gradient-to-r from-emerald-500/10 to-emerald-500/5 border border-emerald-500/30' : data.chartPatterns?.hasConflict ? 'bg-gradient-to-r from-red-500/10 to-red-500/5 border border-red-500/30' : data.chartPatterns?.forming?.length > 0 ? 'bg-gradient-to-r from-amber-500/10 to-amber-500/5 border border-amber-500/30' : 'bg-slate-800/30 border border-slate-700/30'}`}>
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl">{data.chartPatterns?.actionable ? '✅' : data.chartPatterns?.hasConflict ? '⚠️' : data.chartPatterns?.forming?.length > 0 ? '⏳' : '📊'}</span>
            <p className={`font-semibold ${data.chartPatterns?.actionable ? 'text-emerald-400' : data.chartPatterns?.hasConflict ? 'text-red-400' : data.chartPatterns?.forming?.length > 0 ? 'text-amber-400' : 'text-slate-300'}`}>{data.chartPatterns?.summary || 'No clear pattern detected'}</p>
          </div>
        </div>
        
        {/* Confirmed Pattern */}
        {data.chartPatterns?.confirmed?.[0] && (
          <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20 mb-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{data.chartPatterns.confirmed[0].type === 'BULLISH' ? '🟢' : '🔴'}</span>
                <div>
                  <h3 className="font-bold text-white text-lg">{data.chartPatterns.confirmed[0].name}</h3>
                  <div className="flex gap-2 mt-1">
                    <Badge variant={data.chartPatterns.confirmed[0].type === 'BULLISH' ? 'bullish' : 'bearish'} size="xs">{data.chartPatterns.confirmed[0].type}</Badge>
                    <Badge variant="info" size="xs">CONFIRMED</Badge>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-emerald-400">{data.chartPatterns.confirmed[0].confidence}%</p>
                <p className="text-xs text-slate-500">confidence</p>
              </div>
            </div>
            {data.chartPatterns.confirmed[0].statusReason && <p className="text-sm text-emerald-300 mb-3">✓ {data.chartPatterns.confirmed[0].statusReason}</p>}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {data.chartPatterns.confirmed[0].target && <div className="p-3 rounded-lg bg-slate-800/50"><p className="text-xs text-slate-500 mb-1">Price Target</p><p className="text-lg font-bold text-emerald-400">{data.chartPatterns.confirmed[0].target}</p></div>}
              {data.chartPatterns.confirmed[0].stopLoss && <div className="p-3 rounded-lg bg-slate-800/50"><p className="text-xs text-slate-500 mb-1">Stop Loss</p><p className="text-lg font-bold text-red-400">{data.chartPatterns.confirmed[0].stopLoss}</p></div>}
              {(data.chartPatterns.confirmed[0].upside || data.chartPatterns.confirmed[0].downside) && <div className="p-3 rounded-lg bg-slate-800/50"><p className="text-xs text-slate-500 mb-1">{data.chartPatterns.confirmed[0].upside ? 'Potential Upside' : 'Potential Downside'}</p><p className={`text-lg font-bold ${data.chartPatterns.confirmed[0].upside ? 'text-emerald-400' : 'text-red-400'}`}>{data.chartPatterns.confirmed[0].upside || data.chartPatterns.confirmed[0].downside}%</p></div>}
              {data.chartPatterns.confirmed[0].successRate && <div className="p-3 rounded-lg bg-slate-800/50"><p className="text-xs text-slate-500 mb-1">Historical Success</p><p className="text-lg font-bold text-blue-400">{data.chartPatterns.confirmed[0].successRate}</p></div>}
            </div>
          </div>
        )}
        
        {/* Forming Pattern */}
        {!data.chartPatterns?.confirmed?.length && data.chartPatterns?.forming?.[0] && (
          <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{data.chartPatterns.forming[0].type === 'BULLISH' ? '🟡' : '🟠'}</span>
                <div>
                  <h3 className="font-bold text-white text-lg">{data.chartPatterns.forming[0].name}</h3>
                  <div className="flex gap-2 mt-1">
                    <Badge variant={data.chartPatterns.forming[0].type === 'BULLISH' ? 'bullish' : 'bearish'} size="xs">{data.chartPatterns.forming[0].type}</Badge>
                    <Badge variant="warning" size="xs">FORMING</Badge>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-amber-400">{data.chartPatterns.forming[0].confidence}%</p>
                <p className="text-xs text-slate-500">confidence</p>
              </div>
            </div>
            {data.chartPatterns.forming[0].statusReason && <p className="text-sm text-amber-300 mb-3">⏳ {data.chartPatterns.forming[0].statusReason}</p>}
            <div className="grid grid-cols-2 gap-3">
              {data.chartPatterns.forming[0].target && <div className="p-3 rounded-lg bg-slate-800/50"><p className="text-xs text-slate-500 mb-1">Target on Breakout</p><p className="text-lg font-bold text-white">{data.chartPatterns.forming[0].target}</p></div>}
              {data.chartPatterns.forming[0].successRate && <div className="p-3 rounded-lg bg-slate-800/50"><p className="text-xs text-slate-500 mb-1">Historical Success</p><p className="text-lg font-bold text-blue-400">{data.chartPatterns.forming[0].successRate}</p></div>}
            </div>
            <p className="text-xs text-slate-500 mt-3">💡 Wait for price to break the key level before acting on this pattern.</p>
          </div>
        )}
        
        {!data.chartPatterns?.confirmed?.length && !data.chartPatterns?.forming?.length && !data.chartPatterns?.hasConflict && (
          <p className="text-sm text-slate-500 text-center py-4">No clear chart patterns detected in recent price action</p>
        )}
      </Card>
      
      {/* Recommendations */}
      <Card className="p-5">
        <h2 className="text-lg font-semibold text-white mb-4">💡 AI Recommendations</h2>
        <div className="space-y-4">
          {suggestions?.map((sug: any, i: number) => (
            <div key={i} className={`p-4 rounded-xl border transition-all ${sug.type === 'BUY' ? 'bg-emerald-500/5 border-emerald-500/30' : sug.type === 'SELL' ? 'bg-red-500/5 border-red-500/30' : sug.type === 'HOLD' ? 'bg-amber-500/5 border-amber-500/30' : 'bg-slate-800/30 border-slate-700/30'}`}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{sug.type === 'BUY' ? '📈' : sug.type === 'SELL' ? '📉' : sug.type === 'HOLD' ? '⏸️' : '⚠️'}</span>
                  <div>
                    <h3 className="font-semibold text-white">{sug.strategy}</h3>
                    <Badge variant={sug.type === 'BUY' ? 'success' : sug.type === 'SELL' ? 'danger' : 'warning'} size="xs">{sug.type}</Badge>
                  </div>
                </div>
                {sug.confidence > 0 && <div className="text-right"><p className="text-xl font-bold text-white">{sug.confidence}%</p><p className="text-xs text-slate-500">confidence</p></div>}
              </div>
              {sug.detailedExplanation?.summary && <p className="text-sm text-slate-300 mb-3">{sug.detailedExplanation.summary}</p>}
              {sug.reasoning?.length > 0 && <div className="space-y-1 mb-3">{sug.reasoning.slice(0, 3).map((r: string, j: number) => <p key={j} className="text-xs text-slate-400">• {r}</p>)}</div>}
              {onTrack && sug.type !== 'ALERT' && <TrackButton ticker={data.ticker} suggestion={sug} entryPrice={price} onTrack={onTrack} variant="full" />}
            </div>
          ))}
        </div>
      </Card>
      
      {/* Key Metrics */}
      <Card className="p-5">
        <h2 className="text-lg font-semibold text-white mb-4">📊 Key Metrics</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatBox label="52W High" value={`$${data.high52Week?.toFixed(2) || 'N/A'}`} icon="📈" />
          <StatBox label="52W Low" value={`$${data.low52Week?.toFixed(2) || 'N/A'}`} icon="📉" />
          <StatBox label="Support" value={`$${data.support?.toFixed(2) || 'N/A'}`} icon="🛡️" />
          <StatBox label="Resistance" value={`$${data.resistance?.toFixed(2) || 'N/A'}`} icon="🚧" />
        </div>
      </Card>
      
      <p className="text-xs text-center text-slate-600">Data: {data.dataSource} • Updated: {new Date(data.lastUpdated).toLocaleString()} • {data.responseTimeMs}ms</p>
    </div>
  );
}

// ============================================================
// OPTIONS TAB - Elite Design
// ============================================================
function OptionsTab({ data, loading, onTrack }: { data: any; loading: boolean; onTrack?: (success: boolean, message: string) => void }) {
  const [selectedExp, setSelectedExp] = useState<string>('');
  const [showCalls, setShowCalls] = useState(true);
  
  useEffect(() => { if (data?.expirations?.length > 0 && !selectedExp) setSelectedExp(data.expirations[0]); }, [data, selectedExp]);

  if (loading) return <LoadingSpinner />;
  if (!data) return <div className="text-center py-16"><div className="text-5xl mb-4">📊</div><p className="text-slate-400 text-lg">Enter a ticker to view options</p><p className="text-xs text-slate-600 mt-2">Analyze unusual activity and smart money flow</p></div>;
  if (data.error) return <Card variant="danger" className="p-6"><h3 className="text-lg font-semibold text-red-400">⚠️ {data.error}</h3></Card>;

  const currentChain = data.byExpiration?.[selectedExp] || { calls: [], puts: [] };
  const options = showCalls ? currentChain.calls : currentChain.puts;

  return (
    <div className="space-y-6">
      {/* Live Banner */}
      <Card className="p-4" glow>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3"><span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" /><span className="text-sm font-medium text-emerald-400">LIVE OPTIONS DATA</span><Badge variant="info">Schwab</Badge></div>
          <span className="text-xs text-slate-500">{data.responseTimeMs}ms</span>
        </div>
      </Card>
      
      {/* Unusual Options Activity */}
      {data.unusualActivity?.length > 0 && (
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">🔥 Unusual Options Activity</h2>
            <Badge variant="warning">{data.unusualActivity.length} detected</Badge>
          </div>
          <div className="space-y-4">
            {data.unusualActivity.slice(0, 5).map((u: any, i: number) => (
              <div key={i} className={`p-4 rounded-xl border ${u.sentiment === 'BULLISH' ? 'bg-emerald-500/5 border-emerald-500/30' : 'bg-red-500/5 border-red-500/30'}`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-lg font-bold text-white">${u.strike} {u.type?.toUpperCase()}</span>
                    <Badge variant="default">{u.expiration || `${u.dte}d`}</Badge>
                    <Badge variant={u.sentiment === 'BULLISH' ? 'bullish' : 'bearish'}>{u.sentiment}</Badge>
                  </div>
                  <Badge variant={u.convictionLevel === 'HIGH' ? 'warning' : 'default'} size="xs">{u.convictionLevel}</Badge>
                </div>
                
                {/* Trade Type */}
                <div className={`p-3 rounded-lg mb-3 ${u.tradeType === 'DIRECTIONAL' ? 'bg-blue-500/10 border border-blue-500/20' : u.tradeType === 'LIKELY_HEDGE' ? 'bg-purple-500/10 border border-purple-500/20' : 'bg-slate-800/50'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{u.tradeType === 'DIRECTIONAL' ? '🎯' : u.tradeType === 'LIKELY_HEDGE' ? '🛡️' : '❓'}</span>
                      <span className={`font-semibold ${u.tradeType === 'DIRECTIONAL' ? 'text-blue-400' : u.tradeType === 'LIKELY_HEDGE' ? 'text-purple-400' : 'text-slate-300'}`}>
                        {u.tradeType === 'DIRECTIONAL' ? 'Directional Bet' : u.tradeType === 'LIKELY_HEDGE' ? 'Likely Hedge' : 'Uncertain'}
                      </span>
                    </div>
                    {u.insiderProbability && u.insiderProbability !== 'UNLIKELY' && <Badge variant={u.insiderProbability === 'HIGH' ? 'danger' : 'warning'} size="xs">🔍 {u.insiderProbability} Insider Prob</Badge>}
                  </div>
                  {u.tradeTypeReason && <p className="text-xs text-slate-400 mt-1">{u.tradeTypeReason}</p>}
                </div>
                
                {/* Stats */}
                <div className="grid grid-cols-5 gap-2 mb-3">
                  <div className="p-2 rounded-lg bg-slate-800/50 text-center"><p className="text-[10px] text-slate-500 uppercase">Volume</p><p className="text-sm font-bold text-amber-400">{u.volume?.toLocaleString()}</p></div>
                  <div className="p-2 rounded-lg bg-slate-800/50 text-center"><p className="text-[10px] text-slate-500 uppercase">Open Int</p><p className="text-sm font-bold text-white">{u.openInterest?.toLocaleString()}</p></div>
                  <div className="p-2 rounded-lg bg-slate-800/50 text-center"><p className="text-[10px] text-slate-500 uppercase">Vol/OI</p><p className="text-sm font-bold text-orange-400">{u.volumeOIRatio?.toFixed(1)}x</p></div>
                  <div className="p-2 rounded-lg bg-slate-800/50 text-center"><p className="text-[10px] text-slate-500 uppercase">DTE</p><p className="text-sm font-bold text-white">{u.dte}d</p></div>
                  <div className="p-2 rounded-lg bg-slate-800/50 text-center"><p className="text-[10px] text-slate-500 uppercase">Premium</p><p className="text-sm font-bold text-emerald-400">{u.premiumFormatted}</p></div>
                </div>
                
                {u.signals?.length > 0 && <div className="flex flex-wrap gap-1 mb-3">{u.signals.slice(0, 4).map((s: string, j: number) => <span key={j} className="px-2 py-1 rounded-md bg-slate-800/70 text-xs text-slate-300">{s}</span>)}</div>}
                
                {onTrack && (
                  <button onClick={async () => {
                    const res = await fetch('/api/tracker', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
                      ticker: data.ticker, type: u.type?.toUpperCase(), strategy: `UOA: $${u.strike} ${u.type?.toUpperCase()} ${u.expiration || ''} (${u.tradeType || 'Unknown'})`,
                      entryPrice: data.currentPrice, confidence: u.score || 70, reasoning: u.signals || [],
                      optionContract: { strike: u.strike, expiration: u.expiration || 'N/A', dte: u.dte, delta: u.delta || 0.5, entryAsk: u.ask || 1.00 }
                    })});
                    const result = await res.json();
                    onTrack(res.ok, result.message || result.error);
                  }} className="w-full py-2.5 rounded-xl bg-gradient-to-r from-orange-500/10 to-amber-500/10 text-orange-400 text-sm font-medium border border-orange-500/30 hover:from-orange-500/20 hover:to-amber-500/20">
                    📊 Track This Activity
                  </button>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}
      
      {/* Options Suggestions */}
      {data.suggestions?.filter((s: any) => s.type !== 'ALERT').length > 0 && (
        <Card className="p-5">
          <h2 className="text-lg font-semibold text-white mb-4">💡 Options Trade Ideas</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {data.suggestions.filter((s: any) => s.type !== 'ALERT').slice(0, 4).map((sug: any, i: number) => (
              <div key={i} className={`p-4 rounded-xl border ${sug.type === 'CALL' ? 'bg-emerald-500/5 border-emerald-500/30' : 'bg-red-500/5 border-red-500/30'}`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2"><span className="text-xl">{sug.type === 'CALL' ? '📈' : '📉'}</span><span className="font-semibold text-white">{sug.strategy}</span></div>
                  {sug.score && <span className={`text-lg font-bold ${sug.score.total >= 8 ? 'text-emerald-400' : 'text-amber-400'}`}>{sug.score.total}/12</span>}
                </div>
                {sug.contract && (
                  <div className="grid grid-cols-4 gap-2 mb-3">
                    <div className="p-2 rounded-lg bg-slate-800/50 text-center"><p className="text-[10px] text-slate-500">Strike</p><p className="text-sm font-bold text-white">${sug.contract.strike}</p></div>
                    <div className="p-2 rounded-lg bg-slate-800/50 text-center"><p className="text-[10px] text-slate-500">Delta</p><p className={`text-sm font-bold ${sug.contract.delta > 0 ? 'text-emerald-400' : 'text-red-400'}`}>{sug.contract.delta?.toFixed(2)}</p></div>
                    <div className="p-2 rounded-lg bg-slate-800/50 text-center"><p className="text-[10px] text-slate-500">DTE</p><p className="text-sm font-bold text-white">{sug.contract.dte}d</p></div>
                    <div className="p-2 rounded-lg bg-slate-800/50 text-center"><p className="text-[10px] text-slate-500">Ask</p><p className="text-sm font-bold text-white">${sug.contract.ask?.toFixed(2)}</p></div>
                  </div>
                )}
                {sug.score && (
                  <div className="flex gap-1 mb-3 flex-wrap">
                    <span className={`px-2 py-1 rounded text-xs ${sug.score.delta >= 1 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700/50 text-slate-500'}`}>Δ {sug.score.delta}</span>
                    <span className={`px-2 py-1 rounded text-xs ${sug.score.iv >= 1 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700/50 text-slate-500'}`}>IV {sug.score.iv}</span>
                    <span className={`px-2 py-1 rounded text-xs ${sug.score.liquidity >= 1 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700/50 text-slate-500'}`}>Liq {sug.score.liquidity}</span>
                    <span className={`px-2 py-1 rounded text-xs ${sug.score.unusual >= 1 ? 'bg-orange-500/20 text-orange-400' : 'bg-slate-700/50 text-slate-500'}`}>UOA {sug.score.unusual}</span>
                  </div>
                )}
                {sug.reasoning?.slice(0, 2).map((r: string, j: number) => <p key={j} className="text-xs text-slate-400 mb-1">• {r}</p>)}
                {onTrack && <TrackButton ticker={data.ticker} suggestion={sug} entryPrice={data.currentPrice} onTrack={onTrack} variant="full" />}
              </div>
            ))}
          </div>
        </Card>
      )}
      
      {/* Market Context */}
      <Card className="p-5">
        <h2 className="text-lg font-semibold text-white mb-4">📈 Market Context</h2>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <StatBox label="Trend" value={data.technicals?.trend || 'N/A'} trend={data.technicals?.trend === 'BULLISH' ? 'up' : data.technicals?.trend === 'BEARISH' ? 'down' : 'neutral'} />
          <StatBox label="RSI" value={data.technicals?.rsi || 50} />
          <StatBox label="IV Rank" value={`${data.ivAnalysis?.ivRank || 50}%`} />
          <StatBox label="P/C Ratio" value={data.metrics?.putCallRatio?.toFixed(2) || '1.00'} />
          <StatBox label="Max Pain" value={`$${data.metrics?.maxPain || 'N/A'}`} />
          <StatBox label="Sentiment" value={data.metrics?.sentiment || 'N/A'} trend={data.metrics?.sentiment === 'BULLISH' ? 'up' : data.metrics?.sentiment === 'BEARISH' ? 'down' : 'neutral'} />
        </div>
      </Card>
      
      {/* Options Chain */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">📋 Options Chain</h2>
          <div className="flex gap-2">
            <button onClick={() => setShowCalls(true)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${showCalls ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800/50 text-slate-400 border border-slate-700/30 hover:bg-slate-700/50'}`}>Calls</button>
            <button onClick={() => setShowCalls(false)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${!showCalls ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-slate-800/50 text-slate-400 border border-slate-700/30 hover:bg-slate-700/50'}`}>Puts</button>
          </div>
        </div>
        <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
          {data.expirations?.slice(0, 6).map((exp: string) => (
            <button key={exp} onClick={() => setSelectedExp(exp)} className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${selectedExp === exp ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-slate-800/50 text-slate-400 border border-slate-700/30 hover:bg-slate-700/50'}`}>{exp}</button>
          ))}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-xs text-slate-500 uppercase border-b border-slate-700/50"><th className="text-left py-2 px-3">Strike</th><th className="text-right py-2 px-3">Bid</th><th className="text-right py-2 px-3">Ask</th><th className="text-right py-2 px-3">Volume</th><th className="text-right py-2 px-3">OI</th><th className="text-right py-2 px-3">Delta</th><th className="text-right py-2 px-3">IV</th></tr></thead>
            <tbody>
              {options?.slice(0, 10).map((opt: any, i: number) => (
                <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                  <td className="py-2 px-3 font-medium text-white">${opt.strike}</td>
                  <td className="text-right py-2 px-3 text-slate-300">${opt.bid?.toFixed(2)}</td>
                  <td className="text-right py-2 px-3 text-slate-300">${opt.ask?.toFixed(2)}</td>
                  <td className="text-right py-2 px-3 text-amber-400">{opt.volume?.toLocaleString()}</td>
                  <td className="text-right py-2 px-3 text-slate-400">{opt.openInterest?.toLocaleString()}</td>
                  <td className={`text-right py-2 px-3 ${opt.delta > 0 ? 'text-emerald-400' : 'text-red-400'}`}>{opt.delta?.toFixed(2)}</td>
                  <td className="text-right py-2 px-3 text-slate-300">{(opt.iv * 100)?.toFixed(0)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ============================================================
// MAIN APP COMPONENT
// ============================================================
export default function TradingDashboard() {
  const [ticker, setTicker] = useState('');
  const [inputValue, setInputValue] = useState('');
  const [activeTab, setActiveTab] = useState<'stock' | 'options' | 'tracker'>('stock');
  const [stockData, setStockData] = useState<any>(null);
  const [optionsData, setOptionsData] = useState<any>(null);
  const [loading, setLoading] = useState({ stock: false, options: false });
  const [toast, setToast] = useState<{ show: boolean; message: string; type: 'success' | 'error' }>({ show: false, message: '', type: 'success' });

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3000);
  };

  const fetchData = useCallback(async (symbol: string) => {
    if (!symbol) return;
    setLoading({ stock: true, options: true });
    
    try {
      const stockRes = await fetch(`/api/stock/${symbol}`);
      setStockData(await stockRes.json());
    } catch (e) { setStockData({ error: 'Failed to fetch' }); }
    setLoading(prev => ({ ...prev, stock: false }));
    
    try {
      const optionsRes = await fetch(`/api/options/${symbol}`);
      setOptionsData(await optionsRes.json());
    } catch (e) { setOptionsData({ error: 'Failed to fetch' }); }
    setLoading(prev => ({ ...prev, options: false }));
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const symbol = inputValue.toUpperCase().trim();
    if (symbol) { setTicker(symbol); fetchData(symbol); }
  };

  return (
    <div className="min-h-screen relative">
      {/* Grid Background */}
      <div className="fixed inset-0 z-0">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(30,41,59,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(30,41,59,0.05)_1px,transparent_1px)] bg-[size:50px_50px]" />
        <div className="absolute inset-0 bg-gradient-to-b from-blue-500/5 via-transparent to-transparent" />
      </div>
      
      <div className="relative z-10 max-w-6xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2"><span className="bg-gradient-to-r from-blue-400 via-cyan-400 to-emerald-400 bg-clip-text text-transparent">AI Trading Dashboard</span></h1>
          <p className="text-sm text-slate-500">Real-time analysis • Smart money tracking • AI-powered insights</p>
        </div>
        
        {/* Search */}
        <form onSubmit={handleSubmit} className="mb-6">
          <div className="flex gap-3 max-w-xl mx-auto">
            <input type="text" value={inputValue} onChange={(e) => setInputValue(e.target.value.toUpperCase())} placeholder="Enter ticker (e.g., AAPL)"
              className="flex-1 px-5 py-3.5 rounded-2xl bg-slate-900/80 border border-slate-700/50 text-white placeholder-slate-500 text-lg font-medium focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all backdrop-blur-sm" />
            <button type="submit" disabled={loading.stock || loading.options}
              className="px-8 py-3.5 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-semibold text-lg hover:from-blue-500 hover:to-cyan-500 disabled:opacity-50 transition-all shadow-lg shadow-blue-500/20">
              {loading.stock || loading.options ? <span className="flex items-center gap-2"><span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Analyzing</span> : 'Analyze'}
            </button>
          </div>
        </form>
        
        {/* Tabs */}
        <div className="flex justify-center gap-2 mb-6">
          {(['stock', 'options', 'tracker'] as const).map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-6 py-2.5 rounded-xl text-sm font-medium transition-all ${activeTab === tab ? 'bg-gradient-to-r from-blue-600/20 to-cyan-600/20 text-blue-400 border border-blue-500/30 shadow-lg shadow-blue-500/10' : 'bg-slate-900/50 text-slate-400 border border-slate-700/30 hover:bg-slate-800/50'}`}>
              {tab === 'stock' && '📈 '}{tab === 'options' && '📊 '}{tab === 'tracker' && '📋 '}{tab.charAt(0).toUpperCase() + tab.slice(1)}{tab === 'stock' && ticker && ` • ${ticker}`}
            </button>
          ))}
        </div>
        
        {/* Content */}
        <div className="animate-fadeIn">
          {activeTab === 'stock' && <StockTab data={stockData} loading={loading.stock} onTrack={(s, m) => showToast(m, s ? 'success' : 'error')} />}
          {activeTab === 'options' && <OptionsTab data={optionsData} loading={loading.options} onTrack={(s, m) => showToast(m, s ? 'success' : 'error')} />}
          {activeTab === 'tracker' && <TrackerTab />}
        </div>
        
        {/* Toast */}
        {toast.show && <div className={`fixed bottom-6 right-6 px-5 py-3 rounded-xl shadow-lg z-50 ${toast.type === 'success' ? 'bg-emerald-500/90 text-white' : 'bg-red-500/90 text-white'}`}>{toast.message}</div>}
        
        {/* Footer */}
        <p className="text-center text-xs text-slate-600 mt-8">⚠️ For informational purposes only. Not financial advice.</p>
      </div>
    </div>
  );
}
