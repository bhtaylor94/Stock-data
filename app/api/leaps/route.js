// app/api/leaps/route.js
// LEAP Scanner — scans Schwab chain data directly for optimal LEAP setups
// No Claude API needed. Uses the same engine logic as the flow scanner.

import { NextResponse } from 'next/server';
import { getOptionsChain, getPriceHistory } from '@/lib/schwab';
import { getEarnings } from '@/lib/finnhub';
import { analyzeTechnicals, realizedVol, calculateEma200Proximity, adjustGrade } from '@/lib/technicals';
import { MIN_OI, MAX_SPREAD_PCT } from '@/lib/watchlist';

// LEAP ideal criteria
const LEAP_MIN_DTE = 180;
const LEAP_MAX_DTE = 730; // 2 years
const LEAP_DELTA_MIN = 0.45;
const LEAP_DELTA_MAX = 0.75;
const LEAP_MAX_THETA_PCT = 0.005; // 0.5% of contract value per week

function gradeSetup(factors) {
  // factors: { ivCheap, goodDelta, liquidOI, tightSpread, noEarningsSoon, trendAligned, thetaEfficient }
  const points = Object.values(factors).filter(Boolean).length;
  if (points >= 6) return 'A';
  if (points >= 5) return 'B';
  if (points >= 4) return 'C';
  if (points >= 3) return 'D';
  return 'F';
}

function gradeEmoji(grade) {
  return { A: '🟢', B: '🟢', C: '🟡', D: '🟠', F: '🔴' }[grade] || '⚪';
}

