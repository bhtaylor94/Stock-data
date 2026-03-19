// lib/engine.js
// FlowHunter 5-Layer Institutional Scoring Engine
// Each layer scores 0 or 1. Minimum 4/5 to surface a card.

import { MIN_DTE, MAX_DTE, MIN_OI, MAX_SPREAD_PCT, VOL_OI_THRESHOLD, MIN_PREMIUM } from './watchlist.js';
import { analyzeTechnicals, scoreTechnicals, realizedVol, calculateEma200Proximity } from './technicals.js';

// ============================================================
// LAYER 1: Flow Intent Analysis
// Question: Is this speculative conviction or just hedging?
// ============================================================
export function scoreFlowIntent(flowData) {
  // flowData: { strike, stockPrice, side, orderType, volume, oi, premium, putCall, dte }
  const { strike, stockPrice, side, volume, oi, premium, putCall, dte } = flowData;

  const pctFromSpot = Math.abs(strike - stockPrice) / stockPrice;
  const volOi = oi > 0 ? volume / oi : volume;
  const isATM = pctFromSpot < 0.05;
  const isNearOTM = pctFromSpot < 0.10;
  const isFarOTM = pctFromSpot > 0.10;

  let intent = 'AMBIGUOUS';
  let direction = putCall === 'CALL'
    ? (side === 'ASK' ? 'BULLISH' : 'BEARISH')
    : (side === 'BID' || side === 'ASK' ? (putCall === 'PUT' ? 'BEARISH' : 'BULLISH') : 'AMBIGUOUS');

  // Refined direction logic
  if (putCall === 'CALL' && side === 'ASK') direction = 'BULLISH';
  if (putCall === 'CALL' && side === 'BID') direction = 'BEARISH'; // selling calls
  if (putCall === 'PUT' && side === 'ASK') direction = 'BEARISH'; // buying puts
  if (putCall === 'PUT' && side === 'BID') direction = 'BULLISH'; // selling puts

  // Speculative indicators
  let specScore = 0;
  if (isATM || isNearOTM) specScore++;
  if (side === 'ASK' && putCall === 'CALL') specScore++; // aggressive call buying
  if (side === 'ASK' && putCall === 'PUT') specScore++; // aggressive put buying
  if (volOi > 2.0) specScore++; // new positions
  if (premium > 500000) specScore++;
  if (dte >= MIN_DTE && dte <= 90) specScore++; // near-term conviction

  // Hedging indicators
  let hedgeScore = 0;
  if (isFarOTM) hedgeScore++;
  if (dte > 180) hedgeScore++;
  if (side === 'MID') hedgeScore++;
  if (volOi < 1.0) hedgeScore++; // rolling existing positions

  if (specScore >= 3) intent = 'SPECULATIVE';
  else if (hedgeScore >= 3) intent = 'HEDGING';

  const score = intent === 'SPECULATIVE' ? 1 : 0;

  // Build description
  const sideLabel = side === 'ASK' ? 'ask side (aggressive buy)' : side === 'BID' ? 'bid side' : 'mid';
  const volLabel = volume.toLocaleString();
  const premLabel = premium >= 1000000
    ? `$${(premium / 1000000).toFixed(1)}M`
    : `$${(premium / 1000).toFixed(0)}K`;
  const oiLabel = oi.toLocaleString();

  const description = intent === 'SPECULATIVE'
    ? `${volLabel} contracts at ${isATM ? 'ATM' : 'near-ATM'} $${strike} strike, filled on ${sideLabel}. ${premLabel} premium. Vol/OI ${volOi.toFixed(1)}x — this looks like aggressive speculative positioning, not hedging.`
    : intent === 'HEDGING'
      ? `${volLabel} contracts at far OTM $${strike} strike. This appears to be protective hedging, not directional conviction.`
      : `${volLabel} contracts at $${strike}. Flow intent is unclear — could be hedging or speculative.`;

  return {
    score,
    intent,
    direction,
    description,
    volume,
    openInterest: oi,
    volOiRatio: Math.round(volOi * 10) / 10,
    side,
    premium,
    orderType: flowData.orderType || 'SINGLE',
  };
}

