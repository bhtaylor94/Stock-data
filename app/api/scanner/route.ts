import { NextRequest, NextResponse } from 'next/server';
import { getSchwabAccessToken, SCHWAB_HEADERS } from '@/lib/schwab';
import { TTLCache } from '@/lib/cache';

export const runtime = 'nodejs';

const cache = new TTLCache<any>();
const CACHE_TTL = 30_000; // 30 seconds


// ~182 tickers across all sectors
const SCAN_UNIVERSE = [
  // ETF (20)
  'SPY', 'QQQ', 'IWM', 'DIA', 'VTI', 'XLF', 'XLE', 'XLK', 'XLV', 'XLI',
  'XLU', 'XLB', 'XLC', 'XLRE', 'XLY', 'XLP', 'GLD', 'SLV', 'USO', 'TLT',
  // Tech (16)
  'AAPL', 'MSFT', 'GOOGL', 'META', 'ORCL', 'CRM', 'ADBE', 'NOW', 'INTU', 'ANET',
  'PANW', 'CRWD', 'ZS', 'SNOW', 'DDOG', 'MDB',
  // Semi (19)
  'NVDA', 'AMD', 'AVGO', 'QCOM', 'INTC', 'TSM', 'AMAT', 'LRCX', 'KLAC', 'MU',
  'TXN', 'ADI', 'MRVL', 'NXPI', 'MCHP', 'ON', 'SMCI', 'ARM', 'ASML',
  // Finance (19)
  'JPM', 'BAC', 'WFC', 'MS', 'GS', 'C', 'BX', 'SCHW', 'AXP', 'V',
  'MA', 'USB', 'PNC', 'COF', 'BLK', 'CME', 'ICE', 'SPGI', 'MCO',
  // Health (19)
  'UNH', 'JNJ', 'LLY', 'ABBV', 'MRK', 'TMO', 'ABT', 'DHR', 'PFE', 'BMY',
  'AMGN', 'GILD', 'REGN', 'VRTX', 'ISRG', 'BIIB', 'MRNA', 'CVS', 'CI',
  // Consumer (17)
  'AMZN', 'TSLA', 'HD', 'MCD', 'NKE', 'SBUX', 'LOW', 'TJX', 'BKNG', 'MAR',
  'CMG', 'ABNB', 'GM', 'F', 'DECK', 'RIVN', 'LCID',
  // Staples (9)
  'WMT', 'COST', 'PG', 'KO', 'PEP', 'PM', 'MO', 'CL', 'MDLZ',
  // Energy (11)
  'XOM', 'CVX', 'COP', 'SLB', 'EOG', 'MPC', 'PSX', 'VLO', 'OXY', 'HAL', 'DVN',
  // Industrial (12)
  'CAT', 'BA', 'GE', 'UPS', 'HON', 'UNP', 'RTX', 'LMT', 'DE', 'MMM', 'ETN', 'CSX',
  // Comm (11)
  'NFLX', 'DIS', 'CMCSA', 'T', 'VZ', 'TMUS', 'EA', 'TTWO', 'RBLX', 'SNAP', 'PINS',
  // Materials (7)
  'LIN', 'APD', 'SHW', 'NEM', 'FCX', 'ALB', 'MP',
  // Utility (3)
  'NEE', 'DUK', 'SO',
  // REIT (3)
  'PLD', 'AMT', 'EQIX',
  // Momentum (16)
  'COIN', 'HOOD', 'MSTR', 'PLTR', 'SQ', 'SOFI', 'UPST', 'AFRM', 'UBER', 'LYFT',
  'SHOP', 'MELI', 'SE', 'NU', 'APP', 'RDDT',
];

