import { getSchwabAccessToken, schwabFetchJson } from '@/lib/schwab';

// ============================================================
// Broker-Truth Daily Realized P/L (Calendar)
//
// Goal: produce a daily realized P/L map using Schwab transactions.
// Implementation notes:
// - Uses TRADE + DIVIDEND OR INTEREST transactions.
// - Computes realized P/L for trades via a simple FIFO lot model built
//   from transactions (robust for both STOCK + OPTION as execution grows).
// - Falls back to TRACKER-based P/L upstream if Schwab auth/API fails.
// ============================================================

type Scope = 'live' | 'paper' | 'all';

type TransferItem = {
  instrument?: {
    symbol?: string;
    assetType?: string;
    cusip?: string;
  };
  amount?: number;
  cost?: number;
  price?: number;
  feeType?: string;
  positionEffect?: string;
};

type Transaction = {
  activityId?: number;
  time?: string;
  tradeDate?: string;
  settlementDate?: string;
  orderId?: number;
  type?: string;
  status?: string;
  description?: string;
  netAmount?: number;
  transferItems?: TransferItem[] | TransferItem;
};

type DayAgg = { pnlUsd: number; trades: number };

function ymdInTZ(iso: string, timeZone: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-CA', { timeZone });
}

function safeNum(v: any): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return null;
  return n;
}

// Heuristic: Schwab wrappers sometimes surface money fields as integers (cents).
// If the value is a large integer (e.g., 12345) assume cents -> $123.45.
function normalizeMoney(v: number): number {
  if (!Number.isFinite(v)) return 0;
  if (Number.isInteger(v) && Math.abs(v) >= 1000) return v / 100;
  return v;
}

function normalizePrice(v: number): number {
  // Same heuristic as money.
  return normalizeMoney(v);
}

function monthBoundsUtc(ym: string): { startIso: string; endIso: string; monthStartIso: string; monthEndIso: string } {
  const [y, m] = ym.split('-').map(Number);
  const monthStart = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0));
  const nextMonth = new Date(Date.UTC(y, m, 1, 0, 0, 0, 0));
  const monthEnd = new Date(nextMonth.getTime() - 1);

  // Build lots with a buffer so sells in-month can match earlier buys.
  const bufferStart = new Date(monthStart.getTime());
  bufferStart.setUTCDate(bufferStart.getUTCDate() - 370);

  return {
    startIso: bufferStart.toISOString(),
    endIso: monthEnd.toISOString(),
    monthStartIso: monthStart.toISOString(),
    monthEndIso: monthEnd.toISOString(),
  };
}