async function scanTickerForLeaps(ticker, bias, maxPremium, portfolioSize) {
  try {
    const [chain, priceHistory, earnings] = await Promise.allSettled([
      getOptionsChain(ticker),
      getPriceHistory(ticker, 'year', 2, 'daily', 1),
      getEarnings(ticker),
    ]);

    const chainData = chain.status === 'fulfilled' ? chain.value : null;
    const historyData = priceHistory.status === 'fulfilled' ? priceHistory.value : null;
    const earningsData = earnings.status === 'fulfilled' ? earnings.value : null;

    if (!chainData) return null;

    const stockPrice = chainData.underlyingPrice || chainData.underlying?.last || 0;
    if (stockPrice === 0) return null;

    const closePrices = historyData?.candles ? historyData.candles.map(c => c.close) : [];
    const volumes = historyData?.candles ? historyData.candles.map(c => c.volume) : [];
    const technicals = closePrices.length >= 50 ? analyzeTechnicals(closePrices) : null;
    const rv20 = closePrices.length >= 21 ? realizedVol(closePrices, 20) : null;

    // 200 EMA Proximity
    const emaProximity = calculateEma200Proximity(closePrices, volumes, stockPrice);

    // Check for upcoming earnings
    let nearEarnings = false;
    let earningsDate = null;
    if (earningsData?.earningsCalendar) {
      const upcoming = earningsData.earningsCalendar.find(e => {
        if (e.symbol !== ticker) return false;
        const days = Math.ceil((new Date(e.date) - Date.now()) / (1000 * 60 * 60 * 24));
        return days > 0 && days <= 14;
      });
      if (upcoming) {
        nearEarnings = true;
        earningsDate = upcoming.date;
      }
    }

    // Scan the chain for best LEAP
    const expMap = bias === 'bullish' ? chainData.callExpDateMap : chainData.putExpDateMap;
    if (!expMap) return null;

    let bestSetup = null;
    let bestScore = -1;

    Object.entries(expMap).forEach(([expKey, contracts]) => {
      if (!Array.isArray(contracts)) return;
      const dte = parseInt(expKey.split(':')[1]) || 0;
      if (dte < LEAP_MIN_DTE || dte > LEAP_MAX_DTE) return;

      const expDate = expKey.split(':')[0];

      contracts.forEach(c => {
        const delta = Math.abs(c.delta || 0);
        const oi = c.openInterest || 0;
        const bid = c.bid || 0;
        const ask = c.ask || 0;
        const mid = (bid + ask) / 2;
        const theta = Math.abs(c.theta || 0);
        const vega = c.vega || 0;
        const iv = c.volatility || 0;
        const gamma = c.gamma || 0;
        const premium = mid * 100; // per contract in dollars

        // Skip if outside criteria
        if (delta < LEAP_DELTA_MIN || delta > LEAP_DELTA_MAX) return;
        if (oi < MIN_OI) return;
        if (mid <= 0) return;
        if (premium > maxPremium) return;

        const spread = ask - bid;
        const spreadPct = mid > 0 ? spread / mid : 1;
        const thetaWeekly = theta * 5;
        const thetaPctWeek = mid > 0 ? thetaWeekly / mid : 1;

        // Estimate IV rank (simplified — compare IV to realized vol)
        // IMPORTANT: Schwab returns iv as percentage already (e.g. 46.69, not 0.4669)
        const ivPct = iv; // already a percentage
        const ivCheap = rv20 ? ivPct < rv20 * 1.3 : ivPct < 40;

        // Score factors
        const factors = {
          ivCheap,
          goodDelta: delta >= 0.45 && delta <= 0.75,
          liquidOI: oi >= 1000,
          tightSpread: spreadPct < 0.05,
          noEarningsSoon: !nearEarnings,
          trendAligned: bias === 'bullish'
            ? (technicals?.trend === 'ABOVE_50SMA' || technicals?.rsi < 60)
            : (technicals?.trend === 'BELOW_50SMA' || technicals?.rsi > 40),
          thetaEfficient: thetaPctWeek < LEAP_MAX_THETA_PCT,
        };

        const grade = gradeSetup(factors);
        const gradeScore = { A: 6, B: 5, C: 4, D: 3, F: 1 }[grade] || 0;

        // Prefer higher grade, then higher OI, then better delta
        const compositeScore = gradeScore * 1000 + oi * 0.01 + delta * 100;

        if (compositeScore > bestScore) {
          bestScore = compositeScore;

          const breakeven = bias === 'bullish'
            ? c.strikePrice + mid
            : c.strikePrice - mid;
          const moveRequired = ((breakeven - stockPrice) / stockPrice) * 100;

          // Position sizing
          const maxContracts25k = Math.floor((25000 * 0.05) / premium) || 1;
          const maxContracts50k = Math.floor((50000 * 0.05) / premium) || 1;
          const maxContracts100k = Math.floor((100000 * 0.05) / premium) || 1;
          const maxContractsUser = Math.floor((portfolioSize * 0.05) / premium) || 1;

          // 50/21 exit rules
          const profitTarget = mid * 1.5;
          const stopLoss = mid * 0.79;

          // Spread alternative — sell next strike out
          let spreadAlt = null;
          const nextStrike = contracts.find(s =>
            bias === 'bullish'
              ? s.strikePrice > c.strikePrice && Math.abs(s.strikePrice - c.strikePrice) <= stockPrice * 0.05
              : s.strikePrice < c.strikePrice && Math.abs(s.strikePrice - c.strikePrice) <= stockPrice * 0.05
          );
          if (nextStrike) {
            const sellMid = ((nextStrike.bid || 0) + (nextStrike.ask || 0)) / 2;
            if (sellMid > 0) {
              const netDebit = mid - sellMid;
              const width = Math.abs(c.strikePrice - nextStrike.strikePrice);
              const maxProfit = (width - netDebit) * 100;
              const maxLoss = netDebit * 100;
              spreadAlt = {
                sellStrike: nextStrike.strikePrice,
                sellMid: Math.round(sellMid * 100) / 100,
                netDebit: Math.round(netDebit * 100) / 100,
                netDebitTotal: Math.round(netDebit * 100),
                maxProfit: Math.round(maxProfit),
                maxLoss: Math.round(maxLoss),
                rewardRisk: maxLoss > 0 ? Math.round((maxProfit / maxLoss) * 10) / 10 : 0,
                savings: Math.round((1 - netDebit / mid) * 100),
              };
            }
          }

          // Apply 200 EMA grade modifier
          const adjustedGrade = emaProximity ? adjustGrade(grade, emaProximity.gradeModifier) : grade;

          bestSetup = {
            ticker,
            strike: c.strikePrice,
            type: bias === 'bullish' ? 'CALL' : 'PUT',
            expiration: expDate,
            dte,
            grade: adjustedGrade,
            originalGrade: grade !== adjustedGrade ? grade : undefined,
            gradeEmoji: gradeEmoji(adjustedGrade),
            factors,
            premium: Math.round(mid * 100) / 100,
            premiumTotal: Math.round(premium),
            delta: Math.round(delta * 1000) / 1000,
            gamma: Math.round(gamma * 10000) / 10000,
            theta: Math.round((c.theta || 0) * 1000) / 1000,
            thetaWeekly: Math.round(thetaWeekly * 100) / 100,
            thetaMonthly: Math.round(theta * 21 * 100) / 100,
            vega: Math.round(vega * 1000) / 1000,
            iv: Math.round(ivPct * 10) / 10,
            oi,
            bidAskSpread: Math.round(spreadPct * 1000) / 10,
            stockPrice,
            breakeven: Math.round(breakeven * 100) / 100,
            moveRequired: Math.round(moveRequired * 10) / 10,
            rsi: technicals?.rsi || null,
            trend: technicals?.trend || null,
            nearEarnings,
            earningsDate,
            emaProximity,
            sizing: {
              portfolio25k: maxContracts25k,
              portfolio50k: maxContracts50k,
              portfolio100k: maxContracts100k,
              portfolioUser: maxContractsUser,
              portfolioSize,
            },
            exits: {
              profitTarget: Math.round(profitTarget * 100) / 100,
              profitTargetDollar: Math.round((profitTarget - mid) * 100),
              stopLoss: Math.round(stopLoss * 100) / 100,
              stopLossDollar: Math.round((mid - stopLoss) * 100),
              timeExit: dte > 60 ? `Exit or roll with 45-60 DTE remaining` : 'DTE already short — monitor closely',
            },
            spreadAlternative: spreadAlt,
            thesis: buildThesis(ticker, bias, grade, factors, stockPrice, c.strikePrice, mid, dte, ivPct, rv20, technicals, nearEarnings),
            primaryRisk: buildRisk(factors, nearEarnings, ivPct, rv20),
          };
        }
      });
    });

    return bestSetup;
  } catch (err) {
    console.error(`LEAP scan failed for ${ticker}:`, err.message);
    return null;
  }
}

