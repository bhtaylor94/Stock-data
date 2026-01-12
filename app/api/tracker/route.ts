import { NextRequest, NextResponse } from 'next/server';
import { getSnapshotStore } from '@/lib/storage/snapshotStore';
import { getSchwabAccessToken, schwabFetchJson } from '@/lib/schwab';
import { TTLCache } from '@/lib/cache';
import {
  loadSuggestions,
  upsertSuggestion,
  updateSuggestion,
  deleteSuggestion,
  TrackedSuggestion,
  TrackedSuggestionStatus,
} from '@/lib/trackerStore';

export const runtime = 'nodejs';

// ============================================================
// SUGGESTION TRACKER API (durable JSON store by default)
// Notes:
// - Uses file-backed storage for consistency across dev restarts.
// - On serverless platforms, filesystem may be ephemeral. For true durability,
//   set TRACKER_STORE_PATH to a persistent volume or migrate to KV/DB.
// ============================================================

const quoteCache = new TTLCache<{ last: number; price: number }>();
const chainCache = new TTLCache<any>();

function asNumber(v: any, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function computeDte(expirationIso: string): number | null {
  const dt = new Date(expirationIso);
  if (Number.isNaN(dt.getTime())) return null;
  const now = new Date();
  // DTE counted in whole days until expiration date (end of day)
  const end = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate(), 23, 59, 59));
  const ms = end.getTime() - now.getTime();
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}

async function fetchUnderlyingPrice(token: string, ticker: string): Promise<number | null> {
  const key = `quote:${ticker}`;
  const hit = quoteCache.get(key);
  if (hit) return hit.price;

  const url = `https://api.schwabapi.com/marketdata/v1/quotes?symbols=${encodeURIComponent(ticker)}&indicative=false`;
  const r = await schwabFetchJson<any>(token, url);
  if (!r.ok) return null;

  const q = r.data?.quotes?.[ticker] || r.data?.[ticker] || null;
  const price = asNumber(q?.quote?.lastPrice ?? q?.quote?.mark ?? q?.quote?.closePrice, NaN);
  if (!Number.isFinite(price)) return null;

  quoteCache.set(key, { last: Date.now(), price }, 15_000); // 15s (accuracy-first)
  return price;
}

async function fetchOptionsChain(token: string, ticker: string): Promise<any | null> {
  const key = `chain:${ticker}`;
  const hit = chainCache.get(key);
  if (hit) return hit;

  const url = `https://api.schwabapi.com/marketdata/v1/chains?symbol=${encodeURIComponent(ticker)}&contractType=ALL&strikeCount=80&includeUnderlyingQuote=true&range=ALL`;
  const r = await schwabFetchJson<any>(token, url);
  if (!r.ok) return null;

  // Very short TTL to preserve accuracy while avoiding repeated fanout.
  chainCache.set(key, r.data, 20_000);
  return r.data;
}

function findOptionFromChain(
  chain: any,
  expirationIso: string,
  strike: number,
  optionType: 'CALL' | 'PUT'
): { bid?: number; ask?: number; mark?: number; delta?: number; symbol?: string } | null {
  if (!chain) return null;

  // Schwab chain shape: callExpDateMap / putExpDateMap like:
  // { '2026-01-17:7': { '200.0': [ { bid, ask, mark, delta, symbol, ... } ] } }
  const expMap = optionType === 'CALL' ? chain.callExpDateMap : chain.putExpDateMap;
  if (!expMap) return null;

  const expKey = Object.keys(expMap).find(k => k.startsWith(expirationIso));
  if (!expKey) return null;

  const strikeMap = expMap[expKey];
  if (!strikeMap) return null;

  const strikeKey =
    Object.keys(strikeMap).find(k => Math.abs(Number(k) - strike) < 1e-9) ??
    Object.keys(strikeMap).find(k => Math.abs(Number(k) - strike) < 0.001);

  if (!strikeKey) return null;

  const contracts = strikeMap[strikeKey];
  const c = Array.isArray(contracts) ? contracts[0] : null;
  if (!c) return null;

  return {
    bid: asNumber(c.bid, NaN),
    ask: asNumber(c.ask, NaN),
    mark: asNumber(c.mark, NaN),
    delta: asNumber(c.delta, NaN),
    symbol: c.symbol,
  };
}

