'use client';

import React, { useEffect, useState } from 'react';

interface DataFreshnessBannerProps {
  data: any;
  type: 'stock' | 'options';
}

export function DataFreshnessBanner({ data, type }: DataFreshnessBannerProps) {
  const [currentTime, setCurrentTime] = useState(new Date());
  
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  if (!data?.meta) return null;

  const { asOf, isStale, source, quoteAgeMs } = data.meta;
  const dataTimestamp = asOf ? new Date(asOf) : new Date();
  const ageSeconds = quoteAgeMs ? Math.floor(quoteAgeMs / 1000) : Math.floor((currentTime.getTime() - dataTimestamp.getTime()) / 1000);
  
  // Market hours check (9:30 AM - 4:00 PM ET)
  const now = new Date();
  const etHour = now.getUTCHours() - 5; // ET is UTC-5 (simplified)
  const etMinute = now.getUTCMinutes();
  const isMarketHours = (etHour === 9 && etMinute >= 30) || (etHour >= 10 && etHour < 16);
  const isExtendedHours = (etHour >= 4 && etHour < 9) || (etHour === 9 && etMinute < 30) || (etHour >= 16 && etHour < 20);
  
  const marketStatus = isMarketHours ? 'OPEN' : isExtendedHours ? 'EXTENDED' : 'CLOSED';
  
  // Determine freshness status
  const isFresh = ageSeconds < 60;
  const isRecent = ageSeconds < 300; // 5 minutes
  
  const getFreshnessColor = () => {
    if (isFresh) return 'bg-emerald-500/10 border-emerald-500/30';
    if (isRecent) return 'bg-amber-500/10 border-amber-500/30';
    return 'bg-red-500/10 border-red-500/30';
  };
  
  const getFreshnessText = () => {
    if (isFresh) return '🟢 LIVE DATA';
    if (isRecent) return '🟡 RECENT DATA';
    return '🔴 STALE DATA';
  };
  
  const formatAge = (seconds: number) => {
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    return `${Math.floor(seconds / 3600)}h ago`;
  };

  return (
    <div className={`p-3 rounded-lg border ${getFreshnessColor()} mb-4`}>
      <div className="flex items-center justify-between flex-wrap gap-2">
        {/* Left: Data Freshness */}
        <div className="flex items-center gap-3">
          <div>
            <p className="text-xs font-bold text-white">{getFreshnessText()}</p>
            <p className="text-xs text-slate-400">Updated {formatAge(ageSeconds)}</p>
          </div>
          
          {/* Data Source */}
          <div className="h-8 w-px bg-slate-700" />
          <div>
            <p className="text-xs font-bold text-white">
              {source === 'schwab' ? '📡 SCHWAB (Real-Time)' : 
               source === 'finnhub' ? '📊 FINNHUB (Delayed)' : 
               '📡 LIVE FEED'}
            </p>
            <p className="text-xs text-slate-400">
              {dataTimestamp.toLocaleTimeString()}
            </p>
          </div>
        </div>
        
        {/* Right: Market Status */}
        <div className="flex items-center gap-2">
          <div className={`px-3 py-1 rounded ${
            marketStatus === 'OPEN' ? 'bg-emerald-500/20 text-emerald-400' :
            marketStatus === 'EXTENDED' ? 'bg-blue-500/20 text-blue-400' :
            'bg-slate-500/20 text-slate-400'
          }`}>
            <p className="text-xs font-bold">
              {marketStatus === 'OPEN' ? '● MARKET OPEN' :
               marketStatus === 'EXTENDED' ? '◐ EXTENDED HOURS' :
               '○ MARKET CLOSED'}
            </p>
          </div>
          
          {type === 'options' && marketStatus !== 'OPEN' && (
            <div className="px-2 py-1 rounded bg-amber-500/20 text-amber-400">
              <p className="text-xs font-bold">⚠️ Options data only available 9:30 AM - 4 PM ET</p>
            </div>
          )}
        </div>
      </div>
      
      {/* Warning for stale data */}
      {!isFresh && (
        <div className="mt-2 pt-2 border-t border-slate-700/50">
          <p className="text-xs text-amber-400">
            ⚠️ Data may not reflect current market conditions. 
            <button 
              onClick={() => window.location.reload()}
              className="ml-2 underline hover:text-amber-300"
            >
              Refresh now
            </button>
          </p>
        </div>
      )}
      
      {/* Debug info (only show if data is very stale) */}
      {ageSeconds > 300 && (
        <details className="mt-2 text-xs">
          <summary className="cursor-pointer text-slate-500 hover:text-slate-400">
            🔧 Debug Info
          </summary>
          <div className="mt-1 p-2 rounded bg-slate-900/50 font-mono text-slate-400">
            <p>Data Timestamp: {dataTimestamp.toISOString()}</p>
            <p>Current Time: {currentTime.toISOString()}</p>
            <p>Age: {ageSeconds}s ({quoteAgeMs}ms)</p>
            <p>Source: {source}</p>
            <p>Is Stale: {isStale ? 'YES' : 'NO'}</p>
          </div>
        </details>
      )}
    </div>
  );
}
