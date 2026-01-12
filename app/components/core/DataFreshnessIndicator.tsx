'use client';

import React, { useState, useEffect } from 'react';

export function DataFreshnessIndicator({ 
  meta, 
  dataSource,
  onRefresh 
}: { 
  meta: any;
  dataSource?: string;
  onRefresh?: () => void;
}) {
  const [secondsAgo, setSecondsAgo] = useState(0);
  
  useEffect(() => {
    if (!meta?.lastFetched) return;
    
    const interval = setInterval(() => {
      const ago = Math.floor((Date.now() - new Date(meta.lastFetched).getTime()) / 1000);
      setSecondsAgo(ago);
    }, 1000);
    
    return () => clearInterval(interval);
  }, [meta?.lastFetched]);
  
  const isRealTime = dataSource === 'schwab' || dataSource === 'schwab-live';
  const isStale = meta?.isStale || secondsAgo > 300; // 5 minutes
  
  const getTimeAgo = () => {
    if (secondsAgo < 60) return `${secondsAgo}s ago`;
    const minutes = Math.floor(secondsAgo / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };
  
  return (
    <div className={`flex items-center gap-3 px-4 py-2 rounded-lg border ${
      isRealTime && !isStale
        ? 'bg-emerald-500/10 border-emerald-500/30'
        : 'bg-amber-500/10 border-amber-500/30'
    }`}>
      {/* Live Indicator */}
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${
          isRealTime && !isStale
            ? 'bg-emerald-400 animate-pulse'
            : 'bg-amber-400'
        }`} />
        <div className="text-xs">
          <p className={`font-bold ${
            isRealTime && !isStale ? 'text-emerald-400' : 'text-amber-400'
          }`}>
            {isRealTime && !isStale ? '🟢 LIVE DATA' : '🟡 DELAYED DATA'}
          </p>
          <p className="text-slate-400">
            {isRealTime ? 'Schwab Real-Time' : 'Delayed Quote'}
          </p>
        </div>
      </div>
      
      {/* Separator */}
      <div className="w-px h-8 bg-slate-700" />
      
      {/* Last Updated */}
      <div className="text-xs">
        <p className="text-slate-400">Last Updated</p>
        <p className="font-bold text-white">{getTimeAgo()}</p>
      </div>
      
      {/* Refresh Button */}
      {onRefresh && (
        <>
          <div className="w-px h-8 bg-slate-700" />
          <button
            onClick={onRefresh}
            className="px-3 py-1.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 text-xs font-bold transition flex items-center gap-1.5"
          >
            <span className="text-base">🔄</span>
            Refresh
          </button>
        </>
      )}
      
      {/* Warning if stale */}
      {isStale && (
        <>
          <div className="w-px h-8 bg-slate-700" />
          <div className="text-xs text-amber-400 flex items-center gap-1">
            <span>⚠️</span>
            <span>Data may be outdated</span>
          </div>
        </>
      )}
    </div>
  );
}

// Compact version for mobile/small spaces
export function CompactDataIndicator({ 
  isRealTime,
  secondsAgo 
}: { 
  isRealTime: boolean;
  secondsAgo: number;
}) {
  const getTimeAgo = () => {
    if (secondsAgo < 60) return `${secondsAgo}s`;
    const minutes = Math.floor(secondsAgo / 60);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h`;
  };
  
  return (
    <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-bold ${
      isRealTime && secondsAgo < 300
        ? 'bg-emerald-500/20 text-emerald-400'
        : 'bg-amber-500/20 text-amber-400'
    }`}>
      <div className={`w-1.5 h-1.5 rounded-full ${
        isRealTime && secondsAgo < 300 ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
      }`} />
      {isRealTime ? 'LIVE' : 'DELAYED'} • {getTimeAgo()}
    </div>
  );
}
