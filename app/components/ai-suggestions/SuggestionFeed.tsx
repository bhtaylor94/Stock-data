'use client';
import React, { useState, useEffect } from 'react';
import { SuggestionCard } from './SuggestionCard';
import { ExecutionModal } from './ExecutionModal';

interface Suggestion {
  id: string;
  symbol: string;
  companyName: string;
  type: 'STOCK' | 'OPTIONS';
  priority: 'URGENT' | 'HIGH' | 'MEDIUM';
  confidence: number;
  currentPrice: number;
  reason: string;
  details: {
    optionType?: 'CALL' | 'PUT';
    strike?: number;
    expiration?: string;
    premium?: number;
    volumeContracts?: number;
    premiumTotal?: number;
    targetPrice?: number;
    expectedReturn?: number;
    aiVotes?: { total: number; bullish: number };
  };
  timestamp: string;
}

interface SuggestionFeedProps {
  onSymbolSelect?: (symbol: string) => void;
  onViewEvidence?: (data: any) => void;
  onTrack?: (success: boolean, message: string) => void;
}

export function SuggestionFeed({ onSymbolSelect, onViewEvidence, onTrack }: SuggestionFeedProps = {}) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSuggestion, setSelectedSuggestion] = useState<Suggestion | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(Date.now());
  const [now, setNow] = useState(Date.now());
  const [filters, setFilters] = useState({
    minConfidence: 75,
    types: ['STOCK', 'OPTIONS'],
    priorities: ['URGENT', 'HIGH', 'MEDIUM'],
  });

  // Update "now" every second for relative time display
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch suggestions on mount and every 30 seconds
  useEffect(() => {
    fetchSuggestions();
    const interval = setInterval(fetchSuggestions, 30000);
    return () => clearInterval(interval);
  }, [filters]);

  const fetchSuggestions = async () => {
    try {
      const params = new URLSearchParams({
        minConfidence: filters.minConfidence.toString(),
        types: filters.types.join(','),
        priorities: filters.priorities.join(','),
      });
      
      const res = await fetch(`/api/suggestions?${params}`);
      const data = await res.json();
      
      if (data.success) {
        setSuggestions(data.suggestions || []);
        setLastUpdate(Date.now());
      }
    } catch (error) {
      console.error('Failed to fetch suggestions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = (id: string) => {
    setSuggestions(prev => prev.filter(s => s.id !== id));
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'URGENT': return 'bg-red-500/10 border-red-500/30 text-red-400';
      case 'HIGH': return 'bg-orange-500/10 border-orange-500/30 text-orange-400';
      default: return 'bg-blue-500/10 border-blue-500/30 text-blue-400';
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'URGENT': return '🔥';
      case 'HIGH': return '🚨';
      default: return '📊';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-xl md:text-2xl font-bold text-white flex items-center gap-2">
              🤖 AI Trade Suggestions
              <div className="flex items-center gap-2">
                <div className="relative">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                  <div className="absolute inset-0 w-2 h-2 bg-emerald-500 rounded-full animate-ping opacity-75" />
                </div>
                <span className="text-xs font-normal text-emerald-400">LIVE</span>
              </div>
            </h2>
            <p className="text-xs md:text-sm text-slate-400 mt-1">
              Last updated {Math.floor((now - lastUpdate) / 1000)}s ago • Auto-refresh every 30s
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchSuggestions}
              className="p-2 rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700 transition-colors"
              title="Refresh"
            >
              <span className="text-lg">🔄</span>
            </button>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="p-2 rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700 transition-colors"
              title="Filters"
            >
              <span className="text-lg">⚙️</span>
            </button>
          </div>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700 space-y-3">
            <div>
              <label className="text-sm text-slate-400 mb-2 block">
                Min Confidence: {filters.minConfidence}%
              </label>
              <input
                type="range"
                min="50"
                max="95"
                step="5"
                value={filters.minConfidence}
                onChange={(e) => setFilters(prev => ({ ...prev, minConfidence: parseInt(e.target.value) }))}
                className="w-full"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {['STOCK', 'OPTIONS'].map(type => (
                <label key={type} className="flex items-center gap-2 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={filters.types.includes(type)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setFilters(prev => ({ ...prev, types: [...prev.types, type] }));
                      } else {
                        setFilters(prev => ({ ...prev, types: prev.types.filter(t => t !== type) }));
                      }
                    }}
                  />
                  {type}
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Suggestions Count */}
        <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-gradient-to-r from-blue-500/10 to-emerald-500/10 border border-blue-500/30">
          <span className="text-sm md:text-base font-medium text-white">
            {suggestions.length} High-Confidence Opportunities
          </span>
          {suggestions.length > 0 && (
            <span className="text-xs text-slate-400">
              Top ranked by AI
            </span>
          )}
        </div>

        {/* Suggestions List */}
        {suggestions.length === 0 ? (
          <div className="text-center py-12 px-4">
            <p className="text-lg text-slate-400 mb-2">🔍 No suggestions right now</p>
            <p className="text-sm text-slate-500">
              AI is scanning the market. Check back in 30 seconds.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {suggestions.map((suggestion, index) => (
              <div key={suggestion.id} className="relative">
                {/* Priority Badge */}
                <div className="absolute -top-2 -left-2 z-10">
                  <div className={`px-2 py-1 rounded-full text-xs font-bold flex items-center gap-1 ${getPriorityColor(suggestion.priority)}`}>
                    <span>{getPriorityIcon(suggestion.priority)}</span>
                    <span className="hidden sm:inline">#{index + 1}</span>
                  </div>
                </div>

                <SuggestionCard
                  suggestion={suggestion}
                  onExecute={() => setSelectedSuggestion(suggestion)}
                  onDismiss={() => handleDismiss(suggestion.id)}
                />
              </div>
            ))}
          </div>
        )}

        {/* Load More */}
        {suggestions.length >= 10 && (
          <button
            onClick={fetchSuggestions}
            className="w-full py-3 rounded-xl bg-slate-800 border border-slate-700 hover:bg-slate-700 transition-colors text-sm font-medium text-white"
          >
            Load More Suggestions
          </button>
        )}
      </div>

      {/* Execution Modal */}
      {selectedSuggestion && (
        <ExecutionModal
          suggestion={selectedSuggestion}
          onClose={() => setSelectedSuggestion(null)}
        />
      )}
    </>
  );
}
