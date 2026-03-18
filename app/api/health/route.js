// app/api/health/route.js
// Diagnostic endpoint — tests every API connection and shows what's working/broken
// Hit this at /api/health to see exactly what's happening

import { NextResponse } from 'next/server';
import { getAccessToken, getOptionsChain, getQuote, getPriceHistory } from '@/lib/schwab';
import { getQuote as finnhubQuote, getNews, getEarnings, getMetrics } from '@/lib/finnhub';
import { getPreviousClose } from '@/lib/polygon';

export async function GET() {
  const results = {
    timestamp: new Date().toISOString(),
    envVars: {},
    schwab: {},
    finnhub: {},
    polygon: {},
    sampleScan: {},
  };

  // 1. Check env vars exist (don't expose values)
  results.envVars = {
    SCHWAB_APP_KEY: !!process.env.SCHWAB_APP_KEY,
    SCHWAB_APP_SECRET: !!process.env.SCHWAB_APP_SECRET,
    SCHWAB_REFRESH_TOKEN: !!process.env.SCHWAB_REFRESH_TOKEN,
    FINNHUB_API_KEY: !!process.env.FINNHUB_API_KEY,
    POLYGON_API_KEY: !!process.env.POLYGON_API_KEY,
    ANTHROPIC_API_KEY: !!process.env.ANTHROPIC_API_KEY,
    EDGAR_IDENTITY: !!process.env.EDGAR_IDENTITY,
  };

  // 2. Test Schwab auth
  try {
    const token = await getAccessToken();
    results.schwab.auth = token ? 'SUCCESS' : 'FAILED — token is null';
    results.schwab.tokenLength = token ? token.length : 0;
  } catch (err) {
    results.schwab.auth = `ERROR: ${err.message}`;
  }

  // 3. Test Schwab quote
  try {
    const quote = await getQuote('AAPL');
    results.schwab.quote = {
      status: 'SUCCESS',
      sample: quote ? {
        keys: Object.keys(quote),
        hasQuoteData: !!quote.quote || !!quote.AAPL,
        raw: JSON.stringify(quote).substring(0, 500),
      } : 'null response',
    };
  } catch (err) {
    results.schwab.quote = { status: `ERROR: ${err.message}` };
  }

  // 4. Test Schwab options chain (SPY — most liquid)
  try {
    const chain = await getOptionsChain('SPY');
    if (chain) {
      const callExpDates = chain.callExpDateMap ? Object.keys(chain.callExpDateMap) : [];
      const putExpDates = chain.putExpDateMap ? Object.keys(chain.putExpDateMap) : [];
      
      // Count total contracts
      let totalCallContracts = 0;
      let totalPutContracts = 0;
      let sampleContract = null;
      
      if (chain.callExpDateMap) {
        Object.entries(chain.callExpDateMap).forEach(([exp, contracts]) => {
          if (Array.isArray(contracts)) {
            totalCallContracts += contracts.length;
            if (!sampleContract && contracts.length > 0) {
              sampleContract = {
                expiration: exp,
                strike: contracts[0].strikePrice,
                bid: contracts[0].bid,
                ask: contracts[0].ask,
                volume: contracts[0].totalVolume,
                oi: contracts[0].openInterest,
                delta: contracts[0].delta,
                gamma: contracts[0].gamma,
                theta: contracts[0].theta,
                iv: contracts[0].volatility,
              };
            }
          }
        });
      }
      if (chain.putExpDateMap) {
        Object.values(chain.putExpDateMap).forEach(contracts => {
          if (Array.isArray(contracts)) totalPutContracts += contracts.length;
        });
      }

      results.schwab.chain = {
        status: 'SUCCESS',
        underlyingPrice: chain.underlyingPrice || chain.underlying?.last || chain.underlying?.mark || 'NOT FOUND',
        callExpirations: callExpDates.length,
        putExpirations: putExpDates.length,
        totalCallContracts,
        totalPutContracts,
        firstCallExp: callExpDates[0] || 'none',
        lastCallExp: callExpDates[callExpDates.length - 1] || 'none',
        sampleContract,
        chainTopLevelKeys: Object.keys(chain),
        underlyingKeys: chain.underlying ? Object.keys(chain.underlying) : 'no underlying object',
      };
    } else {
      results.schwab.chain = { status: 'FAILED — null response' };
    }
  } catch (err) {
    results.schwab.chain = { status: `ERROR: ${err.message}` };
  }

  // 5. Test Schwab price history
  try {
    const history = await getPriceHistory('AAPL', 'month', 1, 'daily', 1);
    results.schwab.priceHistory = {
      status: history ? 'SUCCESS' : 'FAILED',
      candleCount: history?.candles?.length || 0,
      lastCandle: history?.candles?.[history.candles.length - 1] || null,
      topLevelKeys: history ? Object.keys(history) : [],
    };
  } catch (err) {
    results.schwab.priceHistory = { status: `ERROR: ${err.message}` };
  }

  // 6. Test Finnhub
  try {
    const quote = await finnhubQuote('AAPL');
    results.finnhub.quote = {
      status: quote ? 'SUCCESS' : 'FAILED',
      data: quote,
    };
  } catch (err) {
    results.finnhub.quote = { status: `ERROR: ${err.message}` };
  }

  try {
    const news = await getNews('AAPL', 3);
    results.finnhub.news = {
      status: Array.isArray(news) ? 'SUCCESS' : 'FAILED',
      count: Array.isArray(news) ? news.length : 0,
      firstHeadline: news?.[0]?.headline || null,
    };
  } catch (err) {
    results.finnhub.news = { status: `ERROR: ${err.message}` };
  }

  try {
    const earnings = await getEarnings('AAPL');
    results.finnhub.earnings = {
      status: earnings ? 'SUCCESS' : 'FAILED',
      data: earnings,
    };
  } catch (err) {
    results.finnhub.earnings = { status: `ERROR: ${err.message}` };
  }

  // 7. Test Polygon
  try {
    const prev = await getPreviousClose('AAPL');
    results.polygon.previousClose = {
      status: prev ? 'SUCCESS' : 'FAILED',
      data: prev,
    };
  } catch (err) {
    results.polygon.previousClose = { status: `ERROR: ${err.message}` };
  }

  // 8. Run a mini flow detection on SPY to see if the engine would find anything
  try {
    const chain = await getOptionsChain('SPY');
    if (chain?.callExpDateMap) {
      let unusualFlows = 0;
      let totalContracts = 0;
      let highestVolOi = 0;
      let highestPremium = 0;
      let highestVolContract = null;

      Object.entries(chain.callExpDateMap).forEach(([expKey, contracts]) => {
        if (!Array.isArray(contracts)) return;
        const dte = parseInt(expKey.split(':')[1]) || 0;
        if (dte < 14 || dte > 365) return;

        contracts.forEach(c => {
          totalContracts++;
          const vol = c.totalVolume || 0;
          const oi = c.openInterest || 0;
          const mid = ((c.bid || 0) + (c.ask || 0)) / 2;
          const premium = vol * mid * 100;
          const volOi = oi > 0 ? vol / oi : 0;

          if (volOi > highestVolOi) {
            highestVolOi = volOi;
            highestVolContract = {
              strike: c.strikePrice,
              exp: expKey,
              vol,
              oi,
              volOi: Math.round(volOi * 10) / 10,
              premium: Math.round(premium),
              mid,
            };
          }
          if (premium > highestPremium) highestPremium = premium;

          if ((volOi > 1.5 && vol > 500) || premium > 250000) {
            unusualFlows++;
          }
        });
      });

      results.sampleScan = {
        ticker: 'SPY',
        totalContractsIn14to365DTE: totalContracts,
        unusualFlowsDetected: unusualFlows,
        highestVolOiContract: highestVolContract,
        highestPremiumSeen: highestPremium,
        wouldSurfaceCard: unusualFlows > 0,
      };
    }
  } catch (err) {
    results.sampleScan = { error: err.message };
  }

  return NextResponse.json(results, { status: 200 });
}