// ============================================================
// LAYER 2: Dealer Positioning (Gamma Exposure)
// Question: Are market makers positioned to help or hurt this trade?
// ============================================================
export function scoreGammaExposure(chainData, stockPrice, direction) {
  // chainData: full options chain with all strikes, calls/puts, gamma, OI
  if (!chainData) return { score: 0, description: 'Chain data unavailable' };

  let totalCallGex = 0;
  let totalPutGex = 0;
  let maxCallGexStrike = 0;
  let maxCallGex = 0;
  let maxPutGexStrike = 0;
  let maxPutGex = 0;

  const processMap = (map, type) => {
    if (!map) return;
    Object.entries(map).forEach(([expDate, contracts]) => {
      if (!Array.isArray(contracts)) return;
      contracts.forEach(c => {
        const gamma = c.gamma || 0;
        const oi = c.openInterest || 0;
        const gex = gamma * oi * 100 * stockPrice * stockPrice;

        if (type === 'call') {
          totalCallGex += gex;
          if (gex > maxCallGex) { maxCallGex = gex; maxCallGexStrike = c.strikePrice; }
        } else {
          totalPutGex += gex;
          if (gex > maxPutGex) { maxPutGex = gex; maxPutGexStrike = c.strikePrice; }
        }
      });
    });
  };

  processMap(chainData.callExpDateMap, 'call');
  processMap(chainData.putExpDateMap, 'put');

  const netGex = totalCallGex - totalPutGex;
  const regime = netGex > 0 ? 'POSITIVE' : 'NEGATIVE';
  const callWall = maxCallGexStrike || stockPrice * 1.05;
  const putWall = maxPutGexStrike || stockPrice * 0.95;

  // Estimate flip point (simplified: where call GEX = put GEX)
  const flipPoint = (callWall + putWall) / 2;

  let score = 0;
  let description = '';

  if (direction === 'BULLISH') {
    if (regime === 'NEGATIVE' && stockPrice < callWall) {
      score = 1;
      description = `Dealers are short gamma below $${callWall.toFixed(0)} — if price breaks above, forced dealer buying could accelerate the move. Call wall at $${callWall.toFixed(0)}.`;
    } else if (regime === 'POSITIVE') {
      description = `Dealers are in positive gamma — market is stable but no squeeze catalyst. Call wall at $${callWall.toFixed(0)} acts as a magnet.`;
    } else {
      description = `Dealer positioning is neutral for this bullish setup. Call wall at $${callWall.toFixed(0)}.`;
    }
  } else {
    if (regime === 'POSITIVE' && stockPrice > putWall) {
      score = 1;
      description = `Dealers are in positive gamma above $${putWall.toFixed(0)} — a break below flips positioning and forced selling accelerates the drop. Put wall at $${putWall.toFixed(0)}.`;
    } else if (regime === 'NEGATIVE') {
      score = 1;
      description = `Dealers are short gamma — already in a volatile regime. Downside moves will be amplified. Put wall at $${putWall.toFixed(0)}.`;
    } else {
      description = `Dealer positioning is neutral for this bearish setup. Put wall at $${putWall.toFixed(0)}.`;
    }
  }

  return { score, regime, flipPoint: Math.round(flipPoint * 100) / 100, callWall: Math.round(callWall * 100) / 100, putWall: Math.round(putWall * 100) / 100, description };
}

