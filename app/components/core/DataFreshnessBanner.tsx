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
  
  // Determine freshness status
  const isFresh = ageSeconds < 60;
  const isRecent = ageSeconds < 300; // 5 minutes
  
  const formatAge = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    return `${Math.floor(seconds / 3600)}h`;
  };

  return (
    <div className="flex items-center justify-between gap-3 text-xs px-3 py-1.5 rounded-lg bg-slate-800/30 border border-slate-700/30 mb-3">
      {/* Left: Freshness */}
      <div className="flex items-center gap-2">
        <span className={isFresh ? 'text-emerald-400' : isRecent ? 'text-amber-400' : 'text-red-400'}>
          {isFresh ? '●' : isRecent ? '◐' : '○'} {formatAge(ageSeconds)}
        </span>
        <span className="text-slate-500">|</span>
        <span className="text-slate-400">
          {source === 'schwab' ? '📡 Real-time' : '📊 Delayed'}
        </span>
      </div>
      
      {/* Right: Market Status */}
      <div className="flex items-center gap-2">
        {type === 'options' && !isMarketHours && (
          <span className="text-amber-400">⚠️ Options: Market hours only</span>
        )}
        <span className={isMarketHours ? 'text-emerald-400' : 'text-slate-500'}>
          {isMarketHours ? '● Open' : '○ Closed'}
        </span>
        {!isFresh && (
          <button 
            onClick={() => window.location.reload()}
            className="text-blue-400 hover:text-blue-300 underline ml-2"
          >
            Refresh
          </button>
        )}
      </div>
    </div>
  );
}
