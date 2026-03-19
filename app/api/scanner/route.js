// app/api/scanner/route.js
// Unusual Options Activity Scanner
// Deep analysis of a single ticker's chain — shows both sides of every unusual trade

import { NextResponse } from 'next/server';
import { getOptionsChain, getPriceHistory } from '@/lib/schwab';
import { getEarnings, getNews } from '@/lib/finnhub';

function analyzeChain(chainData, stockPrice) {
  const results = {
    calls: [],
    puts: [],
    spreads: [],
    summary: {},
  };

  if (!chainData) return results;

  let totalCallVol = 0, totalPutVol = 0;
  let totalCallOI = 0, totalPutOI = 0;
  let callAskVol = 0, callBidVol = 0;
  let putAskVol = 0, putBidVol = 0;
  let totalCallPremium = 0, totalPutPremium = 0;

  const processMap = (expMap, putCall) => {
    if (!expMap) return;
    const strikes = []; // collect for spread detection

    Object.entries(expMap).forEach(([expKey, contracts]) => {
      if (!Array.isArray(contracts)) return;
      const dte = parseInt(expKey.split(':')[1]) || 0;
      const expDate = expKey.split(':')[0];

      contracts.forEach(c => {
        const vol = c.totalVolume || 0;
        const oi = c.openInterest || 0;
        const mid = ((c.bid || 0) + (c.ask || 0)) / 2;
        const premium = vol * mid * 100;
        const volOi = oi > 0 ? vol / oi : 0;
        const last = c.last || mid;

        // Accumulate totals
        if (putCall === 'CALL') {
          totalCallVol += vol;
          totalCallOI += oi;
          totalCallPremium += premium;
        } else {
          totalPutVol += vol;
          totalPutOI += oi;
          totalPutPremium += premium;
        }

        // Determine aggressor side
        let side = 'MID';
        let sideConfidence = 'LOW';
        if (c.bid && c.ask && c.ask > c.bid) {
          const range = c.ask - c.bid;
          const lastPos = (last - c.bid) / range; // 0 = at bid, 1 = at ask
          if (lastPos > 0.7) { side = 'ASK'; sideConfidence = lastPos > 0.85 ? 'HIGH' : 'MEDIUM'; }
          else if (lastPos < 0.3) { side = 'BID'; sideConfidence = lastPos < 0.15 ? 'HIGH' : 'MEDIUM'; }
        }

        // Track bid/ask volume
        if (putCall === 'CALL') {
          if (side === 'ASK') callAskVol += vol;
          else if (side === 'BID') callBidVol += vol;
        } else {
          if (side === 'ASK') putAskVol += vol;
          else if (side === 'BID') putBidVol += vol;
        }

        // Classify the activity
        const pctFromSpot = ((c.strikePrice - stockPrice) / stockPrice) * 100;
        const isITM = putCall === 'CALL' ? c.strikePrice < stockPrice : c.strikePrice > stockPrice;
        const isATM = Math.abs(pctFromSpot) < 3;
        const moneyness = isATM ? 'ATM' : isITM ? 'ITM' : 'OTM';

        // Determine likely intent for BOTH sides
        let buyerIntent = '';
        let sellerIntent = '';

        if (putCall === 'CALL') {
          if (side === 'ASK') {
            // Buyer is the aggressor
            buyerIntent = isATM || (isITM && dte > 90)
              ? 'Directional bullish bet or LEAP accumulation'
              : moneyness === 'OTM' && dte < 30
                ? 'Speculative lottery ticket — cheap OTM calls'
                : 'Bullish positioning';
            sellerIntent = oi > vol
              ? 'Likely market maker providing liquidity'
              : 'Could be covered call seller (owns shares) or naked writer collecting premium';
          } else if (side === 'BID') {
            // Seller is the aggressor
            sellerIntent = volOi > 1
              ? 'Closing existing long call position (taking profit or cutting loss)'
              : 'Opening new short call — bearish or income strategy (covered call)';
            buyerIntent = 'Market maker or bargain hunter picking up discounted calls';
          }
        } else {
          if (side === 'ASK') {
            buyerIntent = isATM || moneyness === 'OTM'
              ? 'Directional bearish bet or portfolio hedge/insurance'
              : 'Bearish positioning';
            sellerIntent = oi > vol
              ? 'Market maker providing liquidity'
              : 'Could be cash-secured put seller (wants to buy shares cheaper)';
          } else if (side === 'BID') {
            sellerIntent = volOi > 1
              ? 'Closing existing long put (taking profit on bearish trade)'
              : 'Opening new short put — bullish (wants to own shares) or income play';
            buyerIntent = 'Market maker or someone closing a short put position';
          }
        }

        // OI change signal
        let oiSignal = '';
        if (volOi > 2) oiSignal = 'NEW POSITIONS — volume far exceeds existing OI';
        else if (volOi > 1) oiSignal = 'Likely new positions being opened';
        else if (vol > 0 && oi > 0) oiSignal = 'Mix of new and closing trades';
        else oiSignal = 'Low activity';

        // Only include strikes with meaningful activity
        if (vol >= 50 || premium > 50000) {
          const entry = {
            strike: c.strikePrice,
            expiration: expDate,
            dte,
            putCall,
            moneyness,
            pctFromSpot: Math.round(pctFromSpot * 10) / 10,
            bid: c.bid,
            ask: c.ask,
            last: c.last,
            mid: Math.round(mid * 100) / 100,
            volume: vol,
            openInterest: oi,
            volOiRatio: Math.round(volOi * 10) / 10,
            premium: Math.round(premium),
            side,
            sideConfidence,
            delta: c.delta ? Math.round(c.delta * 1000) / 1000 : null,
            gamma: c.gamma ? Math.round(c.gamma * 10000) / 10000 : null,
            theta: c.theta ? Math.round(c.theta * 1000) / 1000 : null,
            iv: c.volatility ? Math.round(c.volatility * 10) / 10 : null,
            buyerIntent,
            sellerIntent,
            oiSignal,
            isUnusual: volOi > 1.5 || premium > 250000 || vol > 5000,
          };

          if (putCall === 'CALL') results.calls.push(entry);
          else results.puts.push(entry);

          // Collect for spread detection
          strikes.push({ ...entry, expKey });
        }
      });
    });

    return strikes;
  };

  const callStrikes = processMap(chainData.callExpDateMap, 'CALL');
  const putStrikes = processMap(chainData.putExpDateMap, 'PUT');

  // ── Spread Detection ──
  // Look for strikes in the same expiration with similar volume (likely a spread)
  const detectSpreads = (strikes) => {
    if (!strikes || strikes.length < 2) return;
    const byExp = {};
    strikes.forEach(s => {
      const key = s.expiration;
      if (!byExp[key]) byExp[key] = [];
      byExp[key].push(s);
    });

    Object.entries(byExp).forEach(([exp, stks]) => {
      if (stks.length < 2) return;
      // Sort by volume desc
      stks.sort((a, b) => b.volume - a.volume);
      // Check pairs for similar volume (within 30%)
      for (let i = 0; i < stks.length - 1; i++) {
        for (let j = i + 1; j < stks.length; j++) {
          const a = stks[i], b = stks[j];
          if (a.volume < 100 || b.volume < 100) continue;
          const ratio = Math.min(a.volume, b.volume) / Math.max(a.volume, b.volume);
          if (ratio > 0.5) {
            // Similar volume = likely a spread
            const width = Math.abs(a.strike - b.strike);
            const isBullSpread = a.putCall === 'CALL' && a.strike < b.strike && a.side === 'ASK';
            const isBearSpread = a.putCall === 'PUT' && a.strike > b.strike && a.side === 'ASK';

            let spreadType = 'Vertical Spread';
            let direction = 'NEUTRAL';
            let description = '';

            if (a.putCall === 'CALL') {
              if (isBullSpread) {
                spreadType = 'Bull Call Spread';
                direction = 'BULLISH';
                description = `Buying $${a.strike}C / Selling $${b.strike}C — defined-risk bullish bet between $${a.strike} and $${b.strike}`;
              } else {
                spreadType = 'Bear Call Spread';
                direction = 'BEARISH';
                description = `Selling $${Math.min(a.strike, b.strike)}C / Buying $${Math.max(a.strike, b.strike)}C — credit spread, bearish or neutral`;
              }
            } else {
              if (isBearSpread) {
                spreadType = 'Bear Put Spread';
                direction = 'BEARISH';
                description = `Buying $${a.strike}P / Selling $${b.strike}P — defined-risk bearish bet`;
              } else {
                spreadType = 'Bull Put Spread';
                direction = 'BULLISH';
                description = `Selling $${Math.max(a.strike, b.strike)}P / Buying $${Math.min(a.strike, b.strike)}P — credit spread, bullish or neutral`;
              }
            }

            results.spreads.push({
              type: spreadType,
              direction,
              description,
              expiration: exp,
              dte: a.dte,
              legs: [
                { strike: a.strike, volume: a.volume, side: a.side, putCall: a.putCall },
                { strike: b.strike, volume: b.volume, side: b.side, putCall: b.putCall },
              ],
              totalVolume: a.volume + b.volume,
              totalPremium: a.premium + b.premium,
              width,
              confidence: ratio > 0.8 ? 'HIGH' : 'MEDIUM',
            });
          }
        }
      }
    });
  };

  detectSpreads(callStrikes);
  detectSpreads(putStrikes);

  // Sort by premium (biggest first)
  results.calls.sort((a, b) => b.premium - a.premium);
  results.puts.sort((a, b) => b.premium - a.premium);
  results.spreads.sort((a, b) => b.totalPremium - a.totalPremium);

  // Summary
  const pcRatio = totalPutVol > 0 ? Math.round((totalPutVol / totalCallVol) * 100) / 100 : 0;
  const callBullPct = totalCallVol > 0 ? Math.round((callAskVol / totalCallVol) * 100) : 0;
  const putBearPct = totalPutVol > 0 ? Math.round((putAskVol / totalPutVol) * 100) : 0;

  let sentiment = 'NEUTRAL';
  if (pcRatio < 0.7 && callBullPct > 60) sentiment = 'BULLISH';
  else if (pcRatio > 1.0 && putBearPct > 60) sentiment = 'BEARISH';
  else if (pcRatio < 0.5) sentiment = 'STRONG_BULLISH';
  else if (pcRatio > 1.5) sentiment = 'STRONG_BEARISH';

  results.summary = {
    totalCallVolume: totalCallVol,
    totalPutVolume: totalPutVol,
    totalCallOI: totalCallOI,
    totalPutOI: totalPutOI,
    putCallRatio: pcRatio,
    callPremium: Math.round(totalCallPremium),
    putPremium: Math.round(totalPutPremium),
    netPremium: Math.round(totalCallPremium - totalPutPremium),
    callAskPct: callBullPct,
    callBidPct: totalCallVol > 0 ? Math.round((callBidVol / totalCallVol) * 100) : 0,
    putAskPct: putBearPct,
    putBidPct: totalPutVol > 0 ? Math.round((putBidVol / totalPutVol) * 100) : 0,
    sentiment,
    unusualCallCount: results.calls.filter(c => c.isUnusual).length,
    unusualPutCount: results.puts.filter(p => p.isUnusual).length,
    detectedSpreads: results.spreads.length,
  };

  return results;
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const ticker = (searchParams.get('ticker') || 'SPY').toUpperCase();

  try {
    const [chain, history, earnings, news] = await Promise.allSettled([
      getOptionsChain(ticker),
      getPriceHistory(ticker, 'year', 2, 'daily', 1),
      getEarnings(ticker),
      getNews(ticker, 7),
    ]);

    const chainData = chain.status === 'fulfilled' ? chain.value : null;
    if (!chainData) return NextResponse.json({ error: 'Failed to fetch chain data' }, { status: 500 });

    const stockPrice = chainData.underlyingPrice || chainData.underlying?.last || 0;
    const analysis = analyzeChain(chainData, stockPrice);

    // Upcoming earnings
    let earningsInfo = null;
    const earningsData = earnings.status === 'fulfilled' ? earnings.value : null;
    if (earningsData?.earningsCalendar) {
      const upcoming = earningsData.earningsCalendar.find(e => {
        if (e.symbol !== ticker) return false;
        const days = Math.ceil((new Date(e.date) - Date.now()) / (1000 * 60 * 60 * 24));
        return days > 0 && days <= 30;
      });
      if (upcoming) earningsInfo = { date: upcoming.date, daysUntil: Math.ceil((new Date(upcoming.date) - Date.now()) / (1000 * 60 * 60 * 24)) };
    }

    return NextResponse.json({
      ticker,
      stockPrice,
      ...analysis,
      earnings: earningsInfo,
      scannedAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