const SECTOR_MAP: Record<string, string> = {
  // ETF
  SPY: 'ETF', QQQ: 'ETF', IWM: 'ETF', DIA: 'ETF', VTI: 'ETF',
  XLF: 'ETF', XLE: 'ETF', XLK: 'ETF', XLV: 'ETF', XLI: 'ETF',
  XLU: 'ETF', XLB: 'ETF', XLC: 'ETF', XLRE: 'ETF', XLY: 'ETF',
  XLP: 'ETF', GLD: 'ETF', SLV: 'ETF', USO: 'ETF', TLT: 'ETF',
  // Tech
  AAPL: 'Tech', MSFT: 'Tech', GOOGL: 'Tech', META: 'Tech', ORCL: 'Tech',
  CRM: 'Tech', ADBE: 'Tech', NOW: 'Tech', INTU: 'Tech', ANET: 'Tech',
  PANW: 'Tech', CRWD: 'Tech', ZS: 'Tech', SNOW: 'Tech', DDOG: 'Tech', MDB: 'Tech',
  // Semi
  NVDA: 'Semi', AMD: 'Semi', AVGO: 'Semi', QCOM: 'Semi', INTC: 'Semi',
  TSM: 'Semi', AMAT: 'Semi', LRCX: 'Semi', KLAC: 'Semi', MU: 'Semi',
  TXN: 'Semi', ADI: 'Semi', MRVL: 'Semi', NXPI: 'Semi', MCHP: 'Semi',
  ON: 'Semi', SMCI: 'Semi', ARM: 'Semi', ASML: 'Semi',
  // Finance
  JPM: 'Finance', BAC: 'Finance', WFC: 'Finance', MS: 'Finance', GS: 'Finance',
  C: 'Finance', BX: 'Finance', SCHW: 'Finance', AXP: 'Finance', V: 'Finance',
  MA: 'Finance', USB: 'Finance', PNC: 'Finance', COF: 'Finance', BLK: 'Finance',
  CME: 'Finance', ICE: 'Finance', SPGI: 'Finance', MCO: 'Finance',
  // Health
  UNH: 'Health', JNJ: 'Health', LLY: 'Health', ABBV: 'Health', MRK: 'Health',
  TMO: 'Health', ABT: 'Health', DHR: 'Health', PFE: 'Health', BMY: 'Health',
  AMGN: 'Health', GILD: 'Health', REGN: 'Health', VRTX: 'Health', ISRG: 'Health',
  BIIB: 'Health', MRNA: 'Health', CVS: 'Health', CI: 'Health',
  // Consumer
  AMZN: 'Consumer', TSLA: 'Consumer', HD: 'Consumer', MCD: 'Consumer', NKE: 'Consumer',
  SBUX: 'Consumer', LOW: 'Consumer', TJX: 'Consumer', BKNG: 'Consumer', MAR: 'Consumer',
  CMG: 'Consumer', ABNB: 'Consumer', GM: 'Consumer', F: 'Consumer', DECK: 'Consumer',
  RIVN: 'Consumer', LCID: 'Consumer',
  // Staples
  WMT: 'Staples', COST: 'Staples', PG: 'Staples', KO: 'Staples', PEP: 'Staples',
  PM: 'Staples', MO: 'Staples', CL: 'Staples', MDLZ: 'Staples',
  // Energy
  XOM: 'Energy', CVX: 'Energy', COP: 'Energy', SLB: 'Energy', EOG: 'Energy',
  MPC: 'Energy', PSX: 'Energy', VLO: 'Energy', OXY: 'Energy', HAL: 'Energy', DVN: 'Energy',
  // Industrial
  CAT: 'Industrial', BA: 'Industrial', GE: 'Industrial', UPS: 'Industrial', HON: 'Industrial',
  UNP: 'Industrial', RTX: 'Industrial', LMT: 'Industrial', DE: 'Industrial',
  MMM: 'Industrial', ETN: 'Industrial', CSX: 'Industrial',
  // Comm
  NFLX: 'Comm', DIS: 'Comm', CMCSA: 'Comm', T: 'Comm', VZ: 'Comm',
  TMUS: 'Comm', EA: 'Comm', TTWO: 'Comm', RBLX: 'Comm', SNAP: 'Comm', PINS: 'Comm',
  // Materials
  LIN: 'Materials', APD: 'Materials', SHW: 'Materials', NEM: 'Materials',
  FCX: 'Materials', ALB: 'Materials', MP: 'Materials',
  // Utility
  NEE: 'Utility', DUK: 'Utility', SO: 'Utility',
  // REIT
  PLD: 'REIT', AMT: 'REIT', EQIX: 'REIT',
  // Momentum
  COIN: 'Momentum', HOOD: 'Momentum', MSTR: 'Momentum', PLTR: 'Momentum', SQ: 'Momentum',
  SOFI: 'Momentum', UPST: 'Momentum', AFRM: 'Momentum', UBER: 'Momentum', LYFT: 'Momentum',
  SHOP: 'Momentum', MELI: 'Momentum', SE: 'Momentum', NU: 'Momentum', APP: 'Momentum', RDDT: 'Momentum',
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

function chunk<T>(arr: T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
    arr.slice(i * size, i * size + size));
}

export async function GET(req: NextRequest) {
  const cached = cache.get('scanner');
  if (cached) return NextResponse.json(cached);

  try {
    const tokenResult = await getSchwabAccessToken('stock');
    if (!tokenResult.token) {
      return NextResponse.json({ error: 'Auth failed' }, { status: 503 });
    }

    const token = tokenResult.token;
    const batches = chunk(SCAN_UNIVERSE, 100);

    // Fetch all batches in parallel
    const batchResults = await Promise.all(
      batches.map(async (batch) => {
        const symbols = batch.join(',');
        const res = await fetch(
          `https://api.schwabapi.com/marketdata/v1/quotes?symbols=${symbols}&fields=quote,fundamental`,
          { headers: { ...SCHWAB_HEADERS, Authorization: `Bearer ${token}` } }
        );
        if (!res.ok) throw new Error(`Schwab ${res.status}`);
        return res.json();
      })
    );

    // Merge all batch responses into one map
    const quotesData: Record<string, any> = Object.assign({}, ...batchResults);

    const results = SCAN_UNIVERSE
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
        const high52Week = Math.round((q['52WeekHigh'] ?? f.high52Weeks ?? 0) * 100) / 100;
        const low52Week  = Math.round((q['52WeekLow']  ?? f.low52Weeks  ?? 0) * 100) / 100;
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
          high52Week,
          low52Week,
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