// ============================================================
// LAYER 3: Volatility Edge
// Question: Are options cheap or expensive for this trade?
// ============================================================
export function scoreVolatility(chainData, closePrices, direction) {
  if (!chainData || !closePrices || closePrices.length < 30) {
    return { score: 0, description: 'Insufficient data for volatility analysis' };
  }

  // Extract IV from chain (use underlying IV if available)
  // IMPORTANT: Schwab returns volatility as a percentage already (e.g. 46.69, not 0.4669)
  const currentIV = chainData.volatility || null;

  // Calculate realized vol (also returns as percentage, e.g. 35.7)
  const rv20 = realizedVol(closePrices, 20);

  // IV Rank heuristic (approximate — compare IV to realized vol)
  // currentIV is already a percentage (e.g. 46.69)
  const ivRank = currentIV ? Math.min(100, Math.max(0, (currentIV - 15) * 1.5)) : 50;

  const volPremium = currentIV && rv20 ? (currentIV - rv20) : 0;

  // Expected move from ATM straddle
  let expectedMove = null;
  if (chainData.callExpDateMap) {
    const firstExp = Object.values(chainData.callExpDateMap)[0];
    if (firstExp && Array.isArray(firstExp)) {
      const atmCall = firstExp.reduce((closest, c) =>
        Math.abs(c.strikePrice - closePrices[closePrices.length - 1]) <
        Math.abs(closest.strikePrice - closePrices[closePrices.length - 1]) ? c : closest
      , firstExp[0]);
      const putMap = chainData.putExpDateMap;
      const firstPutExp = putMap ? Object.values(putMap)[0] : null;
      if (firstPutExp && Array.isArray(firstPutExp)) {
        const atmPut = firstPutExp.reduce((closest, c) =>
          Math.abs(c.strikePrice - atmCall.strikePrice) <
          Math.abs(closest.strikePrice - atmCall.strikePrice) ? c : closest
        , firstPutExp[0]);
        const callMid = ((atmCall.bid || 0) + (atmCall.ask || 0)) / 2;
        const putMid = ((atmPut.bid || 0) + (atmPut.ask || 0)) / 2;
        expectedMove = callMid + putMid;
      }
    }
  }

  let score = 0;
  let description = '';

  // For long options: IV should be cheap (rank < 40 or vol premium < 5)
  // For spreads: IV moderate-high is fine (strategy offsets it)
  if (ivRank < 40 || volPremium < 5) {
    score = 1;
    description = `IV is cheap — IV Rank ${Math.round(ivRank)}%${rv20 ? `, realized vol ${rv20.toFixed(1)}%` : ''}. Options are relatively inexpensive.`;
  } else if (ivRank < 60) {
    score = 1;
    description = `IV is moderate — IV Rank ${Math.round(ivRank)}%. A spread strategy offsets the elevated premium.`;
  } else {
    score = 0;
    description = `IV is elevated — IV Rank ${Math.round(ivRank)}%. Premium is expensive. Tight spreads recommended to limit IV exposure.`;
  }

  return {
    score,
    ivRank: Math.round(ivRank),
    ivPercentile: Math.round(ivRank), // simplified for now
    realizedVol: rv20 ? Math.round(rv20 * 10) / 10 : null,
    volPremium: Math.round(volPremium * 10) / 10,
    expectedMove: expectedMove ? Math.round(expectedMove * 100) / 100 : null,
    description,
  };
}

// ============================================================
// LAYER 4: Catalyst Timing
// Question: Is there an event that could amplify this move?
// ============================================================
export function scoreCatalyst(earningsData, newsData, ticker) {
  let catalystType = 'NONE';
  let catalystDate = null;
  let daysUntil = null;
  let description = 'No significant catalyst within 14 days.';
  let score = 0;

  // Check earnings
  if (earningsData?.earningsCalendar) {
    const upcoming = earningsData.earningsCalendar
      .filter(e => e.symbol === ticker)
      .find(e => {
        const d = new Date(e.date);
        const days = Math.ceil((d - Date.now()) / (1000 * 60 * 60 * 24));
        return days > 0 && days <= 30;
      });

    if (upcoming) {
      catalystType = 'EARNINGS';
      catalystDate = upcoming.date;
      daysUntil = Math.ceil((new Date(upcoming.date) - Date.now()) / (1000 * 60 * 60 * 24));
      score = daysUntil <= 14 ? 1 : 0;
      description = `Earnings in ${daysUntil} days (${upcoming.date}). ${score ? 'Flow is building ahead of the report — institutions are positioning early.' : 'Earnings approaching but still 2+ weeks out.'}`;
    }
  }

  // Check news (if no earnings catalyst found)
  if (score === 0 && newsData && Array.isArray(newsData) && newsData.length > 0) {
    const recentImpactful = newsData.filter(n => {
      const ageHours = (Date.now() - n.datetime * 1000) / (1000 * 60 * 60);
      return ageHours < 48; // last 48 hours
    });

    if (recentImpactful.length >= 3) {
      catalystType = 'NEWS';
      score = 1;
      description = `${recentImpactful.length} news articles in last 48 hours — significant news cycle is driving attention to this name.`;
    }
  }

  return { score, type: catalystType, date: catalystDate, daysUntil, description };
}