function midPrice(bid?: number, ask?: number, mark?: number): number | null {
  const m = asNumber(mark, NaN);
  if (Number.isFinite(m) && m > 0) return m;
  const b = asNumber(bid, NaN);
  const a = asNumber(ask, NaN);
  if (Number.isFinite(b) && Number.isFinite(a) && a >= b) return (a + b) / 2;
  if (Number.isFinite(a)) return a;
  if (Number.isFinite(b)) return b;
  return null;
}

function computeSuggestionPnl(s: TrackedSuggestion, currentUnderlying: number | null, currentOption: number | null) {
  const isOption = Boolean(s.optionContract);
  const entry = asNumber(s.entryPrice, NaN);
  if (!Number.isFinite(entry) || entry <= 0) return { pnl: 0, pnlPct: 0, currentPrice: null };

  if (!isOption) {
    if (!Number.isFinite(currentUnderlying ?? NaN)) return { pnl: 0, pnlPct: 0, currentPrice: null };
    const cur = currentUnderlying as number;
    const shares = asNumber((s as any).positionShares, 1);
    const pnl = (cur - entry) * shares;
    const pnlPct = ((cur - entry) / entry) * 100;
    return { pnl, pnlPct, currentPrice: cur };
  }

  // Options: prefer real option mid/mark for accuracy.
  const curOpt = currentOption;
  if (!Number.isFinite(curOpt ?? NaN)) return { pnl: 0, pnlPct: 0, currentPrice: null };

  const contracts = asNumber((s as any).positionContracts, 1);
  const multiplier = asNumber((s as any).contractMultiplier, 100);
  const pnl = ((curOpt as number) - entry) * contracts * multiplier;
  const pnlPct = (((curOpt as number) - entry) / entry) * 100;
  return { pnl, pnlPct, currentPrice: curOpt as number };
}

type DailyCandle = { datetime: number; close: number };

async function fetchDailyCandles(token: string, ticker: string, startMs: number, endMs: number): Promise<DailyCandle[]> {
  try {
    const url = `https://api.schwabapi.com/marketdata/v1/pricehistory?symbol=${encodeURIComponent(
      ticker
    )}&periodType=day&period=30&frequencyType=daily&frequency=1&startDate=${startMs}&endDate=${endMs}`;
    const r = await schwabFetchJson<any>(token, url);
    if (!r.ok) return [];
    const candles = Array.isArray(r.data?.candles) ? r.data.candles : [];
    return candles
      .map((c: any) => ({ datetime: asNumber(c.datetime, 0), close: asNumber(c.close, NaN) }))
      .filter((c: any) => Number.isFinite(c.close) && c.datetime > 0)
      .sort((a: any, b: any) => a.datetime - b.datetime);
  } catch {
    return [];
  }
}

function candleCloseOnOrAfter(candles: DailyCandle[], targetMs: number): number | null {
  for (const c of candles) {
    if (c.datetime >= targetMs && Number.isFinite(c.close)) return c.close;
  }
  // If we don't have a candle on/after, use last available.
  const last = candles.length ? candles[candles.length - 1] : null;
  return last && Number.isFinite(last.close) ? last.close : null;
}

async function computeStockOutcomesBestEffort(token: string, ticker: string, entryIso: string, entryPrice: number) {
  const entryMs = new Date(entryIso).getTime();
  if (!Number.isFinite(entryMs) || entryMs <= 0) return null;
  if (!Number.isFinite(entryPrice) || entryPrice <= 0) return null;

  const horizons = [1, 3, 5, 10, 14];
  const startMs = entryMs - 2 * 24 * 60 * 60 * 1000;
  const endMs = entryMs + 20 * 24 * 60 * 60 * 1000;
  const candles = await fetchDailyCandles(token, ticker, startMs, endMs);
  if (!candles.length) return null;

  const returnsPct: Record<string, number> = {};
  const prices: Record<string, number> = {};
  for (const d of horizons) {
    const targetMs = entryMs + d * 24 * 60 * 60 * 1000;
    const px = candleCloseOnOrAfter(candles, targetMs);
    if (Number.isFinite(px ?? NaN)) {
      const key = `d${d}`;
      prices[key] = px as number;
      returnsPct[key] = (((px as number) - entryPrice) / entryPrice) * 100;
    }
  }

  return {
    asOf: new Date().toISOString(),
    horizonDays: horizons,
    returnsPct,
    prices,
  };
}

