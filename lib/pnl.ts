import type { TrackedSuggestion } from '@/lib/trackerStore';

function asNumber(v: any, fallback = 0): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function computeRealizedPnlUsd(s: TrackedSuggestion): number {
  const entry = asNumber(s.entryPrice, 0);
  const exit = asNumber(s.closedPrice, 0);
  if (!entry || !exit) return 0;

  const isOption = Boolean(s.optionContract);
  if (isOption) {
    const contracts = asNumber(s.positionContracts, 5);
    const mult = asNumber(s.contractMultiplier, 100);
    return (exit - entry) * contracts * mult;
  }

  const shares = asNumber(s.positionShares, 100);
  return (exit - entry) * shares;
}

export function isClosedStatus(status?: string): boolean {
  const s = String(status || '').toUpperCase();
  return s === 'CLOSED' || s === 'HIT_TARGET' || s === 'STOPPED_OUT' || s === 'EXPIRED' || s === 'CANCELED';
}