// ============================================================
// LAYER 5: Technical Confirmation
// (Delegated to technicals.js — scoreTechnicals function)
// ============================================================

// ============================================================
// STRATEGY SELECTION
// Based on layer outputs, pick the optimal trade
// ============================================================
export function selectStrategy(direction, ivRank, catalystDaysUntil, stockPrice, chainData) {
  // Determine DTE target
  let targetDTE;
  if (catalystDaysUntil && catalystDaysUntil > 0) {
    targetDTE = catalystDaysUntil + 10; // give move time after event
  } else if (ivRank < 30) {
    targetDTE = 45;
  } else if (ivRank < 50) {
    targetDTE = 30;
  } else {
    targetDTE = 21;
  }
  targetDTE = Math.max(MIN_DTE, Math.min(MAX_DTE, targetDTE));

  // Pick strategy based on IV environment
  let strategy, reasoning;
  if (ivRank < 30) {
    strategy = direction === 'BULLISH' ? 'Long Call' : 'Long Put';
    reasoning = 'IV is cheap — long option maximizes upside leverage at a discount.';
  } else if (ivRank < 55) {
    strategy = direction === 'BULLISH' ? 'Bull Call Spread' : 'Bear Put Spread';
    reasoning = 'IV is moderate — spread reduces cost while capturing the move.';
  } else {
    strategy = direction === 'BULLISH' ? 'Bull Call Spread' : 'Bear Put Spread';
    reasoning = 'IV is elevated — tight spread limits exposure to expensive premium.';
  }

  // Find best expiration near targetDTE
  const expMap = direction === 'BULLISH'
    ? chainData?.callExpDateMap
    : chainData?.putExpDateMap;

  if (!expMap) return null;

  let bestExp = null;
  let bestDTE = Infinity;
  let bestContracts = null;

  Object.entries(expMap).forEach(([expKey, contracts]) => {
    // expKey format: "2026-04-18:31" (date:dte)
    const dte = parseInt(expKey.split(':')[1]) || 0;
    if (dte < MIN_DTE || dte > MAX_DTE) return;
    if (Math.abs(dte - targetDTE) < Math.abs(bestDTE - targetDTE)) {
      bestDTE = dte;
      bestExp = expKey.split(':')[0];
      bestContracts = contracts;
    }
  });

  if (!bestContracts || !Array.isArray(bestContracts)) return null;

  // Find ATM strike (closest to current price)
  const sorted = [...bestContracts].sort((a, b) =>
    Math.abs(a.strikePrice - stockPrice) - Math.abs(b.strikePrice - stockPrice)
  );

  const buyLeg = sorted[0];
  if (!buyLeg) return null;

  // Validate liquidity
  const spread = buyLeg.ask - buyLeg.bid;
  const mid = (buyLeg.ask + buyLeg.bid) / 2;
  if (mid <= 0 || spread / mid > MAX_SPREAD_PCT) return null;
  if ((buyLeg.openInterest || 0) < MIN_OI) return null;

  const legs = [{
    action: 'BUY',
    type: direction === 'BULLISH' ? 'CALL' : 'PUT',
    strike: buyLeg.strikePrice,
    expiration: bestExp,
    dte: bestDTE,
    price: Math.round(mid * 100) / 100,
    delta: buyLeg.delta || 0,
  }];

  let maxRisk = Math.round(mid * 100); // per contract in dollars
  let maxReward = 'unlimited';
  let breakeven = direction === 'BULLISH'
    ? buyLeg.strikePrice + mid
    : buyLeg.strikePrice - mid;

  // Add sell leg for spreads
  if (strategy.includes('Spread') && sorted.length > 2) {
    const sellLeg = sorted[2] || sorted[1]; // 1-2 strikes away
    if (sellLeg && sellLeg.openInterest >= MIN_OI) {
      const sellMid = (sellLeg.ask + sellLeg.bid) / 2;
      legs.push({
        action: 'SELL',
        type: direction === 'BULLISH' ? 'CALL' : 'PUT',
        strike: sellLeg.strikePrice,
        expiration: bestExp,
        dte: bestDTE,
        price: Math.round(sellMid * 100) / 100,
        delta: sellLeg.delta || 0,
      });
      const netDebit = mid - sellMid;
      maxRisk = Math.round(Math.abs(netDebit) * 100);
      const width = Math.abs(buyLeg.strikePrice - sellLeg.strikePrice);
      maxReward = Math.round((width - Math.abs(netDebit)) * 100);
      breakeven = direction === 'BULLISH'
        ? buyLeg.strikePrice + Math.abs(netDebit)
        : buyLeg.strikePrice - Math.abs(netDebit);
    }
  }

  // Probability of profit (approximate from delta)
  const pop = Math.round(Math.abs(buyLeg.delta || 0.45) * 100);

  return {
    strategy,
    reasoning,
    legs,
    maxRisk,
    maxReward,
    breakeven: Math.round(breakeven * 100) / 100,
    expectedMove: null, // filled from vol layer
    pop,
  };
}

