import { getSchwabAccessToken, schwabFetchJson } from '@/lib/schwab';
import { placeMarketEquityOrder, placeMarketOptionOrder } from '@/lib/liveOrders';
import { loadSuggestions, updateSuggestion, type TrackedSuggestion } from '@/lib/trackerStore';
import { TTLCache } from '@/lib/cache';

export type TradeLifecycleAction =
  | { type: 'STOP_UPDATED'; id: string; ticker: string; from: number; to: number; reason: string }
  | { type: 'CLOSED'; id: string; ticker: string; status: string; closePrice: number; reason: string }
  | { type: 'EXIT_SUBMITTED'; id: string; ticker: string; orderId: string; reason: string }
  | { type: 'SKIP'; id: string; ticker: string; reason: string };

function asNumber(v: any, fallback = NaN): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function nowIso(): string {
  return new Date().toISOString();
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

const quoteCache = new TTLCache<number>();

async function fetchQuotePrices(symbols: string[]): Promise<Record<string, number>> {
  const unique = Array.from(new Set(symbols.map((s) => String(s || '').trim().toUpperCase()).filter(Boolean)));
  const out: Record<string, number> = {};
  if (!unique.length) return out;

  // Fill from cache first
  const miss: string[] = [];
  for (const s of unique) {
    const hit = quoteCache.get(`q:${s}`);
    if (typeof hit === 'number' && Number.isFinite(hit)) out[s] = hit;
    else miss.push(s);
  }
  if (!miss.length) return out;

  const tok = await getSchwabAccessToken('tracker');
  if (!tok.token) return out;

  // Schwab supports comma-delimited symbols; chunk to be safe.
  for (const group of chunk(miss, 50)) {
    const url = `https://api.schwabapi.com/marketdata/v1/quotes?symbols=${encodeURIComponent(group.join(','))}&indicative=false`;
    const r = await schwabFetchJson<any>(tok.token, url, { scope: 'tracker' });
    if (!r.ok) continue;

    for (const sym of group) {
      const q = r.data?.quotes?.[sym] || r.data?.[sym] || null;
      const px = asNumber(q?.quote?.lastPrice ?? q?.quote?.mark ?? q?.quote?.closePrice, NaN);
      if (!Number.isFinite(px)) continue;
      out[sym] = px;
      quoteCache.set(`q:${sym}`, px, 15_000); // 15s
    }
  }

  return out;
}

function isAutopilotRow(s: TrackedSuggestion): boolean {
  const kind = (s as any)?.evidencePacket?.kind;
  return kind === 'autopilot_signal_v1';
}

function inferSide(s: TrackedSuggestion): 'LONG' | 'SHORT' {
  const sigAction = String((s as any)?.evidencePacket?.signal?.action || '').toUpperCase();
  if (sigAction === 'SELL') return 'SHORT';
  if (sigAction === 'BUY') return 'LONG';

  const t = String((s as any)?.type || '').toLowerCase();
  if (t.includes('sell') || t.includes('short') || t.includes('put')) return 'SHORT';

  const entry = asNumber((s as any)?.entryPrice, NaN);
  const stop = asNumber((s as any)?.stopLoss, NaN);
  if (Number.isFinite(entry) && Number.isFinite(stop) && stop > entry) return 'SHORT';
  return 'LONG';
}

function isOptionTrade(s: TrackedSuggestion): boolean {
  return Boolean((s as any)?.optionContract?.optionSymbol) || String((s as any)?.type || '').toUpperCase() === 'OPTION';
}

function getOptionOrderSymbol(s: TrackedSuggestion): string {
  return String((s as any)?.optionContract?.optionSymbol || (s as any)?.evidencePacket?.selectedOptionContract?.optionSymbol || '').trim();
}

function hasExitOrder(s: TrackedSuggestion): boolean {
  return Boolean(String((s as any)?.broker?.exitOrderId || '').trim());
}

function isLiveBrokerTrade(s: TrackedSuggestion): boolean {
  const provider = String((s as any)?.broker?.provider || '').toUpperCase();
  const orderId = String((s as any)?.broker?.orderId || (s as any)?.evidencePacket?.orderId || '').trim();
  return provider === 'SCHWAB' || Boolean(orderId);
}


export async function runTradeLifecycleSweep(opts?: {
  dryRun?: boolean;
  // If true, only manage trades created by autopilot.
  autopilotOnly?: boolean;
  // Time-stop in days for ACTIVE trades.
  timeStopDays?: number;
  // Trailing stop controls (simple “lock-in” trail)
  enableTrailing?: boolean;
  trailAfterR?: number;
  trailLockInR?: number;
  // If true, submit broker exit orders when stop/target/time-stop are hit (LIVE only).
  executeLiveExits?: boolean;
}): Promise<{ ok: boolean; actions: TradeLifecycleAction[]; meta: any }> {
  const dryRun = Boolean(opts?.dryRun);
  const autopilotOnly = opts?.autopilotOnly !== false;

  const timeStopDays = Math.max(0, Math.min(120, Number(opts?.timeStopDays ?? 10)));
  const enableTrailing = Boolean(opts?.enableTrailing ?? true);
  const trailAfterR = Math.max(0, Math.min(10, Number(opts?.trailAfterR ?? 1.0)));
  const trailLockInR = Math.max(0, Math.min(5, Number(opts?.trailLockInR ?? 0.1)));
  const executeLiveExits = Boolean(opts?.executeLiveExits ?? true);

  const all = await loadSuggestions();
  const active = all.filter((s) => String((s as any)?.status || '') === 'ACTIVE');
  const rows = autopilotOnly ? active.filter(isAutopilotRow) : active;

  const tickers = rows.map((s) => String((s as any)?.ticker || '').toUpperCase()).filter(Boolean);
  const prices = await fetchQuotePrices(tickers);

  const actions: TradeLifecycleAction[] = [];
  let closed = 0;
  let stopUpdates = 0;

  async function submitExitIfLive(s: TrackedSuggestion, ticker: string, reason: string): Promise<{ ok: boolean; orderId?: string; error?: string }> {
    if (!executeLiveExits) return { ok: false, error: 'execute_disabled' };
    if (!isLiveBrokerTrade(s)) return { ok: false, error: 'not_live' };
    if (hasExitOrder(s)) return { ok: false, error: 'exit_already_submitted' };
    if (process.env.ALLOW_LIVE_AUTOPILOT !== 'true') return { ok: false, error: 'env_block' };

    if (isOptionTrade(s)) {
      const optSym = getOptionOrderSymbol(s);
      if (!optSym) return { ok: false, error: 'missing_option_symbol' };
      const qty = Math.max(1, Math.min(2000, Number((s as any)?.positionContracts || (s as any)?.broker?.filledQuantity || 1)));
      if (dryRun) return { ok: true, orderId: 'dry_run' };
      const placed = await placeMarketOptionOrder(optSym, qty, 'SELL_TO_CLOSE');
      if (!placed.ok || !placed.orderId) return { ok: false, error: placed.error || 'option_exit_failed' };
      await updateSuggestion(String((s as any)?.id || ''), {
        broker: {
          ...((s as any)?.broker || {}),
          provider: 'SCHWAB',
          exitOrderId: placed.orderId,
          exitStatus: 'SUBMITTED',
          exitSubmittedAt: nowIso(),
          lastUpdate: nowIso(),
        },
      } as any);
      return { ok: true, orderId: placed.orderId };
    }

    const side = inferSide(s);
    const instruction = side === 'LONG' ? 'SELL' : 'BUY';
    const qty = Math.max(1, Math.min(10000, Number((s as any)?.positionShares || (s as any)?.broker?.filledQuantity || 1)));
    if (dryRun) return { ok: true, orderId: 'dry_run' };
    const placed = await placeMarketEquityOrder(ticker, qty, instruction as any);
    if (!placed.ok || !placed.orderId) return { ok: false, error: placed.error || 'equity_exit_failed' };
    await updateSuggestion(String((s as any)?.id || ''), {
      broker: {
        ...((s as any)?.broker || {}),
        provider: 'SCHWAB',
        exitOrderId: placed.orderId,
        exitStatus: 'SUBMITTED',
        exitSubmittedAt: nowIso(),
        lastUpdate: nowIso(),
      },
    } as any);
    return { ok: true, orderId: placed.orderId };
  }

  for (const s of rows) {
    const id = String((s as any)?.id || '');
    const ticker = String((s as any)?.ticker || '').toUpperCase();
    if (!id || !ticker) continue;

    const px = prices[ticker];
    if (!Number.isFinite(px)) {
      actions.push({ type: 'SKIP', id, ticker, reason: 'No quote price available' });
      continue;
    }

    const entry = asNumber((s as any)?.entryPrice, NaN);
    const stop = asNumber((s as any)?.stopLoss, NaN);
    const target = asNumber((s as any)?.targetPrice, NaN);
    if (!Number.isFinite(entry) || !Number.isFinite(stop) || !Number.isFinite(target)) {
      actions.push({ type: 'SKIP', id, ticker, reason: 'Missing entry/stop/target' });
      continue;
    }

    const side = inferSide(s);
    const risk = side === 'LONG' ? entry - stop : stop - entry;
    if (!(risk > 0)) {
      actions.push({ type: 'SKIP', id, ticker, reason: 'Invalid risk (entry/stop)' });
      continue;
    }

    // 1) Trailing stop (simple lock-in)
    if (enableTrailing) {
      const triggerPx = side === 'LONG' ? entry + trailAfterR * risk : entry - trailAfterR * risk;
      const hasTriggered = side === 'LONG' ? px >= triggerPx : px <= triggerPx;
      if (hasTriggered) {
        const lockStop = side === 'LONG' ? entry + trailLockInR * risk : entry - trailLockInR * risk;
        const improved = side === 'LONG' ? lockStop > stop : lockStop < stop;
        if (improved && Number.isFinite(lockStop)) {
          if (!dryRun) {
            await updateSuggestion(id, { stopLoss: lockStop });
          }
          stopUpdates += 1;
          actions.push({ type: 'STOP_UPDATED', id, ticker, from: stop, to: lockStop, reason: `Trail lock-in after ${trailAfterR}R` });
          // Update local stop value for subsequent checks
          (s as any).stopLoss = lockStop;
        }
      }
    }

    // Use potentially updated stop
    const effectiveStop = asNumber((s as any)?.stopLoss, stop);

    // 2) Target / stop checks
    const hitTarget = side === 'LONG' ? px >= target : px <= target;
    const hitStop = side === 'LONG' ? px <= effectiveStop : px >= effectiveStop;

    if (hitTarget) {
      // LIVE broker-truth: submit an exit order instead of marking closed locally.
      if (executeLiveExits && isLiveBrokerTrade(s)) {
        const r = await submitExitIfLive(s, ticker, 'target');
        if (r.ok && r.orderId && r.orderId !== 'dry_run') {
          actions.push({ type: 'EXIT_SUBMITTED', id, ticker, orderId: r.orderId, reason: 'Target reached' });
          continue;
        }
        if (r.error === 'exit_already_submitted') {
          actions.push({ type: 'SKIP', id, ticker, reason: 'Exit already submitted' });
          continue;
        }
        if (r.error === 'env_block') {
          actions.push({ type: 'SKIP', id, ticker, reason: 'LIVE exits blocked: set ALLOW_LIVE_AUTOPILOT=true' });
          continue;
        }
        if (r.error && r.error !== 'not_live') {
          actions.push({ type: 'SKIP', id, ticker, reason: 'Exit submission failed: ' + r.error });
          continue;
        }
      }

      closed += 1;
      if (!dryRun) {
        await updateSuggestion(id, {
          status: 'HIT_TARGET',
          closedAt: nowIso(),
          closedPrice: px,
        } as any);
      }
      actions.push({ type: 'CLOSED', id, ticker, status: 'HIT_TARGET', closePrice: px, reason: 'Target reached' });
      continue;
    }
    if (hitStop) {
      // LIVE broker-truth: submit an exit order instead of marking closed locally.
      if (executeLiveExits && isLiveBrokerTrade(s)) {
        const r = await submitExitIfLive(s, ticker, 'stop');
        if (r.ok && r.orderId && r.orderId !== 'dry_run') {
          actions.push({ type: 'EXIT_SUBMITTED', id, ticker, orderId: r.orderId, reason: 'Stop hit' });
          continue;
        }
        if (r.error === 'exit_already_submitted') {
          actions.push({ type: 'SKIP', id, ticker, reason: 'Exit already submitted' });
          continue;
        }
        if (r.error === 'env_block') {
          actions.push({ type: 'SKIP', id, ticker, reason: 'LIVE exits blocked: set ALLOW_LIVE_AUTOPILOT=true' });
          continue;
        }
        if (r.error && r.error !== 'not_live') {
          actions.push({ type: 'SKIP', id, ticker, reason: 'Exit submission failed: ' + r.error });
          continue;
        }
      }

      closed += 1;
      if (!dryRun) {
        await updateSuggestion(id, {
          status: 'STOPPED_OUT',
          closedAt: nowIso(),
          closedPrice: px,
        } as any);
      }
      actions.push({ type: 'CLOSED', id, ticker, status: 'STOPPED_OUT', closePrice: px, reason: 'Stop hit' });
      continue;
    }

    // 3) Time stop
    if (timeStopDays > 0) {
      const createdAt = new Date(String((s as any)?.createdAt || '')).getTime();
      if (Number.isFinite(createdAt) && Date.now() - createdAt > timeStopDays * 24 * 60 * 60 * 1000) {
        // LIVE broker-truth: submit an exit order instead of marking closed locally.
        if (executeLiveExits && isLiveBrokerTrade(s)) {
          const r = await submitExitIfLive(s, ticker, 'time_stop');
          if (r.ok && r.orderId && r.orderId !== 'dry_run') {
            actions.push({ type: 'EXIT_SUBMITTED', id, ticker, orderId: r.orderId, reason: `Time stop (${timeStopDays}d)` });
            continue;
          }
          if (r.error === 'exit_already_submitted') {
            actions.push({ type: 'SKIP', id, ticker, reason: 'Exit already submitted' });
            continue;
          }
          if (r.error === 'env_block') {
            actions.push({ type: 'SKIP', id, ticker, reason: 'LIVE exits blocked: set ALLOW_LIVE_AUTOPILOT=true' });
            continue;
          }
          if (r.error && r.error !== 'not_live') {
            actions.push({ type: 'SKIP', id, ticker, reason: 'Exit submission failed: ' + r.error });
            continue;
          }
        }

        closed += 1;
        if (!dryRun) {
          await updateSuggestion(id, {
            status: 'CLOSED',
            closedAt: nowIso(),
            closedPrice: px,
          } as any);
        }
        actions.push({ type: 'CLOSED', id, ticker, status: 'CLOSED', closePrice: px, reason: `Time stop (${timeStopDays}d)` });
        continue;
      }
    }
  }

  return {
    ok: true,
    actions,
    meta: {
      inspected: rows.length,
      priceHits: Object.keys(prices).length,
      closed,
      stopUpdates,
      dryRun,
      autopilotOnly,
      timeStopDays,
      enableTrailing,
      trailAfterR,
      trailLockInR,
    },
  };
}
