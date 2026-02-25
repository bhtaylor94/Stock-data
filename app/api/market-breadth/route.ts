import { NextResponse } from 'next/server';
import { getSchwabAccessToken } from '@/lib/schwab';

const SCHWAB_API_BASE = 'https://api.schwabapi.com';
import { TTLCache } from '@/lib/cache';

export const dynamic = 'force-dynamic';

const cache = new TTLCache<any>();
const CACHE_TTL = 30 * 1000; // 30 seconds

const SECTOR_ETFS = [
  { name: 'Tech', etf: 'XLK' },
  { name: 'Finance', etf: 'XLF' },
  { name: 'Health', etf: 'XLV' },
  { name: 'Energy', etf: 'XLE' },
  { name: 'Industrials', etf: 'XLI' },
  { name: 'Consumer Disc', etf: 'XLY' },
  { name: 'Utilities', etf: 'XLU' },
  { name: 'Real Estate', etf: 'XLRE' },
  { name: 'Staples', etf: 'XLP' },
  { name: 'Materials', etf: 'XLB' },
  { name: 'Comm Svcs', etf: 'XLC' },
];

export async function GET() {
  try {
    const cached = cache.get('market-breadth');
    if (cached) return NextResponse.json(cached);

    const token = await getSchwabAccessToken('stock');
    const allSymbols = ['$VIX.X', 'SPY', 'QQQ', 'IWM', 'DIA', ...SECTOR_ETFS.map((s) => s.etf)];
    const res = await fetch(
      `${SCHWAB_API_BASE}/marketdata/v1/quotes?symbols=${encodeURIComponent(allSymbols.join(','))}&fields=quote`,
      { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10000) },
    );

    if (!res.ok) throw new Error(`Schwab quotes failed: ${res.status}`);
    const data = await res.json();

    const q = (sym: string) => data[sym]?.quote ?? {};

    const result = {
      vix: q('$VIX.X').lastPrice ?? 0,
      vixChange: q('$VIX.X').netPercentChangeInDouble ?? 0,
      spyChange: q('SPY').netPercentChangeInDouble ?? 0,
      qqqChange: q('QQQ').netPercentChangeInDouble ?? 0,
      iwmChange: q('IWM').netPercentChangeInDouble ?? 0,
      diaChange: q('DIA').netPercentChangeInDouble ?? 0,
      sectors: SECTOR_ETFS.map(({ name, etf }) => ({
        name,
        etf,
        change: q(etf).netPercentChangeInDouble ?? 0,
      })).sort((a, b) => b.change - a.change),
    };

    cache.set('market-breadth', result, CACHE_TTL);
    return NextResponse.json(result);
  } catch (err) {
    console.error('[market-breadth] Error:', err);
    return NextResponse.json({ error: 'Failed to fetch market breadth' }, { status: 500 });
  }
}
