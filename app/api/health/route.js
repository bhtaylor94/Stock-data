// app/api/health/route.js
import { NextResponse } from 'next/server';
import { getAccessToken, getOptionsChain, getQuote, getPriceHistory } from '@/lib/schwab';
import { getQuote as finnhubQuote, getNews, getEarnings } from '@/lib/finnhub';
import { getPreviousClose } from '@/lib/polygon';

export async function GET() {
  const results = {
    timestamp: new Date().toISOString(),
    envVars: {
      SCHWAB_APP_KEY: !!process.env.SCHWAB_APP_KEY,
      SCHWAB_APP_SECRET: !!process.env.SCHWAB_APP_SECRET,
      SCHWAB_REFRESH_TOKEN: !!process.env.SCHWAB_REFRESH_TOKEN,
      FINNHUB_API_KEY: !!process.env.FINNHUB_API_KEY,
      POLYGON_API_KEY: !!process.env.POLYGON_API_KEY,
      ANTHROPIC_API_KEY: !!process.env.ANTHROPIC_API_KEY,
      EDGAR_IDENTITY: !!process.env.EDGAR_IDENTITY,
    },
    schwab: {},
    finnhub: {},
    polygon: {},
    sampleScan: {},
  };

  // Schwab auth
  try {
    const token = await getAccessToken();
    results.schwab.auth = token ? 'SUCCESS' : 'FAILED';
  } catch (err) { results.schwab.auth = `ERROR: ${err.message}`; }

  // Schwab quote
  try {
    const quote = await getQuote('AAPL');
    results.schwab.quote = {
      status: 'SUCCESS',
      price: quote?.quote?.lastPrice || quote?.lastPrice || 'unknown',
      change: quote?.quote?.netPercentChange || 'unknown',
    };
  } catch (err) { results.schwab.quote = { status: `ERROR: ${err.message}` }; }

  // Schwab chain (NORMALIZED)
  try {
    const chain = await getOptionsChain('SPY');
    if (chain) {
      const callExpDates = chain.callExpDateMap ? Object.keys(chain.callExpDateMap) : [];
      let totalContracts = 0;
      let sampleContract = null;
      let highVolContract = null;
      let highestVol = 0;

      if (chain.callExpDateMap) {
        Object.entries(chain.callExpDateMap).forEach(([exp, contracts]) => {
          if (!Array.isArray(contracts)) return;
          totalContracts += contracts.length;
          contracts.forEach(c => {
            if (!sampleContract) sampleContract = {
              strike: c.strikePrice, bid: c.bid, ask: c.ask,
              volume: c.totalVolume, oi: c.openInterest,
              delta: c.delta, iv: c.volatility, dte: parseInt(exp.split(':')[1]) || 0,
            };
            if ((c.totalVolume || 0) > highestVol) {
              highestVol = c.totalVolume;
              highVolContract = {
                strike: c.strikePrice, volume: c.totalVolume, oi: c.openInterest,
                volOi: c.openInterest > 0 ? Math.round(c.totalVolume / c.openInterest * 10) / 10 : 0,
                mid: Math.round(((c.bid || 0) + (c.ask || 0)) / 2 * 100) / 100,
                premium: Math.round(c.totalVolume * ((c.bid || 0) + (c.ask || 0)) / 2 * 100),
                exp,
              };
            }
          });
        });
      }

      // Count unusual flows
      let unusualFlows = 0;
      Object.entries(chain.callExpDateMap || {}).forEach(([exp, contracts]) => {
        if (!Array.isArray(contracts)) return;
        contracts.forEach(c => {
          const vol = c.totalVolume || 0;
          const oi = c.openInterest || 0;
          const mid = ((c.bid || 0) + (c.ask || 0)) / 2;
          const premium = vol * mid * 100;
          const volOi = oi > 0 ? vol / oi : 0;
          if ((volOi > 1.5 && vol > 500) || premium > 250000) unusualFlows++;
        });
      });

      results.schwab.chain = {
        status: 'SUCCESS — NORMALIZED',
        underlyingPrice: chain.underlyingPrice,
        callExpirations: callExpDates.length,
        totalCallContracts: totalContracts,
        sampleContract,
        highestVolumeContract: highVolContract,
        unusualFlowsDetected: unusualFlows,
        wouldSurfaceCards: unusualFlows > 0 ? 'YES — flow detected' : 'NO — thresholds not met (may need market hours)',
      };
    } else {
      results.schwab.chain = { status: 'FAILED — null' };
    }
  } catch (err) { results.schwab.chain = { status: `ERROR: ${err.message}` }; }

  // Schwab price history
  try {
    const history = await getPriceHistory('AAPL', 'year', 1, 'daily', 1);
    results.schwab.priceHistory = {
      status: history ? 'SUCCESS' : 'FAILED',
      candleCount: history?.candles?.length || 0,
    };
  } catch (err) { results.schwab.priceHistory = { status: `ERROR: ${err.message}` }; }

  // Finnhub
  try {
    const quote = await finnhubQuote('AAPL');
    results.finnhub.quote = { status: 'SUCCESS', price: quote?.c };
  } catch (err) { results.finnhub.quote = { status: `ERROR: ${err.message}` }; }

  try {
    const news = await getNews('AAPL', 3);
    results.finnhub.news = { status: 'SUCCESS', count: news?.length || 0 };
  } catch (err) { results.finnhub.news = { status: `ERROR: ${err.message}` }; }

  // Polygon
  try {
    const prev = await getPreviousClose('AAPL');
    results.polygon = { status: 'SUCCESS', close: prev?.results?.[0]?.c };
  } catch (err) { results.polygon = { status: `ERROR: ${err.message}` }; }

  return NextResponse.json(results);
}
