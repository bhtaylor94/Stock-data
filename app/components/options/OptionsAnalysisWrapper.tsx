'use client';
import React, { useState, useEffect } from 'react';
import { OptionsDecisionHero } from './OptionsDecisionHero';
import { UnusualActivitySection } from './UnusualActivitySection';
import { OptionsSetupCard } from './OptionsSetupCard';

interface OptionsAnalysisWrapperProps {
  ticker: string;
}

export function OptionsAnalysisWrapper({ 
  ticker
}: OptionsAnalysisWrapperProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ticker) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const res = await fetch(`/api/options/${ticker}`);
        if (!res.ok) throw new Error('Failed to fetch options data');
        const json = await res.json();
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [ticker]);

  if (!ticker) {
    return (
      <div className="p-12 text-center text-slate-400">
        <p className="text-6xl mb-4">⚡</p>
        <p>Search for a stock to analyze options</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="relative">
          <div className="w-12 h-12 rounded-full border-4 border-slate-700 border-t-purple-500 animate-spin" />
          <div className="absolute inset-0 w-12 h-12 rounded-full bg-purple-500/20 blur-xl animate-pulse" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 rounded-2xl bg-red-500/10 border border-red-400/30">
        <p className="text-red-400">Error: {error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6 rounded-2xl bg-slate-800/50 border border-slate-700">
        <p className="text-slate-400">No data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <OptionsDecisionHero 
        ticker={ticker}
        currentPrice={data.price || 0}
        meta={data.meta || {}}
        suggestions={data.suggestions || []}
        priceChange={data.changePercent}
      />
      <UnusualActivitySection 
        activities={data.unusualActivity || []}
      />
      {/* Render recommendations if they exist */}
      {data.recommendations && data.recommendations.length > 0 && (
        <div className="space-y-3">
          {data.recommendations.map((setup: any, i: number) => (
            <OptionsSetupCard 
              key={i}
              setup={setup}
            />
          ))}
        </div>
      )}
    </div>
  );
}