function buildThesis(ticker, bias, grade, factors, stockPrice, strike, premium, dte, iv, rv, technicals, nearEarnings) {
  const parts = [];
  const direction = bias === 'bullish' ? 'bullish' : 'bearish';

  if (factors.ivCheap) {
    parts.push(`IV at ${iv.toFixed(1)}% is cheap${rv ? ` relative to ${rv.toFixed(1)}% realized vol` : ''} — you're getting a discount on premium.`);
  } else {
    parts.push(`IV at ${iv.toFixed(1)}% is elevated${rv ? ` vs ${rv.toFixed(1)}% realized` : ''} — consider the spread alternative to reduce cost.`);
  }

  if (factors.goodDelta) {
    parts.push(`Delta is in the sweet spot for LEAPs — good balance of probability and leverage.`);
  }

  if (factors.trendAligned && technicals) {
    parts.push(`Technical picture supports the ${direction} thesis — ${technicals.trend === 'ABOVE_50SMA' ? 'price above 50-day average' : 'price below 50-day average'}${technicals.rsi ? `, RSI at ${technicals.rsi.toFixed(0)}` : ''}.`);
  }

  if (nearEarnings) {
    parts.push(`⚠ Earnings approaching — IV could crush after the report. Consider waiting.`);
  }

  if (factors.thetaEfficient) {
    parts.push(`Theta decay is efficient for this DTE — time isn't bleeding you dry.`);
  }

  return parts.join(' ');
}

function buildRisk(factors, nearEarnings, iv, rv) {
  if (nearEarnings) return 'IV crush after earnings could significantly reduce contract value even if the stock moves in your direction.';
  if (!factors.ivCheap) return 'IV is elevated — if volatility compresses, vega losses could offset directional gains.';
  if (!factors.trendAligned) return 'Technical trend is not aligned with the trade direction — the stock may move against you near-term.';
  if (!factors.liquidOI) return 'Low open interest — may have difficulty getting good fills or exiting the position.';
  return 'Standard directional risk — the stock may not move enough before expiration to overcome the premium paid.';
}

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      tickers = ['NVDA', 'AAPL', 'MSFT', 'GOOGL', 'AMZN'],
      bias = 'bullish',
      max_premium = 5000,
      portfolio_size = 50000,
    } = body;

    const results = [];

    // Process in batches of 3 to respect rate limits
    for (let i = 0; i < tickers.length; i += 3) {
      const batch = tickers.slice(i, i + 3);
      const batchResults = await Promise.allSettled(
        batch.map(ticker => scanTickerForLeaps(ticker, bias, max_premium, portfolio_size))
      );

      batchResults.forEach((r, idx) => {
        if (r.status === 'fulfilled' && r.value) {
          results.push(r.value);
        } else {
          results.push({
            ticker: batch[idx],
            grade: 'F',
            gradeEmoji: '🔴',
            thesis: `No suitable LEAP found for ${batch[idx]} matching your criteria.`,
            primaryRisk: 'N/A',
            noSetup: true,
          });
        }
      });

      if (i + 3 < tickers.length) await new Promise(r => setTimeout(r, 500));
    }

    // Sort by grade
    const gradeOrder = { A: 0, B: 1, C: 2, D: 3, F: 4 };
    results.sort((a, b) => (gradeOrder[a.grade] || 4) - (gradeOrder[b.grade] || 4));

    return NextResponse.json({ results, scannedAt: new Date().toISOString() });
  } catch (error) {
    console.error('LEAP scan error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
