import { computeBrokerTruthDailyRealizedPnl } from '@/lib/brokerTruth/pnlCalendar';
import { getAccountDetails, getPrimaryAccountHash } from '@/lib/schwabBroker';
import { getQuotes } from '@/lib/schwabMarketData';

export type Scope = 'live' | 'paper' | 'all';

export type BrokerTruthPnlSummary = {
  ok: boolean;
  scope: Scope;
  timeZone: string;
  source: 'BROKER';
  realized: {
    todayUsd: number;
    wtdUsd: number;
    mtdUsd: number;
  };
  unrealized: {
    totalUsd: number;
  };
  positions: Array<{
    symbol: string;
    assetType: string;
    quantity: number;
    averagePrice: number;
    currentPrice: number;
    marketValue: number;
    unrealizedUsd: number;
    unrealizedPct: number;
  }>;
  balances?: {
    cashBalance?: number;
    buyingPower?: number;
    equity?: number;
  };
  meta: any;
  error?: string;
};

function safeNum(v: any): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function ymdInTZ(d: Date, timeZone: string): string {
  // en-CA returns YYYY-MM-DD
  return d.toLocaleDateString('en-CA', { timeZone });
}

function monthKeyInTZ(d: Date, timeZone: string): string {
  const ymd = ymdInTZ(d, timeZone);
  return ymd.slice(0, 7);
}

function startOfWeekYmd(ymd: string): string {
  // Week starts Monday.
  // ymd is YYYY-MM-DD.
  const d = new Date(ymd + 'T00:00:00Z');
  const dow = d.getUTCDay(); // 0=Sun
  const daysFromMon = (dow + 6) % 7;
  d.setUTCDate(d.getUTCDate() - daysFromMon);
  return d.toISOString().slice(0, 10);
}

function sumDays(days: Record<string, { pnlUsd: number }>, fromYmd: string, toYmd: string): number {
  let sum = 0;
  for (const [k, v] of Object.entries(days || {})) {
    if (k >= fromYmd && k <= toYmd) sum += safeNum(v?.pnlUsd);
  }
  return sum;
}

export async function computeBrokerTruthPnlSummary(args: {
  scope: Scope;
  timeZone: string;
}): Promise<BrokerTruthPnlSummary> {
  try {
    const now = new Date();
    const todayYmd = ymdInTZ(now, args.timeZone);
    const weekStartYmd = startOfWeekYmd(todayYmd);
    const month = monthKeyInTZ(now, args.timeZone);

    // Realized (transactions -> daily map -> rollups)
    const realizedResp = await computeBrokerTruthDailyRealizedPnl({ month, scope: args.scope, timeZone: args.timeZone });
    if (!realizedResp.ok) {
      return {
        ok: false,
        scope: args.scope,
        timeZone: args.timeZone,
        source: 'BROKER',
        realized: { todayUsd: 0, wtdUsd: 0, mtdUsd: 0 },
        unrealized: { totalUsd: 0 },
        positions: [],
        meta: { reason: 'realized_failed', upstream: realizedResp.meta },
        error: realizedResp.error || 'Failed to compute realized P/L',
      };
    }

    const days = realizedResp.days || {};
    const todayUsd = safeNum(days[todayYmd]?.pnlUsd);
    const wtdUsd = sumDays(days, weekStartYmd, todayYmd);
    const monthStartYmd = month + '-01';
    const mtdUsd = sumDays(days, monthStartYmd, todayYmd);

    // Positions + unrealized from broker truth
    // NOTE: We intentionally compute unrealized using instrument multipliers so this applies cleanly to OPTIONS.
    const accountHash = await getPrimaryAccountHash();
    const acct = await getAccountDetails(accountHash, 'positions');
    const sa = acct?.securitiesAccount || {};
    const rawPositions: any[] = Array.isArray(sa.positions) ? sa.positions : [];

    const symbols = rawPositions
      .map(p => String(p?.instrument?.symbol || '').trim())
      .filter(Boolean);

    const quoteMap = await getQuotes(symbols);

    const mapped = rawPositions.map((p: any) => {
      const symbol = String(p?.instrument?.symbol || '').trim().toUpperCase() || 'UNKNOWN';
      const assetType = String(p?.instrument?.assetType || '').trim().toUpperCase() || 'UNKNOWN';
      const longQty = safeNum(p?.longQuantity);
      const shortQty = safeNum(p?.shortQuantity);
      const quantity = longQty - shortQty;
      const avg = safeNum(p?.averagePrice);
      const multiplier = assetType === 'OPTION' ? 100 : 1;

      const q = (quoteMap as any)?.[symbol];
      const last = safeNum(q?.quote?.lastPrice ?? q?.quote?.mark ?? q?.quote?.closePrice);

      // Schwab often provides marketValue; for options this is typically already total value.
      // If missing or zero, derive from quote + qty + multiplier.
      const mvRaw = safeNum(p?.marketValue);
      const marketValue = mvRaw !== 0 ? mvRaw : (last * quantity * multiplier);
      const costBasis = avg * quantity * multiplier;
      const unrealizedUsd = marketValue - costBasis;
      const unrealizedPct = costBasis !== 0 ? (unrealizedUsd / costBasis) * 100 : 0;

      const currentPrice = quantity !== 0 ? (marketValue / (quantity * multiplier)) : last;

      return {
        symbol,
        assetType,
        quantity,
        averagePrice: avg,
        currentPrice,
        marketValue,
        unrealizedUsd,
        unrealizedPct,
      };
    });

    const totalUnrealized = mapped.reduce((s, r) => s + safeNum(r.unrealizedUsd), 0);

    return {
      ok: true,
      scope: args.scope,
      timeZone: args.timeZone,
      source: 'BROKER',
      realized: { todayUsd, wtdUsd, mtdUsd },
      unrealized: { totalUsd: totalUnrealized },
      positions: mapped,
      balances: {
        cashBalance: safeNum(sa?.currentBalances?.cashBalance),
        buyingPower: safeNum(sa?.currentBalances?.buyingPower),
        equity: safeNum(sa?.currentBalances?.equity),
      },
      meta: {
        asOf: new Date().toISOString(),
        month,
        todayYmd,
        weekStartYmd,
        accountHash: String(accountHash || '').slice(0, 8) + '...',
      },
    };
  } catch (e: any) {
    return {
      ok: false,
      scope: args.scope,
      timeZone: args.timeZone,
      source: 'BROKER',
      realized: { todayUsd: 0, wtdUsd: 0, mtdUsd: 0 },
      unrealized: { totalUsd: 0 },
      positions: [],
      meta: { reason: 'exception' },
      error: String(e?.message || e),
    };
  }
}
