// lib/automationDedupStore.ts
// In-memory suppression to prevent repetitive signals firing every tick.
// NOTE: In Vercel serverless, memory persists best-effort within warm instances.

type DedupEntry = {
  lastAtMs: number;
  lastConfidence: number;
};

const STORE: Map<string, DedupEntry> = new Map();

function clampStore(max: number) {
  if (STORE.size <= max) return;
  // Drop oldest entries
  const items = Array.from(STORE.entries()).sort((a, b) => a[1].lastAtMs - b[1].lastAtMs);
  const drop = Math.max(0, items.length - max);
  for (let i = 0; i < drop; i++) STORE.delete(items[i][0]);
}

export function makeDedupKey(strategyId: string, symbol: string, direction: 'BUY' | 'SELL'): string {
  return [String(strategyId), String(symbol).toUpperCase(), direction].join('|');
}

export function shouldSuppressSignal(opts: {
  key: string;
  nowMs: number;
  windowMinutes: number;
  minConfidenceDelta: number;
  confidence: number;
}): { suppress: boolean; reason?: string } {
  const windowMs = Math.max(0, opts.windowMinutes) * 60 * 1000;
  if (!windowMs) return { suppress: false };

  const prev = STORE.get(opts.key);
  if (!prev) return { suppress: false };

  const age = opts.nowMs - prev.lastAtMs;
  if (age < 0 || age >= windowMs) return { suppress: false };

  const minDelta = Math.max(0, opts.minConfidenceDelta);
  const improved = Number(opts.confidence) >= Number(prev.lastConfidence) + minDelta;
  if (improved) return { suppress: false };

  return {
    suppress: true,
    reason: `Dedup: fired ${Math.round(age / 60000)}m ago (need +${minDelta} confidence to re-alert).`,
  };
}

export function recordSignalFire(key: string, nowMs: number, confidence: number) {
  STORE.set(key, { lastAtMs: nowMs, lastConfidence: Number(confidence) || 0 });
  clampStore(2000);
}

export function resetDedupStore() {
  STORE.clear();
}