export async function GET(request: NextRequest) {

// Phase 3: Snapshot audit trail (best-effort on Vercel, durable on Optiplex/local)
try {
  const url = new URL(request.url);
  const ticker = (url.searchParams.get('ticker') || '').trim().toUpperCase();
  const wantSnapshots = url.searchParams.get('snapshots') === '1' || url.searchParams.get('snapshots') === 'true';
  if (wantSnapshots && ticker) {
    const limit = Math.min(200, Math.max(1, Number(url.searchParams.get('limit') || 50)));
    const store = await getSnapshotStore();
	    const rows = await store.getSnapshotsByTicker(ticker, limit);
    return NextResponse.json({ ticker, count: rows.length, snapshots: rows });
  }
} catch {}

  try {
    const tokenRes = await getSchwabAccessToken('tracker');
    if (!tokenRes.token) {
      return NextResponse.json({ error: tokenRes.error || 'Auth error' }, { status: tokenRes.status || 500 });
    }

    const token = tokenRes.token;
    const suggestions = await loadSuggestions();

    // Fetch prices in parallel (accuracy-first but fast)
    const uniqueTickers = Array.from(new Set(suggestions.map(s => s.ticker)));
    const tickerPricesEntries = await Promise.all(
      uniqueTickers.map(async t => [t, await fetchUnderlyingPrice(token, t)] as const)
    );
    const tickerPrices = Object.fromEntries(tickerPricesEntries);

    // Option chains only for tickers that have options tracked
    const optionTickers = Array.from(new Set(suggestions.filter(s => s.optionContract).map(s => s.ticker)));
    const chainEntries = await Promise.all(optionTickers.map(async t => [t, await fetchOptionsChain(token, t)] as const));
    const chains = Object.fromEntries(chainEntries);

    const nowIso = new Date().toISOString();

    // Persist status transitions/outcomes best-effort so calibration is based on stable records.
    const pendingPatches: Array<{ id: string; patch: Partial<TrackedSuggestion> }> = [];

    const enriched = suggestions.map(s => {
      const underlying = tickerPrices[s.ticker] ?? null;

      let status: TrackedSuggestionStatus = s.status;

      // Compute live DTE and expire when <= 0
      let liveDte: number | null = null;
      if (s.optionContract?.expiration) {
        liveDte = computeDte(s.optionContract.expiration);
        if (liveDte !== null && liveDte <= 0 && status === 'ACTIVE') status = 'EXPIRED';
      }

      let optionMid: number | null = null;
      if (s.optionContract) {
        const optType = s.optionContract.optionType || (s.type === 'PUT' ? 'PUT' : 'CALL');
        const chain = chains[s.ticker] ?? null;
        const hit = findOptionFromChain(chain, s.optionContract.expiration, s.optionContract.strike, optType);
        optionMid = midPrice(hit?.bid, hit?.ask, hit?.mark);
      }

      const perf = computeSuggestionPnl(s, underlying, optionMid);

      // IMPORTANT: Do NOT auto-transition ACTIVE positions into terminal statuses.
      // Users explicitly mark outcomes (Hit / Missed / Cancel / Close) from the UI.
      // We still compute live P/L, but we avoid unexpected "auto-closed" behavior.

      // If status transitioned to terminal, persist closedAt/closedPrice once.
      if (status !== s.status && ['HIT_TARGET', 'MISSED_TARGET', 'STOPPED_OUT', 'CLOSED', 'EXPIRED', 'CANCELED'].includes(status)) {
        const closedPrice = Number.isFinite(perf.currentPrice ?? NaN) ? (perf.currentPrice as number) : undefined;
        pendingPatches.push({
          id: s.id,
          patch: {
            status,
            closedAt: nowIso,
            closedPrice,
          },
        });
      }

      return {
        ...s,
        status,
        updatedAt: nowIso,
        currentPrice: perf.currentPrice ?? underlying ?? null,
        pnl: perf.pnl,
        pnlPct: perf.pnlPct,
        optionContract: s.optionContract
          ? {
              ...s.optionContract,
              dte: liveDte ?? s.optionContract.dte,
            }
          : undefined,
      };
    });

    // Lazy outcome computation for STOCK suggestions once there is enough time since entry.
    // Options outcomes are measured using realized close (no reliable option history available here).
    if (token) {
      const nowMs = Date.now();
      const needs = enriched.filter((s: any) => {
        if (s.optionContract) return false;
        const entryMs = new Date(s.createdAt).getTime();
        if (!Number.isFinite(entryMs) || entryMs <= 0) return false;
        const ageDays = (nowMs - entryMs) / (24 * 60 * 60 * 1000);
        if (ageDays < 1) return false;
        // compute once unless missing keys
        return !s.outcomes || !s.outcomes.returnsPct || Object.keys(s.outcomes.returnsPct).length < 2;
      });

      for (const s of needs as any[]) {
        try {
          const outcomes = await computeStockOutcomesBestEffort(token, s.ticker, s.createdAt, asNumber(s.entryPrice, 0));
          if (outcomes) pendingPatches.push({ id: s.id, patch: { outcomes } });
        } catch {}
      }
    }

    // Apply patches (best-effort). This prevents repeated recomputation and stabilizes calibration.
    for (const p of pendingPatches) {
      try {
        await updateSuggestion(p.id, p.patch);
      } catch {}
    }

    // Summary stats
    const active = enriched.filter(s => s.status === 'ACTIVE');
    const realized = enriched.filter(s => ['HIT_TARGET', 'MISSED_TARGET', 'STOPPED_OUT', 'CLOSED', 'EXPIRED', 'CANCELED'].includes(s.status));

    const totalPnl = enriched.reduce((sum, s: any) => sum + asNumber(s.pnl, 0), 0);
    const avgPnlPct =
      enriched.length > 0 ? enriched.reduce((sum, s: any) => sum + asNumber(s.pnlPct, 0), 0) / enriched.length : 0;
    // Measured accuracy metrics (calibration feedback)
    const bucketFromConfidence = (c: any) => {
      const v = asNumber(c, 0);
      if (v >= 75) return 'HIGH';
      if (v >= 60) return 'MED';
      if (v > 0) return 'LOW';
      return 'N/A';
    };

    const realizedForMetrics = realized.filter(s => typeof s.confidence === 'number' && s.confidence > 0);

    const byBucket: Record<string, any> = {};
    for (const s of realizedForMetrics as any[]) {
      const b = bucketFromConfidence(s.confidence);
      byBucket[b] = byBucket[b] || { count: 0, wins: 0, avgPnlPct: 0 };
      byBucket[b].count += 1;
      const win = (s.status === 'HIT_TARGET') || asNumber(s.pnlPct, 0) > 0;
      if (win) byBucket[b].wins += 1;
      byBucket[b].avgPnlPct += asNumber(s.pnlPct, 0);
    }
    Object.keys(byBucket).forEach(k => {
      byBucket[k].winRate = byBucket[k].count ? (byBucket[k].wins / byBucket[k].count) : 0;
      byBucket[k].avgPnlPct = byBucket[k].count ? (byBucket[k].avgPnlPct / byBucket[k].count) : 0;
    });

    const bySetup: Record<string, any> = {};
    for (const s of realized as any[]) {
      const key = (s.setup || s.strategy || s.type || 'UNKNOWN') as string;
      bySetup[key] = bySetup[key] || { count: 0, wins: 0, avgPnlPct: 0 };
      bySetup[key].count += 1;
      const win = (s.status === 'HIT_TARGET') || asNumber(s.pnlPct, 0) > 0;
      if (win) bySetup[key].wins += 1;
      bySetup[key].avgPnlPct += asNumber(s.pnlPct, 0);
    }
    Object.keys(bySetup).forEach(k => {
      bySetup[k].winRate = bySetup[k].count ? (bySetup[k].wins / bySetup[k].count) : 0;
      bySetup[k].avgPnlPct = bySetup[k].count ? (bySetup[k].avgPnlPct / bySetup[k].count) : 0;
    });

return NextResponse.json({
      suggestions: enriched,
      stats: {
        totalTracked: enriched.length,
        activeCount: active.length,
        closedCount: realized.length,
        totalPnl,
        avgPnlPct,
        byBucket,
        bySetup,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: `Tracker GET error: ${String(err)}` }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });

    const now = new Date().toISOString();

    const suggestion: TrackedSuggestion = {
      id: String(body.id || `${body.ticker || 'UNK'}-${Date.now()}`),
      ticker: String(body.ticker || '').toUpperCase(),
      type: String(body.type || 'BUY'),
      strategy: String(body.strategy || ''),
      setup: body.setup ? String(body.setup) : undefined,
      regime: body.regime ? String(body.regime) : undefined,
      entryPrice: asNumber(body.entryPrice, 0),
      targetPrice: asNumber(body.targetPrice, 0),
      stopLoss: asNumber(body.stopLoss, 0),
      confidence: asNumber(body.confidence, 0),
      // Position sizing assumptions (accuracy-first defaults):
      // - Stocks default to 1 share
      // - Options default to 1 contract, 100 multiplier
      // The client can override these explicitly.
      positionShares: body.optionContract
        ? undefined
        : asNumber(body.positionShares, 1),
      positionContracts: body.optionContract
        ? asNumber(body.positionContracts, 1)
        : undefined,
      contractMultiplier: body.optionContract
        ? asNumber(body.contractMultiplier, 100)
        : undefined,
      reasoning: Array.isArray(body.reasoning) ? body.reasoning.map(String) : [],
      status: (body.status as TrackedSuggestionStatus) || 'ACTIVE',
      createdAt: now,
      updatedAt: now,
      // Evidence payload is optional but strongly recommended.
      // Keep this reasonably small; it is meant to back up the suggestion
      // with concrete indicator readings and detected setups.
      evidence: body.evidence ?? undefined,
      evidencePacket: body.evidencePacket ?? undefined,
      optionContract: body.optionContract
        ? {
            strike: asNumber(body.optionContract.strike, 0),
            expiration: String(body.optionContract.expiration || ''),
            dte: asNumber(body.optionContract.dte, 0),
            delta: asNumber(body.optionContract.delta, 0),
            entryAsk: asNumber(body.optionContract.entryAsk, 0),
            optionType: body.optionContract.optionType === 'PUT' ? 'PUT' : 'CALL',
          }
        : undefined,
    };

    if (!suggestion.ticker) return NextResponse.json({ error: 'ticker is required' }, { status: 400 });
    if (!Number.isFinite(suggestion.entryPrice) || suggestion.entryPrice <= 0)
      return NextResponse.json({ error: 'entryPrice must be > 0' }, { status: 400 });

    await upsertSuggestion(suggestion);

    return NextResponse.json({ success: true, suggestion, message: 'Suggestion tracked successfully' });
  } catch (err: any) {
    return NextResponse.json({ error: `Tracker POST error: ${String(err)}` }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const tokenRes = await getSchwabAccessToken('tracker');
    const token = tokenRes.token || null;

    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });

    const id = String(body.id || '');
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    // If closing and no closedPrice provided, fetch a live price (underlying or option)
    let closedPrice: number | undefined = body.closedPrice !== undefined ? asNumber(body.closedPrice, NaN) : undefined;
    if (body.status === 'CLOSED' && (!Number.isFinite(closedPrice ?? NaN) || (closedPrice as any) <= 0)) {
      // Need suggestion to determine instrument
      const all = await loadSuggestions();
      const s = all.find(x => x.id === id) || null;

      if (s && token) {
        if (!s.optionContract) {
          const u = await fetchUnderlyingPrice(token, s.ticker);
          if (Number.isFinite(u ?? NaN)) closedPrice = u as number;
        } else {
          const chain = await fetchOptionsChain(token, s.ticker);
          const optType = s.optionContract.optionType || (s.type === 'PUT' ? 'PUT' : 'CALL');
          const hit = findOptionFromChain(chain, s.optionContract.expiration, s.optionContract.strike, optType);
          const mid = midPrice(hit?.bid, hit?.ask, hit?.mark);
          if (Number.isFinite(mid ?? NaN)) closedPrice = mid as number;
        }
      }
    }

    const nextStatus: TrackedSuggestionStatus = (body.status as TrackedSuggestionStatus) || 'ACTIVE';
    const isTerminal = ['HIT_TARGET', 'MISSED_TARGET', 'STOPPED_OUT', 'CLOSED', 'EXPIRED', 'CANCELED'].includes(nextStatus);

    const patch: Partial<TrackedSuggestion> = {
      status: nextStatus,
      closedAt: isTerminal ? new Date().toISOString() : undefined,
      closedPrice: Number.isFinite(closedPrice ?? NaN) ? (closedPrice as number) : undefined,
    };

    const updated = await updateSuggestion(id, patch);
    if (!updated) return NextResponse.json({ error: 'Suggestion not found' }, { status: 404 });

    return NextResponse.json({ success: true, suggestion: updated, message: 'Suggestion updated successfully' });
  } catch (err: any) {
    return NextResponse.json({ error: `Tracker PUT error: ${String(err)}` }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = String(searchParams.get('id') || '');
    if (!id) return NextResponse.json({ error: 'id query param required' }, { status: 400 });

    const ok = await deleteSuggestion(id);
    if (!ok) return NextResponse.json({ error: 'Suggestion not found' }, { status: 404 });

    return NextResponse.json({ success: true, message: 'Suggestion deleted successfully' });
  } catch (err: any) {
    return NextResponse.json({ error: `Tracker DELETE error: ${String(err)}` }, { status: 500 });
  }
}