function asArray<T>(v: T | T[] | null | undefined): T[] {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

function instrumentKey(item: TransferItem): string {
  const sym = String(item.instrument?.symbol || '').trim();
  const cusip = String(item.instrument?.cusip || '').trim();
  const asset = String(item.instrument?.assetType || '').trim();
  return [asset || 'UNKNOWN', sym || cusip || 'UNKNOWN'].join(':');
}

function multiplierFor(item: TransferItem): number {
  const asset = String(item.instrument?.assetType || '').toUpperCase();
  return asset === 'OPTION' ? 100 : 1;
}

type Lot = { qty: number; costPerUnit: number; mult: number };

function pickTradeUnitPrice(args: {
  item: TransferItem;
  netAmountUsd: number;
  qty: number;
  mult: number;
}): number {
  const p = safeNum(args.item.price);
  if (p !== null) return Math.abs(normalizePrice(p));
  const c = safeNum(args.item.cost);
  if (c !== null && args.qty > 0) return Math.abs(normalizeMoney(c)) / args.qty / args.mult;
  // Fallback: infer from netAmount (includes fees sometimes; best-effort only).
  if (args.qty > 0) return Math.abs(args.netAmountUsd) / (args.qty * args.mult);
  return 0;
}

function sumFeesUsd(items: TransferItem[]): number {
  let fee = 0;
  for (const it of items) {
    if (!it.feeType) continue;
    const c = safeNum(it.cost);
    const p = safeNum(it.price);
    const amt = c !== null ? normalizeMoney(c) : p !== null ? normalizeMoney(p) : 0;
    if (amt) fee += -Math.abs(amt);
  }
  return fee;
}

export async function computeBrokerTruthDailyRealizedPnl(args: {
  month: string; // YYYY-MM
  scope: Scope;
  timeZone: string;
}): Promise<{
  ok: boolean;
  month: string;
  scope: string;
  timeZone: string;
  source: 'BROKER';
  days: Record<string, DayAgg>;
  meta: any;
  error?: string;
}> {
  try {
    const { startIso, endIso, monthStartIso, monthEndIso } = monthBoundsUtc(args.month);

    // Token: we use the same token plumbing as the rest of the app.
    const tokenResult = await getSchwabAccessToken('tracker', { forceRefresh: false });
    if (!tokenResult.token) {
      return {
        ok: false,
        month: args.month,
        scope: args.scope,
        timeZone: args.timeZone,
        source: 'BROKER',
        days: {},
        meta: { reason: 'no_token' },
        error: tokenResult.error || 'Schwab auth failed',
      };
    }

    // Account hash
    const acctNums = await schwabFetchJson<any[]>(
      tokenResult.token,
      'https://api.schwabapi.com/trader/v1/accounts/accountNumbers',
      { scope: 'tracker' }
    );
    if (!acctNums.ok || !acctNums.data || acctNums.data.length === 0) {
      return {
        ok: false,
        month: args.month,
        scope: args.scope,
        timeZone: args.timeZone,
        source: 'BROKER',
        days: {},
        meta: { reason: 'no_account' },
        error: 'Failed to load Schwab accountNumbers',
      };
    }

    const accountHash = acctNums.data[0].hashValue;

    // Pull transactions needed for realized P/L
    // Schwab expects ISO timestamps for startDate/endDate for this endpoint.
    const types = encodeURIComponent(['TRADE', 'DIVIDEND_OR_INTEREST'].join(','));
    const url = [
      `https://api.schwabapi.com/trader/v1/accounts/${encodeURIComponent(accountHash)}/transactions`,
      `startDate=${encodeURIComponent(startIso)}`,
      `endDate=${encodeURIComponent(endIso)}`,
      `types=${types}`,
    ].join('?');

    const txResp = await schwabFetchJson<Transaction[]>(tokenResult.token, url, { scope: 'tracker' });

    // Split the checks so TypeScript narrows the union correctly.
    if (!txResp.ok) {
      return {
        ok: false,
        month: args.month,
        scope: args.scope,
        timeZone: args.timeZone,
        source: 'BROKER',
        days: {},
        meta: { reason: 'transactions_failed', status: txResp.status },
        error: txResp.error || 'Failed to load transactions',
      };
    }

    const txns = Array.isArray(txResp.data) ? txResp.data : [];

    // Sort chronologically so FIFO lots work.
    txns.sort((a, b) => {
      const ta = new Date(String(a.tradeDate || a.time || '')).getTime();
      const tb = new Date(String(b.tradeDate || b.time || '')).getTime();
      return (ta || 0) - (tb || 0);
    });

    const days: Record<string, DayAgg> = {};
    const lots = new Map<string, Lot[]>();

    const monthStartMs = new Date(monthStartIso).getTime();
    const monthEndMs = new Date(monthEndIso).getTime();

    for (const t of txns) {
      const tTime = String(t.tradeDate || t.time || '');
      const tMs = new Date(tTime).getTime();
      if (!tMs) continue;

      const tType = String(t.type || '').toUpperCase();
      const items = asArray(t.transferItems);

      // Dividend/interest: treat as realized P/L cash flow.
      if (tType === 'DIVIDEND_OR_INTEREST') {
        if (tMs < monthStartMs || tMs > monthEndMs) continue;
        const day = ymdInTZ(tTime, args.timeZone);
        if (!day) continue;
        const net = normalizeMoney(safeNum(t.netAmount) || 0);
        const cur = days[day] || { pnlUsd: 0, trades: 0 };
        cur.pnlUsd += net;
        // Don't count as a trade.
        days[day] = cur;
        continue;
      }

      // Trades -> FIFO realized P/L for sells.
      if (tType !== 'TRADE') continue;

      const netAmountUsd = normalizeMoney(safeNum(t.netAmount) || 0);
      const side: 'BUY' | 'SELL' = netAmountUsd >= 0 ? 'SELL' : 'BUY';

      // Accumulate fees, if provided in transfer items.
      const feeUsd = sumFeesUsd(items);

      // We may have multiple instruments in one transaction (spreads). Support that.
      for (const it of items) {
        const sym = String(it.instrument?.symbol || '').trim();
        if (!sym) continue;

        const qtyRaw = safeNum(it.amount);
        if (qtyRaw === null) continue;
        const qty = Math.abs(qtyRaw);
        if (!qty) continue;

        const mult = multiplierFor(it);
        const key = instrumentKey(it);
        const unitPrice = pickTradeUnitPrice({ item: it, netAmountUsd, qty, mult });

        const qLots = lots.get(key) || [];

        if (side === 'BUY') {
          qLots.push({ qty, costPerUnit: unitPrice, mult });
          lots.set(key, qLots);
          continue;
        }

        // SELL
        let remaining = qty;
        let realized = 0;
        while (remaining > 0 && qLots.length > 0) {
          const lot = qLots[0];
          const m = Math.min(remaining, lot.qty);
          realized += (unitPrice - lot.costPerUnit) * m * lot.mult;
          lot.qty -= m;
          remaining -= m;
          if (lot.qty <= 1e-9) qLots.shift();
        }

        lots.set(key, qLots);

        if (tMs >= monthStartMs && tMs <= monthEndMs) {
          const day = ymdInTZ(tTime, args.timeZone);
          if (!day) continue;
          const cur = days[day] || { pnlUsd: 0, trades: 0 };
          // Fees apply to the transaction as a whole, so add once per transaction.
          // We add fees on the first instrument encountered.
          cur.pnlUsd += realized;
          cur.trades += 1;
          days[day] = cur;
        }
      }

      // Apply fees once (if we had at least one instrument leg) and only inside the month.
      if (feeUsd && tMs >= monthStartMs && tMs <= monthEndMs) {
        const day = ymdInTZ(tTime, args.timeZone);
        if (day) {
          const cur = days[day] || { pnlUsd: 0, trades: 0 };
          cur.pnlUsd += feeUsd;
          days[day] = cur;
        }
      }
    }

    return {
      ok: true,
      month: args.month,
      scope: args.scope,
      timeZone: args.timeZone,
      source: 'BROKER',
      days,
      meta: {
        asOf: new Date().toISOString(),
        accountHash: String(accountHash).slice(0, 8) + '...',
        method: 'FIFO_FROM_TRANSACTIONS',
        range: { startIso, endIso },
        includes: ['TRADE', 'DIVIDEND_OR_INTEREST'],
        note: 'Realized P/L is derived from Schwab transactions via FIFO lots; dividends/interest are included as cash-flow P/L.',
      },
    };
  } catch (e: any) {
    return {
      ok: false,
      month: args.month,
      scope: args.scope,
      timeZone: args.timeZone,
      source: 'BROKER',
      days: {},
      meta: { reason: 'exception' },
      error: String(e?.message || e),
    };
  }
}
