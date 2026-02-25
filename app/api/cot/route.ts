import { NextResponse } from 'next/server';
import { TTLCache } from '@/lib/cache';

export const dynamic = 'force-dynamic';

const cache = new TTLCache<any>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

const CFTC_BASE = 'https://publicreporting.cftc.gov/resource/6dca-aqww.json';

interface CftcRow {
  noncomm_positions_long_all: string;
  noncomm_positions_short_all: string;
  comm_positions_long_all: string;
  comm_positions_short_all: string;
  report_date_as_yyyy_mm_dd: string;
}

async function fetchMarket(marketFilter: string) {
  const url =
    `${CFTC_BASE}?$limit=2&$where=market_and_exchange_names like '${marketFilter}'&$order=report_date_as_yyyy_mm_dd DESC`;
  const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
  if (!res.ok) return null;
  const rows: CftcRow[] = await res.json();
  if (!rows.length) return null;
  const row = rows[0];
  return {
    date: row.report_date_as_yyyy_mm_dd,
    largeSpecNet: parseInt(row.noncomm_positions_long_all) - parseInt(row.noncomm_positions_short_all),
    commercialNet: parseInt(row.comm_positions_long_all) - parseInt(row.comm_positions_short_all),
  };
}

function normalise(val: number, min: number, max: number): number {
  if (max === min) return 0;
  return Math.round(((val - min) / (max - min)) * 200 - 100);
}

export async function GET() {
  try {
    const cached = cache.get('cot');
    if (cached) return NextResponse.json(cached);

    const [sp, nq] = await Promise.all([
      fetchMarket('E-MINI S%26P 500%'),
      fetchMarket('E-MINI NASDAQ-100%'),
    ]);

    const result = {
      sp500: sp
        ? {
            date: sp.date,
            largeSpecNet: sp.largeSpecNet,
            commercialNet: sp.commercialNet,
            largeSpecNorm: normalise(sp.largeSpecNet, -300000, 300000),
            commercialNorm: normalise(sp.commercialNet, -800000, 100000),
          }
        : null,
      nasdaq: nq
        ? {
            date: nq.date,
            largeSpecNet: nq.largeSpecNet,
            commercialNet: nq.commercialNet,
            largeSpecNorm: normalise(nq.largeSpecNet, -50000, 80000),
            commercialNorm: normalise(nq.commercialNet, -150000, 20000),
          }
        : null,
    };

    cache.set('cot', result, CACHE_TTL);
    return NextResponse.json(result);
  } catch (err) {
    console.error('[cot] Error:', err);
    return NextResponse.json({ error: 'Failed to fetch COT data' }, { status: 500 });
  }
}
