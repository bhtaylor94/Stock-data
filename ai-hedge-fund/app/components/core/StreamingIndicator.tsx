// app/components/core/StreamingIndicator.tsx
// Visual indicator showing real-time streaming status

'use client';

import React from 'react';
import { useStreamingStatus } from '@/app/contexts/StreamContext';

export function StreamingIndicator() {
  const { isConnected, isConnecting } = useStreamingStatus();

  if (isConnecting) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-yellow-500/10 border border-yellow-500/30">
        <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
        <span className="text-xs font-medium text-yellow-400">Connecting...</span>
      </div>
    );
  }

  if (isConnected) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30">
        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        <span className="text-xs font-medium text-emerald-400">Live</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-700/50 border border-slate-600/50">
      <div className="w-2 h-2 rounded-full bg-slate-500" />
      <span className="text-xs font-medium text-slate-400">Delayed</span>
    </div>
  );
}

// Compact version for inline use
export function StreamingBadge() {
  const { isConnected, isConnecting } = useStreamingStatus();

  if (isConnecting) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-yellow-400">
        <div className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse" />
        Connecting
      </span>
    );
  }

  if (isConnected) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400">
        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        Live
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-slate-400">
      <div className="w-1.5 h-1.5 rounded-full bg-slate-500" />
      Delayed
    </span>
  );
}
