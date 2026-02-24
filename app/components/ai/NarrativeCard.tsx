'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { Sparkles, RefreshCw } from 'lucide-react';

interface NarrativeCardProps {
  ticker: string;
  price: number;
  changePercent?: number;
  analysis?: any;
  optionsSetups?: any[];
  unusualActivity?: any[];
  technicals?: any;
  ivContext?: string;
}

export function NarrativeCard({
  ticker,
  price,
  changePercent,
  analysis,
  optionsSetups,
  unusualActivity,
  technicals,
  ivContext,
}: NarrativeCardProps) {
  const [narrative, setNarrative] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [generatedAt, setGeneratedAt] = useState<Date | null>(null);

  const fetch_ = useCallback(async () => {
    if (!ticker) return;
    setLoading(true);
    setError(false);
    try {
      const res = await fetch('/api/narrative', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker, price, changePercent, analysis, optionsSetups, unusualActivity, technicals, ivContext }),
      });
      const data = await res.json();
      if (data.narrative) {
        setNarrative(data.narrative);
        setGeneratedAt(new Date());
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [ticker, price, changePercent, analysis, optionsSetups, unusualActivity, technicals, ivContext]);

  useEffect(() => {
    fetch_();
  }, [ticker]); // Only re-fetch when ticker changes

  function timeAgo(d: Date): string {
    const s = Math.round((Date.now() - d.getTime()) / 1000);
    if (s < 60) return `${s}s ago`;
    return `${Math.floor(s / 60)}m ago`;
  }

  return (
    <div className="p-4 rounded-2xl border border-slate-700/50 bg-slate-800/20 border-t-2 border-t-blue-500/50">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-white">AI Trade Brief</span>
          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/25">
            <Sparkles size={9} />AI
          </span>
        </div>
        <button
          onClick={fetch_}
          disabled={loading}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/50 transition-all disabled:opacity-40"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {loading && (
        <div className="space-y-2 animate-pulse">
          <div className="h-3 bg-slate-700/60 rounded w-full" />
          <div className="h-3 bg-slate-700/60 rounded w-5/6" />
          <div className="h-3 bg-slate-700/60 rounded w-4/6" />
        </div>
      )}

      {!loading && error && (
        <p className="text-sm text-slate-500">AI analysis unavailable — check API key configuration.</p>
      )}

      {!loading && !error && narrative && (
        <>
          <p className="text-sm text-slate-300 leading-relaxed">{narrative}</p>
          {generatedAt && (
            <p className="text-xs text-slate-600 mt-2">Generated {timeAgo(generatedAt)} · claude-haiku</p>
          )}
        </>
      )}

      {!loading && !error && !narrative && (
        <p className="text-sm text-slate-500">Enter a ticker to generate a trade brief.</p>
      )}
    </div>
  );
}
