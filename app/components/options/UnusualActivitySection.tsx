import React from 'react';

export function UnusualActivityCard({ 
  activity,
  onTrack
}: { 
  activity: any;
  onTrack?: (contract: any) => void;
}) {
  return (
    <div className={`p-4 rounded-xl border ${
      activity.sentiment === 'BULLISH' 
        ? 'border-emerald-500/40 bg-emerald-500/5' 
        : 'border-red-500/40 bg-red-500/5'
    }`}>
      {/* Header Row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold text-lg text-white">
            {activity.sentiment === 'BULLISH' ? '📈' : '📉'} ${activity.contract?.strike || activity.strike} {(activity.contract?.type || activity.type)?.toUpperCase()}
          </span>
          <span className="text-xs px-2 py-1 rounded bg-slate-700 text-slate-200">
            📅 {activity.contract?.expiration || activity.expiration || `${activity.dte}d`}
          </span>
          <span className={`text-xs px-2 py-0.5 rounded font-medium ${
            activity.convictionLevel === 'HIGH' ? 'bg-orange-500/30 text-orange-300' :
            activity.convictionLevel === 'MEDIUM' ? 'bg-amber-500/20 text-amber-400' :
            'bg-slate-500/20 text-slate-400'
          }`}>
            {activity.convictionLevel || 'MEDIUM'} CONVICTION
          </span>
        </div>
        <span className={`text-sm px-3 py-1 rounded-lg font-bold ${
          activity.sentiment === 'BULLISH' 
            ? 'bg-emerald-500/20 text-emerald-400' 
            : 'bg-red-500/20 text-red-400'
        }`}>
          {activity.sentiment}
        </span>
      </div>

      {/* Trade Type */}
      <div className={`p-3 rounded-lg mb-3 ${
        activity.tradeType === 'DIRECTIONAL' 
          ? 'bg-blue-500/10 border border-blue-500/30' 
          : activity.tradeType === 'LIKELY_HEDGE'
          ? 'bg-purple-500/10 border border-purple-500/30'
          : 'bg-slate-700/30 border border-slate-600/30'
      }`}>
        <div className="flex items-center justify-between">
          <span className={`font-bold text-sm ${
            activity.tradeType === 'DIRECTIONAL' ? 'text-blue-400' :
            activity.tradeType === 'LIKELY_HEDGE' ? 'text-purple-400' :
            'text-slate-300'
          }`}>
            {activity.tradeType === 'DIRECTIONAL' ? '🎯 DIRECTIONAL BET' :
             activity.tradeType === 'LIKELY_HEDGE' ? '🛡️ LIKELY HEDGE' :
             '❓ UNCERTAIN'}
          </span>
          
          {/* Insider Probability */}
          {activity.insiderProbability && activity.insiderProbability !== 'UNLIKELY' && (
            <span className={`text-xs px-2 py-1 rounded font-bold ${
              activity.insiderProbability === 'HIGH' ? 'bg-red-500/30 text-red-300 animate-pulse' :
              activity.insiderProbability === 'MEDIUM' ? 'bg-orange-500/20 text-orange-300' :
              'bg-amber-500/10 text-amber-400'
            }`}>
              🔍 {activity.insiderProbability} INSIDER PROB
            </span>
          )}
        </div>
        <p className="text-xs text-slate-400 mt-1">
          {activity.tradeTypeReason || activity.interpretation}
        </p>
      </div>

      {/* Insider Signals */}
      {activity.insiderSignals?.length > 0 && (
        <div className="mb-3 p-2 rounded bg-red-500/5 border border-red-500/20">
          <p className="text-xs text-red-400 font-medium mb-1">🔍 Insider Activity Suspected:</p>
          <ul className="text-xs text-slate-400 space-y-0.5">
            {activity.insiderSignals.slice(0, 3).map((sig: string, i: number) => (
              <li key={i}>• {sig}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-5 gap-2 text-xs mb-3">
        <div className="p-2 rounded bg-slate-800/50 text-center">
          <p className="text-slate-400">Vol</p>
          <p className="text-amber-400 font-bold">
            {(activity.contract?.volume || activity.volume)?.toLocaleString()}
          </p>
        </div>
        <div className="p-2 rounded bg-slate-800/50 text-center">
          <p className="text-slate-400">OI</p>
          <p className="text-white font-bold">
            {(activity.contract?.openInterest || activity.openInterest)?.toLocaleString()}
          </p>
        </div>
        <div className="p-2 rounded bg-slate-800/50 text-center">
          <p className="text-slate-400">Vol/OI</p>
          <p className="text-orange-400 font-bold">
            {(activity.contract?.volumeOIRatio || activity.volumeOIRatio)?.toFixed(1)}x
          </p>
        </div>
        <div className="p-2 rounded bg-slate-800/50 text-center">
          <p className="text-slate-400">DTE</p>
          <p className="text-white font-bold">{activity.contract?.dte || activity.dte}d</p>
        </div>
        <div className="p-2 rounded bg-slate-800/50 text-center">
          <p className="text-slate-400">Premium</p>
          <p className="text-emerald-400 font-bold">
            ${activity.premiumValue ? (activity.premiumValue / 1000).toFixed(0) + 'K' : 'N/A'}
          </p>
        </div>
      </div>

      {/* Signals */}
      {activity.signals?.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {activity.signals.slice(0, 4).map((signal: string, i: number) => (
            <span key={i} className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300">
              {signal}
            </span>
          ))}
        </div>
      )}

      {/* Track Button */}
      {onTrack && (
        <button
          onClick={() => onTrack(activity)}
          className="w-full px-3 py-2 rounded-lg bg-blue-500/20 text-blue-400 text-sm font-medium hover:bg-blue-500/30 transition"
        >
          📌 Track This Activity
        </button>
      )}
    </div>
  );
}

export function UnusualActivitySection({ 
  activities,
  onTrack
}: { 
  activities: any[];
  onTrack?: (contract: any) => void;
}) {
  if (!activities || activities.length === 0) return null;
  
  return (
    <div className="p-5 rounded-2xl border border-orange-500/30 bg-gradient-to-br from-orange-950/20 to-red-950/10">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-orange-400">🔥 Unusual Options Activity</h2>
        <span className="text-xs text-slate-500">Smart Money Detection</span>
      </div>
      
      {/* Info Box */}
      <details className="mb-4 p-3 rounded-lg bg-slate-800/30 border border-slate-700/50">
        <summary className="text-xs text-blue-400 cursor-pointer hover:text-blue-300">
          ℹ️ What does this mean?
        </summary>
        <div className="mt-2 text-xs text-slate-400 space-y-1">
          <p><strong className="text-white">Unusual Options Activity (UOA)</strong> = Options trading at significantly higher volume than normal. Often indicates institutional positioning.</p>
          <p><strong className="text-amber-400">DIRECTIONAL</strong> = Likely a bet on price movement</p>
          <p><strong className="text-purple-400">LIKELY_HEDGE</strong> = Likely protection against existing position</p>
        </div>
      </details>
      
      <div className="space-y-3">
        {activities.slice(0, 5).map((activity, i) => (
          <UnusualActivityCard key={i} activity={activity} onTrack={onTrack} />
        ))}
      </div>
    </div>
  );
}