// ============================================================
// MASTER SCORING — Run all 5 layers and produce a card
// ============================================================
export function scoreOpportunity({ flowData, chainData, closePrices, earningsData, newsData, ticker, stockPrice, volumes }) {
  // Layer 1: Flow Intent
  const flow = scoreFlowIntent(flowData);
  if (flow.score === 0) return null;

  const direction = flow.direction;

  // Layer 2: Gamma Exposure
  const gamma = scoreGammaExposure(chainData, stockPrice, direction);

  // Layer 3: Volatility Edge
  const volatility = scoreVolatility(chainData, closePrices, direction);

  // Layer 4: Catalyst
  const catalyst = scoreCatalyst(earningsData, newsData, ticker);

  // Layer 5: Technical Confirmation
  const technicals = analyzeTechnicals(closePrices);
  const technical = scoreTechnicals(technicals, direction);

  // 200 EMA Proximity
  const emaProximity = calculateEma200Proximity(closePrices, volumes, stockPrice);

  // Total confidence
  const confidence = flow.score + gamma.score + volatility.score + catalyst.score + technical.score;

  // Only surface 4/5 or 5/5
  if (confidence < 4) return null;

  // If price is below 200 EMA on a bullish setup, don't surface
  if (direction === 'BULLISH' && emaProximity?.state === 'BELOW_EMA') return null;
  // If price is above 200 EMA on a bearish setup, that's fine (breaking support)

  // Select strategy
  const suggestedPlay = selectStrategy(
    direction,
    volatility.ivRank,
    catalyst.daysUntil,
    stockPrice,
    chainData
  );

  if (!suggestedPlay) return null;

  // Build thesis
  const thesisParts = [flow.description, gamma.description, volatility.description];
  if (catalyst.score) thesisParts.push(catalyst.description);
  thesisParts.push(technical.description);
  if (emaProximity?.message) thesisParts.push(emaProximity.message);
  const thesis = thesisParts.join(' ');

  return {
    id: `${ticker}-${Date.now()}`,
    timestamp: new Date().toISOString(),
    ticker,
    stockPrice,
    change: 0,
    confidence,
    direction,
    thesis,
    layers: { flow, gamma, volatility, catalyst, technical },
    emaProximity,
    insiderActivity: { confirmed: false, conflictWarning: false, entries: [], description: '' },
    marketFlow: { sentiment: 'NEUTRAL', netPremium: 0, aligned: true, description: '' },
    suggestedPlay,
    tracking: null,
  };
}
