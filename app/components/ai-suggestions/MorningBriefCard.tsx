'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';

interface BriefingData {
  brief: string;
  generatedAt: string;
  marketSnapshot: {
    spyChange: number;
    qqqChange: number;
    vixLevel: number;
    earningsTickers: string[];
  };
}

const BULLET_ICONS = ['📊', '⚠️', '🔥', '🌊'];

function parseBullets(text: string): string[] {
  // Split on emoji bullet markers or numbered lines
  const lines = text.split('\n').filter((l) => l.trim());
  const bullets: string[] = [];
  for (const line of lines) {
    const trimmed = line.replace(/^\d+\.\s*/, '').trim();
    if (trimmed) bullets.push(trimmed);
    if (bullets.length === 4) break;
  }
  return bullets;
}

function minutesAgo(iso: string): number {
  return Math.round((Date.now() - new Date(iso).getTime()) / 60000);
}

export function MorningBriefCard() {
  const [data, setData] = useState<BriefingData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  const load = useCallback(async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      if (force) await fetch('/api/briefing', { method: 'DELETE' });
      const res = await fetch('/api/briefing');
      if (!res.ok) throw new Error('Failed to fetch briefing');
      setData(await res.json());
    } catch (e) {
      setError('Unable to load morning brief.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const bullets = data ? parseBullets(data.brief) : [];
  const ago = data ? minutesAgo(data.generatedAt) : 0;

  return (
    <div className="border border-amber-700/40 rounded-lg overflow-hidden bg-gradient-to-r from-amber-950/40 to-slate-900">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-2.5 cursor-pointer hover:bg-amber-900/10 transition-colors"
        onClick={() => setCollapsed((c) => !c)}
      >
        <div className="flex items-center gap-2">
          <div className="w-0.5 h-5 bg-amber-500 rounded-full" />
          <span className="text-sm font-semibold text-amber-400">Pre-Market AI Brief</span>
          {data && (
            <span className="text-xs text-slate-500 ml-1">
              {ago < 2 ? 'just now' : `${ago}m ago`}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); load(true); }}
            className="text-slate-500 hover:text-amber-400 transition-colors p-1"
            title="Refresh"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          </button>
          {collapsed ? <ChevronDown size={14} className="text-slate-500" /> : <ChevronUp size={14} className="text-slate-500" />}
        </div>
      </div>

      {/* Body */}
      {!collapsed && (
        <div className="px-4 pb-3">
          {loading && !data && (
            <div className="flex items-center gap-2 py-3 text-xs text-slate-400">
              <div className="w-3 h-3 border border-amber-500 border-t-transparent rounded-full animate-spin" />
              Generating brief…
            </div>
          )}
          {error && <p className="text-xs text-red-400 py-2">{error}</p>}
          {bullets.length > 0 && (
            <ul className="space-y-1.5 mt-1">
              {bullets.map((bullet, i) => (
                <li key={i} className="text-xs text-slate-300 leading-relaxed">
                  {bullet}
                </li>
              ))}
            </ul>
          )}
          {data?.marketSnapshot && (
            <div className="flex gap-3 mt-2 pt-2 border-t border-slate-800 text-[11px] text-slate-500">
              <span>SPY {data.marketSnapshot.spyChange >= 0 ? '+' : ''}{data.marketSnapshot.spyChange.toFixed(2)}%</span>
              <span>QQQ {data.marketSnapshot.qqqChange >= 0 ? '+' : ''}{data.marketSnapshot.qqqChange.toFixed(2)}%</span>
              <span>VIX {data.marketSnapshot.vixLevel.toFixed(1)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
