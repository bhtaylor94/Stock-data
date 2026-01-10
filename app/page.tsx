'use client';
import React, { useState, useEffect } from 'react';

// ============================================================
// AI HEDGE FUND v2.0 - PROFESSIONAL TRADING DASHBOARD
// Features: Setup Registry, Evidence Verification, Calibration
// ============================================================

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="w-12 h-12 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

// ============================================================
// EVIDENCE HASH DISPLAY
// ============================================================
function EvidenceHashCard({ evidencePacket }: { evidencePacket?: any }) {
  const [showFull, setShowFull] = useState(false);
  
  if (!evidencePacket || !evidencePacket.hash) return null;
  
  const hash = evidencePacket.hash;
  const shortHash = `${hash.slice(0, 8)}...${hash.slice(-8)}`;
  const checks = evidencePacket.checks || [];
  const passedChecks = checks.filter((c: any) => c.pass).length;
  const totalChecks = checks.length;
  
  return (
    <div className="mt-4 p-4 rounded-xl bg-gradient-to-br from-purple-500/10 to-blue-500/10 border border-purple-500/30">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🔐</span>
          <div>
            <h4 className="text-sm font-semibold text-purple-300">Evidence Verified</h4>
            <p className="text-xs text-slate-400">Cryptographically secured</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-400">Verification</p>
          <p className="text-sm font-bold text-emerald-400">{passedChecks}/{totalChecks} Passed</p>
        </div>
      </div>
      
      <div className="bg-slate-900/50 rounded-lg p-3 font-mono text-xs">
        <div className="flex items-center justify-between">
          <span className="text-slate-400">SHA-256:</span>
          <button
            onClick={() => setShowFull(!showFull)}
            className="text-blue-400 hover:text-blue-300 transition"
          >
            {showFull ? 'Hide' : 'Show'} Full
          </button>
        </div>
        <p className="text-purple-300 mt-1 break-all">
          {showFull ? hash : shortHash}
        </p>
      </div>
      
      {checks.length > 0 && (
        <div className="mt-3 space-y-1">
          {checks.map((check: any, i: number) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span className={check.pass ? 'text-emerald-400' : 'text-red-400'}>
                {check.pass ? '✓' : '✗'}
              </span>
              <span className="text-slate-300">{check.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// SETUP CARD - Shows active trading playbook
// ============================================================
function SetupCard({ setup, entry, stop, targets, regime }: any) {
  if (!setup) return null;
  
  const setupColors: Record<string, string> = {
    'Trend Continuation Bull': 'from-emerald-500/20 to-green-500/20 border-emerald-500/40',
    'Mean Reversion Bounce': 'from-blue-500/20 to-cyan-500/20 border-blue-500/40',
    'Breakout Momentum': 'from-orange-500/20 to-yellow-500/20 border-orange-500/40',
    'Trend Continuation Bear': 'from-red-500/20 to-rose-500/20 border-red-500/40',
    'Mean Reversion Fade': 'from-purple-500/20 to-pink-500/20 border-purple-500/40',
    'Range Rotation': 'from-yellow-500/20 to-amber-500/20 border-yellow-500/40',
  };
  
  const colorClass = setupColors[setup] || 'from-slate-500/20 to-slate-600/20 border-slate-500/40';
  
  return (
    <div className={`p-4 rounded-xl bg-gradient-to-br ${colorClass} border`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">📊</span>
            <h3 className="font-bold text-lg text-white">{setup}</h3>
          </div>
          {regime && (
            <p className="text-xs text-slate-400">
              Market Regime: <span className="text-blue-300 font-semibold">{regime}</span>
            </p>
          )}
        </div>
      </div>
      
      <div className="grid grid-cols-3 gap-3 mt-3">
        {entry && (
          <div className="bg-slate-900/40 rounded-lg p-2">
            <p className="text-xs text-slate-400 mb-1">Entry</p>
            <p className="text-sm font-bold text-emerald-400">{entry}</p>
          </div>
        )}
        {stop && (
          <div className="bg-slate-900/40 rounded-lg p-2">
            <p className="text-xs text-slate-400 mb-1">Stop</p>
            <p className="text-sm font-bold text-red-400">{stop}</p>
          </div>
        )}
        {targets && targets.length > 0 && (
          <div className="bg-slate-900/40 rounded-lg p-2">
            <p className="text-xs text-slate-400 mb-1">Target</p>
            <p className="text-sm font-bold text-blue-400">{targets[0]}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// CALIBRATION METRICS CARD
// ============================================================
function CalibrationCard() {
  const [calibration, setCalibration] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    fetch('/api/calibration')
      .then(res => res.json())
      .then(data => {
        setCalibration(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);
  
  if (loading) return <LoadingSpinner />;
  if (!calibration || calibration.realizedCount === 0) {
    return (
      <div className="p-6 rounded-xl bg-slate-800/40 border border-slate-700/50 text-center">
        <p className="text-slate-400">No calibration data yet</p>
        <p className="text-xs text-slate-500 mt-1">Track positions to build calibration history</p>
      </div>
    );
  }
  
  const { byBucket, bySetup, realizedCount } = calibration;
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <span>📈</span> Forecast Accuracy
        </h3>
        <span className="text-sm text-slate-400">{realizedCount} positions analyzed</span>
      </div>
      
      {/* By Confidence Bucket */}
      <div className="grid grid-cols-3 gap-3">
        {['HIGH', 'MED', 'LOW'].map(bucket => {
          const data = byBucket[bucket];
          if (!data || data.count === 0) return null;
          
          const winRate = (data.winRate * 100).toFixed(0);
          const avgPnl = data.avgPnlPct.toFixed(1);
          
          const colorClass = 
            bucket === 'HIGH' ? 'border-emerald-500/40 bg-emerald-500/10' :
            bucket === 'MED' ? 'border-blue-500/40 bg-blue-500/10' :
            'border-yellow-500/40 bg-yellow-500/10';
          
          return (
            <div key={bucket} className={`p-3 rounded-lg border ${colorClass}`}>
              <p className="text-xs text-slate-400 mb-1">{bucket} Confidence</p>
              <p className="text-2xl font-bold text-white">{winRate}%</p>
              <p className="text-xs text-slate-400 mt-1">
                {data.count} trades • {avgPnl}% avg
              </p>
            </div>
          );
        })}
      </div>
      
      {/* Top Setups */}
      {Object.keys(bySetup).length > 0 && (
        <div className="bg-slate-800/40 rounded-xl p-4 border border-slate-700/50">
          <h4 className="text-sm font-semibold text-slate-300 mb-3">Performance by Setup</h4>
          <div className="space-y-2">
            {Object.entries(bySetup)
              .sort(([,a]: any, [,b]: any) => b.winRate - a.winRate)
              .slice(0, 5)
              .map(([name, data]: [string, any]) => (
                <div key={name} className="flex items-center justify-between text-xs">
                  <span className="text-slate-300 truncate max-w-[200px]">{name}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-slate-400">{data.count} trades</span>
                    <span className="text-emerald-400 font-semibold">
                      {(data.winRate * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// MAIN DASHBOARD
// ============================================================
export default function Dashboard() {
  const [ticker, setTicker] = useState('');
  const [searchedTicker, setSearchedTicker] = useState('');
  const [stockData, setStockData] = useState<any>(null);
  const [optionsData, setOptionsData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'analysis' | 'options' | 'tracker' | 'calibration'>('analysis');
  const [trackMessage, setTrackMessage] = useState('');
  
  const handleSearch = async () => {
    if (!ticker.trim()) return;
    
    setLoading(true);
    setSearchedTicker(ticker.toUpperCase());
    setStockData(null);
    setOptionsData(null);
    
    try {
      const [stockRes, optionsRes] = await Promise.all([
        fetch(`/api/stock/${ticker.toUpperCase()}`),
        fetch(`/api/options/${ticker.toUpperCase()}`)
      ]);
      
      if (stockRes.ok) setStockData(await stockRes.json());
      if (optionsRes.ok) setOptionsData(await optionsRes.json());
    } catch (err) {
      console.error('Search error:', err);
    }
    
    setLoading(false);
  };
  
  const handleTrack = async (suggestion: any, entryPrice: number) => {
    try {
      const trackData: any = {
        ticker: searchedTicker,
        type: suggestion.type,
        strategy: suggestion.strategy || suggestion.setup || 'Unknown',
        setup: suggestion.setup,
        regime: stockData?.meta?.regime,
        entryPrice,
        targetPrice: suggestion.targets?.[0] ? parseFloat(suggestion.targets[0].replace('$', '')) : entryPrice * 1.10,
        stopLoss: suggestion.stop ? parseFloat(suggestion.stop.replace('$', '').split(' ')[0]) : entryPrice * 0.95,
        confidence: suggestion.confidence || 0,
        reasoning: suggestion.reasoning || [],
        evidencePacket: suggestion.evidencePacket,
      };
      
      const res = await fetch('/api/tracker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(trackData),
      });
      
      const result = await res.json();
      setTrackMessage(result.success ? `✓ Tracking ${searchedTicker}` : result.error);
      setTimeout(() => setTrackMessage(''), 3000);
    } catch {
      setTrackMessage('Error tracking position');
      setTimeout(() => setTrackMessage(''), 3000);
    }
  };
  
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 relative overflow-hidden">
      {/* Enhanced Grid Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0" 
          style={{
            backgroundImage: `
              linear-gradient(rgba(255, 255, 255, 0.02) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255, 255, 255, 0.02) 1px, transparent 1px)
            `,
            backgroundSize: '50px 50px',
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-purple-500/5" />
        <div className="absolute top-0 left-0 right-0 h-96 bg-gradient-to-b from-blue-500/10 to-transparent" />
      </div>
      
      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-4xl">🧠</span>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                AI Hedge Fund
              </h1>
              <p className="text-sm text-slate-400">Professional Trading Analysis Platform v2.0</p>
            </div>
          </div>
        </div>
        
        {/* Search Bar */}
        <div className="mb-6">
          <div className="flex gap-3">
            <input
              type="text"
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Enter ticker symbol (e.g., AAPL, TSLA, NVDA)..."
              className="flex-1 px-4 py-3 rounded-xl bg-slate-800/60 border border-slate-700/50 focus:border-blue-500/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition"
            />
            <button
              onClick={handleSearch}
              disabled={loading}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Analyzing...' : 'Analyze'}
            </button>
          </div>
          {trackMessage && (
            <div className="mt-2 px-4 py-2 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-sm">
              {trackMessage}
            </div>
          )}
        </div>
        
        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto">
          {[
            { id: 'analysis', label: 'Analysis', icon: '📊' },
            { id: 'options', label: 'Options', icon: '📈' },
            { id: 'tracker', label: 'Tracker', icon: '📌' },
            { id: 'calibration', label: 'Calibration', icon: '🎯' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 rounded-lg font-medium transition whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-blue-500/20 border border-blue-500/40 text-blue-300'
                  : 'bg-slate-800/40 border border-slate-700/30 text-slate-400 hover:text-slate-300'
              }`}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
        
        {/* Tab Content */}
        {activeTab === 'analysis' && (
          <AnalysisTab 
            stockData={stockData} 
            loading={loading}
            searchedTicker={searchedTicker}
            onTrack={handleTrack}
          />
        )}
        
        {activeTab === 'options' && (
          <OptionsTab 
            optionsData={optionsData}
            loading={loading}
            searchedTicker={searchedTicker}
          />
        )}
        
        {activeTab === 'tracker' && <TrackerTab />}
        
        {activeTab === 'calibration' && (
          <div className="max-w-4xl mx-auto">
            <CalibrationCard />
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// ANALYSIS TAB
// ============================================================
function AnalysisTab({ stockData, loading, searchedTicker, onTrack }: any) {
  if (loading) return <LoadingSpinner />;
  if (!stockData) {
    return (
      <div className="text-center py-12">
        <span className="text-6xl mb-4 block">📊</span>
        <h2 className="text-2xl font-bold text-slate-300 mb-2">Enter a ticker to begin</h2>
        <p className="text-slate-400">Get comprehensive analysis with professional trading setups</p>
      </div>
    );
  }
  
  const suggestion = stockData.suggestions?.[0];
  if (!suggestion) return <div className="text-center py-12 text-slate-400">No analysis available</div>;
  
  const quote = stockData.quote;
  const meta = stockData.meta;
  const price = quote?.lastPrice || quote?.mark || 0;
  const change = quote?.netChange || 0;
  const changePct = quote?.netPercentChange || 0;
  
  const typeColor = 
    suggestion.type === 'BUY' ? 'text-emerald-400' :
    suggestion.type === 'SELL' ? 'text-red-400' :
    'text-yellow-400';
  
  const typeIcon = 
    suggestion.type === 'BUY' ? '📈' :
    suggestion.type === 'SELL' ? '📉' :
    '⏸️';
  
  return (
    <div className="space-y-6">
      {/* Quote Header */}
      <div className="bg-gradient-to-br from-slate-800/60 to-slate-900/60 border border-slate-700/50 rounded-2xl p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-3xl font-bold text-white mb-1">{searchedTicker}</h2>
            <p className="text-slate-400">{stockData.profile?.name || 'Stock Analysis'}</p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold text-white">${price.toFixed(2)}</p>
            <p className={`text-sm font-semibold ${change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {change >= 0 ? '+' : ''}{change.toFixed(2)} ({changePct >= 0 ? '+' : ''}{changePct.toFixed(2)}%)
            </p>
          </div>
        </div>
        
        {/* Recommendation */}
        <div className="flex items-center gap-4 p-4 rounded-xl bg-slate-900/60 border border-slate-700/40">
          <span className="text-4xl">{typeIcon}</span>
          <div className="flex-1">
            <p className={`text-2xl font-bold ${typeColor}`}>{suggestion.type}</p>
            <p className="text-slate-400 text-sm">
              Confidence: <span className={`font-bold ${
                suggestion.confidence >= 75 ? 'text-emerald-400' :
                suggestion.confidence >= 60 ? 'text-blue-400' :
                'text-yellow-400'
              }`}>{suggestion.confidence}%</span>
              {meta?.confidenceBucket && ` (${meta.confidenceBucket})`}
            </p>
          </div>
          <button
            onClick={() => onTrack(suggestion, price)}
            className="px-6 py-3 rounded-xl bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/40 text-blue-300 font-semibold transition"
          >
            📌 Track Position
          </button>
        </div>
      </div>
      
      {/* Setup Card */}
      {suggestion.setup && (
        <SetupCard
          setup={suggestion.setup}
          entry={suggestion.entry}
          stop={suggestion.stop}
          targets={suggestion.targets}
          regime={meta?.regime}
        />
      )}
      
      {/* Evidence Verification */}
      {suggestion.evidencePacket && (
        <EvidenceHashCard evidencePacket={suggestion.evidencePacket} />
      )}
      
      {/* Reasoning */}
      {suggestion.reasoning && suggestion.reasoning.length > 0 && (
        <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-5">
          <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
            <span>💡</span> Analysis Reasoning
          </h3>
          <div className="space-y-2">
            {suggestion.reasoning.map((reason: string, i: number) => (
              <div key={i} className="flex items-start gap-2 text-sm text-slate-300">
                <span className="text-blue-400 mt-0.5">•</span>
                <span>{reason}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Technicals & Fundamentals */}
      <div className="grid grid-cols-2 gap-6">
        {/* Technical Score */}
        {meta?.technical && (
          <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-5">
            <h3 className="font-semibold text-white mb-3">Technical Analysis</h3>
            <div className="mb-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-400 text-sm">Score</span>
                <span className="text-2xl font-bold text-blue-400">
                  {meta.technical.score}/9
                </span>
              </div>
              <div className="w-full bg-slate-700/30 rounded-full h-2">
                <div
                  className="bg-gradient-to-r from-blue-500 to-cyan-500 h-2 rounded-full transition-all"
                  style={{ width: `${(meta.technical.score / 9) * 100}%` }}
                />
              </div>
            </div>
            <div className="space-y-1 text-xs">
              {meta.technical.factors?.slice(0, 5).map((f: any, i: number) => (
                <div key={i} className="flex items-center gap-2">
                  <span className={f.passed ? 'text-emerald-400' : 'text-red-400'}>
                    {f.passed ? '✓' : '✗'}
                  </span>
                  <span className="text-slate-300">{f.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Fundamental Score */}
        {meta?.fundamental && (
          <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-5">
            <h3 className="font-semibold text-white mb-3">Fundamental Analysis</h3>
            <div className="mb-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-400 text-sm">Score</span>
                <span className="text-2xl font-bold text-emerald-400">
                  {meta.fundamental.score}/9
                </span>
              </div>
              <div className="w-full bg-slate-700/30 rounded-full h-2">
                <div
                  className="bg-gradient-to-r from-emerald-500 to-green-500 h-2 rounded-full transition-all"
                  style={{ width: `${(meta.fundamental.score / 9) * 100}%` }}
                />
              </div>
            </div>
            <div className="space-y-1 text-xs">
              {meta.fundamental.factors?.slice(0, 5).map((f: any, i: number) => (
                <div key={i} className="flex items-center gap-2">
                  <span className={f.passed ? 'text-emerald-400' : 'text-red-400'}>
                    {f.passed ? '✓' : '✗'}
                  </span>
                  <span className="text-slate-300">{f.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// OPTIONS TAB  
// ============================================================
function OptionsTab({ optionsData, loading, searchedTicker }: any) {
  if (loading) return <LoadingSpinner />;
  if (!optionsData) {
    return (
      <div className="text-center py-12">
        <span className="text-6xl mb-4 block">📈</span>
        <h2 className="text-2xl font-bold text-slate-300 mb-2">No options data</h2>
        <p className="text-slate-400">Enter a ticker with options to view analysis</p>
      </div>
    );
  }
  
  const unusual = optionsData.unusualActivity || [];
  
  return (
    <div className="space-y-6">
      <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-6">
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <span>🔥</span> Unusual Options Activity
        </h2>
        
        {unusual.length === 0 ? (
          <p className="text-slate-400 text-center py-8">No unusual activity detected</p>
        ) : (
          <div className="space-y-3">
            {unusual.slice(0, 10).map((u: any, i: number) => (
              <div key={i} className="p-4 rounded-lg bg-slate-900/40 border border-slate-700/30">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={u.putCall === 'CALL' ? 'text-emerald-400' : 'text-red-400'} className="font-bold">
                      {u.putCall}
                    </span>
                    <span className="text-white font-semibold">
                      ${u.strikePrice} {new Date(u.expirationDate).toLocaleDateString()}
                    </span>
                  </div>
                  <span className="text-sm text-slate-400">
                    Score: {u.score || 'N/A'}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <span className="text-slate-400">Volume:</span>
                    <span className="text-white ml-1">{u.totalVolume?.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">OI:</span>
                    <span className="text-white ml-1">{u.openInterest?.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Delta:</span>
                    <span className="text-white ml-1">{u.delta?.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// TRACKER TAB
// ============================================================
function TrackerTab() {
  const [trackerData, setTrackerData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    fetchTrackerData();
  }, []);
  
  const fetchTrackerData = async () => {
    try {
      const res = await fetch('/api/tracker');
      if (res.ok) {
        const data = await res.json();
        setTrackerData(data);
      }
    } catch (err) {
      console.error('Tracker error:', err);
    }
    setLoading(false);
  };
  
  if (loading) return <LoadingSpinner />;
  
  const suggestions = trackerData?.suggestions || [];
  const active = suggestions.filter((s: any) => s.status === 'ACTIVE');
  const realized = suggestions.filter((s: any) => ['HIT_TARGET', 'STOPPED_OUT', 'CLOSED', 'EXPIRED'].includes(s.status));
  
  return (
    <div className="space-y-6">
      {/* Stats */}
      {trackerData?.stats && (
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/20 border border-blue-500/40 rounded-xl p-4">
            <p className="text-sm text-blue-300 mb-1">Total Tracked</p>
            <p className="text-3xl font-bold text-white">{trackerData.stats.totalTracked}</p>
          </div>
          <div className="bg-gradient-to-br from-emerald-500/20 to-emerald-600/20 border border-emerald-500/40 rounded-xl p-4">
            <p className="text-sm text-emerald-300 mb-1">Active</p>
            <p className="text-3xl font-bold text-white">{trackerData.stats.activeCount}</p>
          </div>
          <div className="bg-gradient-to-br from-purple-500/20 to-purple-600/20 border border-purple-500/40 rounded-xl p-4">
            <p className="text-sm text-purple-300 mb-1">Total P&L</p>
            <p className={`text-3xl font-bold ${trackerData.stats.totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              ${trackerData.stats.totalPnl?.toFixed(0)}
            </p>
          </div>
          <div className="bg-gradient-to-br from-orange-500/20 to-orange-600/20 border border-orange-500/40 rounded-xl p-4">
            <p className="text-sm text-orange-300 mb-1">Avg P&L %</p>
            <p className={`text-3xl font-bold ${trackerData.stats.avgPnlPct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {trackerData.stats.avgPnlPct?.toFixed(1)}%
            </p>
          </div>
        </div>
      )}
      
      {/* Active Positions */}
      <div>
        <h3 className="text-xl font-bold text-white mb-4">Active Positions ({active.length})</h3>
        {active.length === 0 ? (
          <div className="text-center py-8 text-slate-400">No active positions</div>
        ) : (
          <div className="space-y-3">
            {active.map((s: any) => (
              <div key={s.id} className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h4 className="text-lg font-bold text-white">{s.ticker}</h4>
                    <p className="text-sm text-slate-400">{s.strategy || s.setup}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-xl font-bold ${(s.pnlPct || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {(s.pnlPct || 0) >= 0 ? '+' : ''}{(s.pnlPct || 0).toFixed(2)}%
                    </p>
                    <p className="text-xs text-slate-400">
                      ${(s.pnl || 0).toFixed(0)} P&L
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <span className="text-slate-400">Entry:</span>
                    <span className="text-white ml-1">${s.entryPrice?.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Current:</span>
                    <span className="text-white ml-1">${s.currentPrice?.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Confidence:</span>
                    <span className="text-white ml-1">{s.confidence}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
