'use client';
import React, { useState, useEffect } from 'react';
import { StockDecisionHero } from './StockDecisionHero';
import { StockScoreBreakdown } from './StockScoreBreakdown';
import { ConsensusSourcesList } from './ConsensusSourcesList';
import { ChartPatternCard } from './ChartPatternCard';

interface StockAnalysisWrapperProps {
  ticker: string;
  onViewEvidence?: (data: any) => void;
}

export function StockAnalysisWrapper({ 
  ticker, 
  onViewEvidence 
}: StockAnalysisWrapperProps) {
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
        const res = await fetch(`/api/stock/${ticker}`);
        if (!res.ok) throw new Error('Failed to fetch stock data');
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
        <p className="text-6xl mb-4">📈</p>
        <p>Search for a stock to analyze</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="relative">
          <div className="w-12 h-12 rounded-full border-4 border-slate-700 border-t-blue-500 animate-spin" />
          <div className="absolute inset-0 w-12 h-12 rounded-full bg-blue-500/20 blur-xl animate-pulse" />
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
      <StockDecisionHero 
        ticker={ticker}
        price={data.price || data.quote?.c || 0}
        analysis={{ ...data.analysis, changePercent: data.changePercent }}
        meta={data.meta}
        onViewEvidence={onViewEvidence}
      />
      <StockScoreBreakdown analysis={data.analysis} />
      <ConsensusSourcesList 
        ticker={ticker}
        sources={data.analysis?.sources || []}
      />
      <ChartPatternCard chartPatterns={data.chartPatterns} />
    </div>
  );
}
