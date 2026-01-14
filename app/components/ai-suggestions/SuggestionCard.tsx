'use client';
import React from 'react';

interface SuggestionCardProps {
  suggestion: any;
  onExecute: () => void;
  onDismiss: () => void;
}

function formatCompactCurrency(value: number): string {
  const v = Number.isFinite(value) ? value : 0;
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

function formatDollars(value: number): string {
  const v = Number.isFinite(value) ? value : 0;
  return `$${v.toFixed(2)}`;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function confidenceLabel(confidence: number): string {
  if (confidence >= 85) return 'ELITE';
  if (confidence >= 75) return 'STRONG';
  if (confidence >= 65) return 'MODERATE';
  return 'WEAK';
}

function getAction(suggestion: any): { badge: string; tone: string } {
  const explicit = suggestion?.action || suggestion?.details?.action;
  if (explicit === 'AVOID' || explicit === 'DONT_BUY') return { badge: 'AVOID', tone: 'bg-slate-700/50 text-slate-200 border-slate-600' };
  if (suggestion?.type === 'OPTIONS') {
    const optType = suggestion?.details?.optionType;
    if (optType === 'PUT') return { badge: 'BUY PUT', tone: 'bg-red-500/15 text-red-200 border-red-500/30' };
    return { badge: 'BUY CALL', tone: 'bg-emerald-500/15 text-emerald-200 border-emerald-500/30' };
  }
  return { badge: 'BUY STOCK', tone: 'bg-blue-500/15 text-blue-200 border-blue-500/30' };
}

function safeDateOnly(expiration: string | undefined): string {
  if (!expiration) return '';
  return String(expiration).split(':')[0];
}

function calcDte(expiration: string | undefined): number | null {
  const exp = safeDateOnly(expiration);
  if (!exp) return null;
  const t = new Date(exp).getTime();
  if (!Number.isFinite(t)) return null;
  const days = Math.ceil((t - Date.now()) / (1000 * 60 * 60 * 24));
  return Number.isFinite(days) ? days : null;
}

function buildWhyBullets(suggestion: any): string[] {
  const bullets: string[] = [];

  // STOCK
  if (suggestion?.type === 'STOCK') {
    const votes = suggestion?.details?.aiVotes;
    if (votes?.bullish && votes?.total) {
      bullets.push(`AI consensus: ${votes.bullish} of ${votes.total} recommend BUY`);
    } else if (suggestion?.reason) {
      bullets.push(String(suggestion.reason));
    }

    const target = suggestion?.details?.targetPrice;
    const cur = suggestion?.currentPrice;
    if (Number.isFinite(target) && Number.isFinite(cur) && cur > 0) {
      const upside = ((target - cur) / cur) * 100;
      if (Number.isFinite(upside)) bullets.push(`Target-based upside: ${upside.toFixed(1)}%`);
    }
  }

  // OPTIONS
  if (suggestion?.type === 'OPTIONS') {
    const premiumTotal = suggestion?.details?.premiumTotal;
    const volOi = suggestion?.details?.volumeOIRatio;
    const dte = suggestion?.details?.daysToExpiration ?? calcDte(suggestion?.details?.expiration);
    const strike = suggestion?.details?.strike;
    const underlying = suggestion?.currentPrice;

    if (Number.isFinite(premiumTotal)) bullets.push(`Institutional premium: ${formatCompactCurrency(premiumTotal)}`);
    if (Number.isFinite(volOi)) bullets.push(`Vol/OI expansion: ${Number(volOi).toFixed(1)}×`);
    if (Number.isFinite(dte)) bullets.push(`Time horizon: ${dte} DTE (positioning window)`);

    if (Number.isFinite(strike) && Number.isFinite(underlying) && underlying > 0) {
      const distPct = (Math.abs(strike - underlying) / underlying) * 100;
      if (Number.isFinite(distPct)) bullets.push(`Strike distance: ${distPct.toFixed(1)}% from spot`);
    }
  }

  // Always cap to 3 bullets to prevent overload.
  return bullets.filter(Boolean).slice(0, 3);
}

export function SuggestionCard({ suggestion, onExecute, onDismiss }: SuggestionCardProps) {
  const companyName = suggestion?.companyName && suggestion.companyName !== suggestion.symbol
    ? suggestion.companyName
    : '';

  const { badge, tone } = getAction(suggestion);
  const isOptions = suggestion?.type === 'OPTIONS';
  const conf = clamp(Number(suggestion?.confidence || 0), 0, 100);
  const confLabel = confidenceLabel(conf);

  // Execution (options)
  const optType = suggestion?.details?.optionType;
  const strike = suggestion?.details?.strike;
  const exp = safeDateOnly(suggestion?.details?.expiration);
  const dte = suggestion?.details?.daysToExpiration ?? calcDte(suggestion?.details?.expiration);
  const premiumPerShare = Number(suggestion?.details?.premium || 0);
  const contractCost = premiumPerShare > 0 ? premiumPerShare * 100 : 0;

  // Execution (stock)
  const target = suggestion?.details?.targetPrice;
  const cur = Number(suggestion?.currentPrice || 0);
  const defaultStop = Number.isFinite(cur) && cur > 0 ? cur * 0.97 : null; // simple placeholder until backend provides invalidation

  const why = buildWhyBullets(suggestion);

  return (
    <div className="p-4 rounded-2xl border bg-slate-900/40 border-slate-800 hover:border-slate-700 transition-colors">
      {/* Header: identity + action */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-lg md:text-xl font-extrabold text-white truncate">
              {companyName ? `${companyName} (` : ''}
              {suggestion?.symbol}
              {companyName ? ')' : ''}
            </h3>
            <span className={`px-2 py-1 rounded-full text-xs font-bold border ${tone}`}>{badge}</span>
          </div>
          <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
            <span className="font-medium text-slate-300">Spot:</span>
            <span className="font-semibold text-slate-200">{formatDollars(cur)}</span>
            {isOptions && Number.isFinite(dte) && dte !== null ? (
              <>
                <span className="text-slate-500">•</span>
                <span>{dte} DTE</span>
              </>
            ) : null}
          </div>
        </div>

        {/* Confidence */}
        <div className="text-right flex-shrink-0">
          <div className="text-lg md:text-xl font-extrabold text-white">{conf}/100</div>
          <div className="text-xs text-slate-400">{confLabel}</div>
        </div>
      </div>

      {/* Execution */}
      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-800">
          <div className="text-xs text-slate-400">Execution</div>

          {isOptions ? (
            <div className="mt-1">
              <div className="text-sm font-bold text-white">
                {(optType || 'CALL')} • ${Number(strike || 0).toFixed(0)} • Exp {exp || '—'}
              </div>
              <div className="mt-1 text-xs text-slate-300">
                Cost: <span className="font-bold text-white">{formatDollars(premiumPerShare)}</span>
                <span className="text-slate-500"> (</span>
                <span className="font-bold text-white">{formatCompactCurrency(contractCost)}</span>
                <span className="text-slate-500"> / contract)</span>
              </div>
            </div>
          ) : (
            <div className="mt-1">
              <div className="text-sm font-bold text-white">Entry near {formatDollars(cur)}</div>
              <div className="mt-1 text-xs text-slate-300">
                Target: <span className="font-bold text-white">{Number.isFinite(target) ? `$${Number(target).toFixed(0)}` : '—'}</span>
                <span className="text-slate-500"> • </span>
                Stop: <span className="font-bold text-white">{defaultStop ? formatDollars(defaultStop) : '—'}</span>
              </div>
            </div>
          )}
        </div>

        <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-800">
          <div className="text-xs text-slate-400">Why (top drivers)</div>
          <ul className="mt-2 space-y-1">
            {why.length > 0 ? (
              why.map((b, i) => (
                <li key={i} className="text-xs text-slate-200 flex gap-2">
                  <span className="text-slate-500">•</span>
                  <span className="leading-relaxed">{b}</span>
                </li>
              ))
            ) : (
              <li className="text-xs text-slate-400">No summary available for this suggestion.</li>
            )}
          </ul>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-4 flex gap-2">
        <button
          onClick={onExecute}
          className="flex-1 py-3 rounded-xl bg-white text-slate-900 font-extrabold text-sm hover:bg-slate-100 transition-colors"
        >
          View full evidence →
        </button>
        <button
          onClick={onDismiss}
          className="px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors text-sm"
          title="Dismiss"
        >
          ✕
        </button>
      </div>

      <div className="mt-2 text-[11px] text-slate-500">
        Detected {new Date(suggestion?.timestamp).toLocaleTimeString()}
      </div>
    </div>
  );
}
