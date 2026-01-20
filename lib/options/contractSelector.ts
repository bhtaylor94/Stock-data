import { getOptionsChain } from '@/lib/schwabOptions';

export type OptionSide = 'CALL' | 'PUT';

export type SelectedOptionContract = {
  optionSymbol: string;
  underlying: string;
  optionType: OptionSide;
  strike: number;
  expiration: string; // YYYY-MM-DD
  dte: number;
  bid?: number;
  ask?: number;
  mid?: number;
  last?: number;
  delta?: number;
  openInterest?: number;
  totalVolume?: number;
  spreadPct?: number;
  reason: string[];
};

function asNum(v: any): number | undefined {
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function normDate(d: string): string {
  const s = String(d || '').trim();
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const dt = new Date(s);
  if (!Number.isFinite(dt.getTime())) return '';
  return dt.toISOString().slice(0, 10);
}

function daysBetweenUTC(a: Date, b: Date): number {
  const ms = b.getTime() - a.getTime();
  return Math.round(ms / (24 * 60 * 60 * 1000));
}

function extractContracts(chain: any): any[] {
  const out: any[] = [];
  const pushLeg = (leg: any) => {
    if (leg && typeof leg === 'object') out.push(leg);
  };

  const expMaps: Array<{ side: 'CALL' | 'PUT'; map: any }> = [];
  if (chain?.callExpDateMap) expMaps.push({ side: 'CALL', map: chain.callExpDateMap });
  if (chain?.putExpDateMap) expMaps.push({ side: 'PUT', map: chain.putExpDateMap });

  for (const em of expMaps) {
    const expMap = em.map;
    if (!expMap || typeof expMap !== 'object') continue;
    for (const expKey of Object.keys(expMap)) {
      const strikesMap = expMap[expKey];
      if (!strikesMap || typeof strikesMap !== 'object') continue;
      for (const strikeKey of Object.keys(strikesMap)) {
        const arr = strikesMap[strikeKey];
        if (Array.isArray(arr)) {
          for (const leg of arr) pushLeg({ ...leg, putCall: em.side });
        }
      }
    }
  }

  if (Array.isArray(chain?.optionChain)) {
    for (const leg of chain.optionChain) pushLeg(leg);
  }

  return out;
}

export async function selectOptionContractForSignal(params: {
  symbol: string;
  side: OptionSide;
  targetDteDays: number;
  targetAbsDelta: number;
  minOpenInterest: number;
  minVolume: number;
  maxBidAskPct: number;
}): Promise<{ ok: true; contract: SelectedOptionContract } | { ok: false; error: string; details?: any }> {
  const symbol = String(params.symbol || '').trim().toUpperCase();
  if (!symbol) return { ok: false, error: 'symbol required' };

  const chain = await getOptionsChain(symbol);
  const underlyingPrice =
    asNum(chain?.underlyingPrice) ??
    asNum(chain?.underlying?.last) ??
    asNum(chain?.underlying?.mark) ??
    asNum(chain?.underlyingQuote?.last);

  const legs = extractContracts(chain).filter((c) => String(c?.putCall || '').toUpperCase() === params.side);
  if (legs.length === 0) return { ok: false, error: 'No contracts found in chain' };

  const today = new Date();

  const candidates = legs.map((c) => {
    const exp = normDate(
      c?.expirationDate || c?.expDate || c?.expiration || c?.expirationDateStr || c?.symbol?.expirationDate || ''
    );
    const dte = exp ? daysBetweenUTC(today, new Date(exp + 'T00:00:00Z')) : asNum(c?.daysToExpiration) ?? 0;
    const strike = asNum(c?.strikePrice) ?? asNum(c?.strike) ?? 0;

    const bid = asNum(c?.bid);
    const ask = asNum(c?.ask);
    const last = asNum(c?.last);
    const mid = bid !== undefined && ask !== undefined ? (bid + ask) / 2 : undefined;
    const spreadPct = mid && bid !== undefined && ask !== undefined && mid > 0 ? ((ask - bid) / mid) * 100 : undefined;

    const oi = asNum(c?.openInterest);
    const vol = asNum(c?.totalVolume ?? c?.volume);

    const delta = asNum(c?.delta) ?? asNum(c?.greeks?.delta);

    const optionSymbol = String(c?.symbol || c?.optionSymbol || c?.instrument?.symbol || '').trim();

    return { optionSymbol, exp, dte, strike, bid, ask, mid, last, spreadPct, oi, vol, delta };
  });

  let filtered = candidates.filter((x) => x.optionSymbol && x.exp && x.dte > 0 && Number.isFinite(x.strike));
  if (filtered.length === 0) return { ok: false, error: 'No valid contracts after normalization' };

  filtered = filtered.filter((x) => {
    const oiOk = (x.oi ?? 0) >= params.minOpenInterest;
    const volOk = (x.vol ?? 0) >= params.minVolume;
    const spreadOk = x.spreadPct === undefined ? true : x.spreadPct <= params.maxBidAskPct;
    return oiOk && volOk && spreadOk;
  });

  if (filtered.length === 0) {
    return { ok: false, error: 'No contracts meet liquidity/spread gates', details: { candidates: candidates.length } };
  }

  const targetDte = Math.max(1, Math.min(365, Number(params.targetDteDays || 30)));
  filtered.sort((a, b) => Math.abs(a.dte - targetDte) - Math.abs(b.dte - targetDte));
  const bestDte = filtered[0].dte;
  const nearExp = filtered.filter((x) => Math.abs(x.dte - bestDte) <= 1);

  let best = nearExp[0];

  const withDelta = nearExp.filter((x) => typeof x.delta === 'number' && Number.isFinite(x.delta));
  if (withDelta.length > 0) {
    const targetAbsDelta = Math.max(0.05, Math.min(0.95, Number(params.targetAbsDelta || 0.35)));
    withDelta.sort(
      (a, b) =>
        Math.abs(Math.abs(a.delta as number) - targetAbsDelta) - Math.abs(Math.abs(b.delta as number) - targetAbsDelta)
    );
    best = withDelta[0];
  } else if (underlyingPrice !== undefined) {
    nearExp.sort((a, b) => Math.abs(a.strike - underlyingPrice) - Math.abs(b.strike - underlyingPrice));
    best = nearExp[0];
  }

  const reason: string[] = [];
  reason.push(`DTE≈${best.dte} (target ${targetDte})`);
  if (typeof best.delta === 'number') {
    reason.push(`|delta|≈${Math.abs(best.delta).toFixed(2)} (target ${Number(params.targetAbsDelta).toFixed(2)})`);
  }
  if (best.spreadPct !== undefined) reason.push(`spread ${best.spreadPct.toFixed(1)}%`);

  return {
    ok: true,
    contract: {
      optionSymbol: best.optionSymbol,
      underlying: symbol,
      optionType: params.side,
      strike: best.strike,
      expiration: best.exp,
      dte: best.dte,
      bid: best.bid,
      ask: best.ask,
      mid: best.mid,
      last: best.last,
      delta: best.delta,
      openInterest: best.oi,
      totalVolume: best.vol,
      spreadPct: best.spreadPct,
      reason,
    },
  };
}
