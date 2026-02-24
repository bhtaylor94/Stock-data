import { NextRequest, NextResponse } from 'next/server';
import { getSchwabAccessToken } from '@/lib/schwab';
import { TTLCache } from '@/lib/cache';

export const runtime = 'nodejs';

const cache = new TTLCache<any>();
const CACHE_TTL = 30_000; // 30 seconds

const SCHWAB_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json',
};

const DEFAULT_TICKERS = ['SPY', 'QQQ', 'AAPL', 'MSFT', 'NVDA', 'TSLA', 'AMZN', 'META', 'AMD', 'GOOGL', 'JPM', 'XOM'];

const SECTOR_MAP: Record<string, string> = {
  SPY: 'ETF', QQQ: 'ETF', IWM: 'ETF', DIA: 'ETF', VTI: 'ETF',
  AAPL: 'Tech', MSFT: 'Tech', GOOGL: 'Tech', META: 'Tech', ORCL: 'Tech', CRM: 'Tech', ADBE: 'Tech',
  NVDA: 'Semi', AMD: 'Semi', AVGO: 'Semi', QCOM: 'Semi', INTC: 'Semi', TSM: 'Semi',
  TSLA: 'Consumer', AMZN: 'Consumer', HD: 'Consumer', MCD: 'Consumer', COST: 'Consumer', NKE: 'Consumer',
  JPM: 'Finance', BAC: 'Finance', GS: 'Finance', MS: 'Finance', WFC: 'Finance', V: 'Finance', MA: 'Finance',
  UNH: 'Health', JNJ: 'Health', LLY: 'Health', ABBV: 'Health', MRK: 'Health', PFE: 'Health',
  XOM: 'Energy', CVX: 'Energy', COP: 'Energy',
  CAT: 'Industrial', BA: 'Industrial', GE: 'Industrial', UPS: 'Industrial',
};

// ── Heat Score ─────────────────────────────────────────────────────────────────
// 0–60 pts: % change momentum (5% change = 60 pts)
// 0–40 pts: volume surge vs 10-day average (2× avg = 20 pts, 3× = 40 pts)
// Falls back to pure % change score when avg volume data is unavailable.
function heatScore(q: any, f: any = {}): number {
  const pctChange = Math.abs(q.netPercentChangeInDouble ?? 0);
  const volume = q.totalVolume ?? 0;
  const avgVol10d = f.avg10DaysVolume ?? 0;

  const momentumScore = Math.min(60, pctChange * 12);

  let volumeScore = 0;
  if (avgVol10d > 0) {
    const ratio = volume / avgVol10d;
    // 1× avg = 0 pts, 2× avg = 20 pts, 3× avg = 40 pts
    volumeScore = Math.min(40, Math.max(0, (ratio - 1) * 20));
  }

  return Math.round(momentumScore + volumeScore);
}

export async function GET(req: NextRequest) {
  const cached = cache.get('scanner');
  if (cached) return NextResponse.json(cached);

  try {
    const url = new URL(req.url);
    const tickerParam = url.searchParams.get('tickers');
    const tickers = tickerParam
      ? tickerParam.split(',').map(t => t.trim().toUpperCase()).filter(Boolean)
      : DEFAULT_TICKERS;

    const tokenResult = await getSchwabAccessToken('stock');
    if (!tokenResult.token) {
      return NextResponse.json({ error: 'Auth failed' }, { status: 503 });
    }

    const symbols = tickers.join(',');
    // Request both quote and fundamental fields to get avg10DaysVolume
    const quotesRes = await fetch(
      `https://api.schwabapi.com/marketdata/v1/quotes?symbols=${symbols}&fields=quote,fundamental`,
      { headers: { ...SCHWAB_HEADERS, Authorization: `Bearer ${tokenResult.token}` } }
    );

    if (!quotesRes.ok) {
      return NextResponse.json({ error: `Schwab ${quotesRes.status}` }, { status: 502 });
    }

    const quotesData = await quotesRes.json();

    const results = tickers
      .map(ticker => {
        const entry = quotesData[ticker];
        const q = entry?.quote ?? {};
        const f = entry?.fundamental ?? {};
        const price = q.lastPrice ?? q.mark ?? 0;
        const change = q.netChange ?? 0;
        const changePct = q.netPercentChangeInDouble ?? 0;
        const volume = q.totalVolume ?? 0;
        const avgVol10d = f.avg10DaysVolume ?? 0;
        const volRatio = avgVol10d > 0 ? Math.round((volume / avgVol10d) * 10) / 10 : null;
        const heat = heatScore(q, f);
        return {
          ticker,
          price: Math.round(price * 100) / 100,
          change: Math.round(change * 100) / 100,
          changePct: Math.round(changePct * 100) / 100,
          volume,
          avgVolume: avgVol10d,
          volRatio,
          heat,
          sector: SECTOR_MAP[ticker] ?? 'Other',
          direction: (changePct >= 0.5 ? 'UP' : changePct <= -0.5 ? 'DOWN' : 'FLAT') as 'UP' | 'DOWN' | 'FLAT',
        };
      })
      .filter(r => r.price > 0)
      .sort((a, b) => b.heat - a.heat);

    // Aggregate by sector
    const sectorMap: Record<string, { tickers: string[]; avgHeat: number; bullCount: number; bearCount: number }> = {};
    for (const r of results) {
      if (!sectorMap[r.sector]) sectorMap[r.sector] = { tickers: [], avgHeat: 0, bullCount: 0, bearCount: 0 };
      sectorMap[r.sector].tickers.push(r.ticker);
      sectorMap[r.sector].avgHeat += r.heat;
      if (r.direction === 'UP') sectorMap[r.sector].bullCount++;
      else if (r.direction === 'DOWN') sectorMap[r.sector].bearCount++;
    }
    for (const s of Object.values(sectorMap)) {
      if (s.tickers.length > 0) s.avgHeat = Math.round(s.avgHeat / s.tickers.length);
    }

    const response = { results, sectorMap, scannedAt: new Date().toISOString(), count: results.length };
    cache.set('scanner', response, CACHE_TTL);
    return NextResponse.json(response);
  } catch (err: any) {
    console.error('Scanner error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
