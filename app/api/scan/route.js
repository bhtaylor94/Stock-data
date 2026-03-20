// app/api/scan/route.js
import { NextResponse } from 'next/server';
import { getOptionsChain, getQuotes, getPriceHistory } from '@/lib/schwab';
import { getNews, getEarnings } from '@/lib/finnhub';
import { WATCHLIST, VOL_OI_THRESHOLD, MIN_PREMIUM, MIN_DTE, MAX_DTE, VIX_CAUTION, VIX_DANGER, VIX_HALT } from '@/lib/watchlist';
import { scoreOpportunity } from '@/lib/engine';
import { getInsiderActivity } from '@/lib/edgar';
import { calculateNetFlow, getMarketFlow } from '@/lib/netflow';
import { getTrackedTrades, updateTrackedTrade, cleanupExpiredTrades } from '@/lib/tracker';

let prevScanCache = {};
let lastInsiderCheck = {};

function detectUnusualFlow(chain, stockPrice) {
  const flows = [];
  if (!chain) return flows;
  const processExpMap = (expMap, putCall) => {
    if (!expMap) return;
    Object.entries(expMap).forEach(([expKey, contracts]) => {
      if (!Array.isArray(contracts)) return;
      const dte = parseInt(expKey.split(':')[1]) || 0;
      if (dte < MIN_DTE || dte > MAX_DTE) return;
      contracts.forEach(c => {
        const volume = c.totalVolume || 0;
        const oi = c.openInterest || 0;
        const mid = ((c.bid || 0) + (c.ask || 0)) / 2;
        const premium = volume * mid * 100;
        const volOi = oi > 0 ? volume / oi : (volume > 100 ? 10 : 0);
        const isUnusual = (volOi > VOL_OI_THRESHOLD && volume > 500) || (premium > MIN_PREMIUM) || (volume > 5000 && volOi > 1.2);
        if (isUnusual) {
          const last = c.last || mid;
          let side = 'MID';
          if (c.ask && c.bid) {
            if (Math.abs(last - c.ask) < Math.abs(last - c.bid) * 0.5) side = 'ASK';
            else if (Math.abs(last - c.bid) < Math.abs(last - c.ask) * 0.5) side = 'BID';
          }
          flows.push({ strike: c.strikePrice, stockPrice, side, orderType: volume > 2000 ? 'SWEEP' : volume > 500 ? 'BLOCK' : 'SINGLE', volume, oi, premium: Math.round(premium), putCall, dte, expiration: expKey.split(':')[0], delta: c.delta, iv: c.volatility, bid: c.bid, ask: c.ask });
        }
      });
    });
  };
  processExpMap(chain.callExpDateMap, 'CALL');
  processExpMap(chain.putExpDateMap, 'PUT');
  flows.sort((a, b) => b.premium - a.premium);
  return flows;
}

export async function GET() {
  try {
    const opportunities = [];
    const errors = [];
    const marketQuotes = {};
    let vixLevel = null;
    let vixWarning = null;

    // Fetch market benchmarks + VIX
    try {
      const quotes = await getQuotes(['SPY', 'QQQ']);
      if (quotes) {
        Object.entries(quotes).forEach(([sym, data]) => {
          const q = data.quote || data;
          marketQuotes[sym] = { price: q.lastPrice || q.mark || 0, change: Math.round((q.netPercentChangeInDouble || q.netPercentChange || 0) * 100) / 100 };
        });
      }
    } catch (e) { /* non-critical */ }

    // Fetch VIX separately (Finnhub for free VIX quote)
    try {
      const vixRes = await fetch(`https://finnhub.io/api/v1/quote?symbol=VIX&token=${process.env.FINNHUB_API_KEY}`);
      if (vixRes.ok) {
        const vixData = await vixRes.json();
        vixLevel = vixData.c || null; // current price
        marketQuotes.VIX = { price: vixLevel, change: Math.round((vixData.dp || 0) * 100) / 100 };
      }
    } catch (e) { /* non-critical */ }

    // VIX Circuit Breaker
    if (vixLevel) {
      if (vixLevel >= VIX_HALT) {
        vixWarning = {
          level: 'HALT',
          message: `🚨 VIX at ${vixLevel.toFixed(1)} — EXTREME FEAR. All bullish suggestions paused. Market conditions are too volatile for directional long options. Protect capital.`,
          color: '#ef4444',
        };
      } else if (vixLevel >= VIX_DANGER) {
        vixWarning = {
          level: 'DANGER',
          message: `🔴 VIX at ${vixLevel.toFixed(1)} — HIGH VOLATILITY. Bullish setups are high risk. Premiums are inflated. Consider reducing position size or sitting out.`,
          color: '#ef4444',
        };
      } else if (vixLevel >= VIX_CAUTION) {
        vixWarning = {
          level: 'CAUTION',
          message: `⚠️ VIX at ${vixLevel.toFixed(1)} — ELEVATED. Options premiums are above average. Be selective and favor spreads over naked long options.`,
          color: '#eab308',
        };
      }
    }

    const batchSize = 5;
    for (let i = 0; i < WATCHLIST.length; i += batchSize) {
      const batch = WATCHLIST.slice(i, i + batchSize);
      await Promise.allSettled(batch.map(async (ticker) => {
        try {
          const [chain, priceHistory, news, earnings] = await Promise.allSettled([
            getOptionsChain(ticker),
            getPriceHistory(ticker, 'year', 2, 'daily', 1),
            getNews(ticker, 7),
            getEarnings(ticker),
          ]);
          const chainData = chain.status === 'fulfilled' ? chain.value : null;
          const historyData = priceHistory.status === 'fulfilled' ? priceHistory.value : null;
          const newsData = news.status === 'fulfilled' ? news.value : null;
          const earningsData = earnings.status === 'fulfilled' ? earnings.value : null;
          if (!chainData) return;

          const stockPrice = chainData.underlyingPrice || chainData.underlying?.last || chainData.underlying?.mark || 0;
          if (stockPrice === 0) return;

          calculateNetFlow(ticker, chainData);
          const closePrices = historyData?.candles ? historyData.candles.map(c => c.close) : [];
          const volumes = historyData?.candles ? historyData.candles.map(c => c.volume) : [];
          const flows = detectUnusualFlow(chainData, stockPrice);
          prevScanCache[ticker] = { timestamp: Date.now() };

          for (const flowData of flows.slice(0, 3)) {
            const card = scoreOpportunity({ flowData, chainData, closePrices, earningsData, newsData, ticker, stockPrice, volumes });
            if (!card) continue;

            const prevClose = closePrices.length >= 2 ? closePrices[closePrices.length - 2] : stockPrice;
            card.change = Math.round(((stockPrice - prevClose) / prevClose) * 1000) / 10;

            // Deduplicate: only keep the best card per ticker
            const existingIdx = opportunities.findIndex(o => o.ticker === ticker);
            if (existingIdx >= 0) {
              // Replace only if this card has higher confidence or same confidence + bigger premium
              const existing = opportunities[existingIdx];
              if (card.confidence > existing.confidence ||
                 (card.confidence === existing.confidence && (card.layers.flow.premium || 0) > (existing.layers.flow.premium || 0))) {
                opportunities[existingIdx] = card;
              }
              continue; // skip adding a duplicate
            }

            // Layer 6: Insider/Congressional (once per day per ticker)
            const now = Date.now();
            if (now - (lastInsiderCheck[ticker] || 0) > 24 * 60 * 60 * 1000) {
              try {
                const insiderData = await getInsiderActivity(ticker, card.direction);
                card.insiderActivity = insiderData;
                if (insiderData.confirmed && insiderData.description) card.thesis += ' ' + insiderData.description;
                else if (insiderData.conflictWarning && insiderData.description) card.thesis += ' ' + insiderData.description;
                lastInsiderCheck[ticker] = now;
              } catch { /* non-critical */ }
            }

            // Market flow context
            const mf = getMarketFlow();
            card.marketFlow = { sentiment: mf.sentiment, netPremium: mf.netPremium, aligned: mf.aligned(card.direction), description: mf.description(card.direction) };
            if (mf.sentiment !== 'NEUTRAL') card.thesis += ' ' + mf.description(card.direction);

            opportunities.push(card);
          }

          // Update tracked trades for this ticker
          const tracked = getTrackedTrades().filter(t => t.ticker === ticker && t.status !== 'EXPIRED');
          for (const trade of tracked) {
            const leg = trade.legs[0];
            if (!leg) continue;
            const expMap = leg.type === 'CALL' ? chainData.callExpDateMap : chainData.putExpDateMap;
            if (!expMap) continue;
            let currentOI = 0, currentPrice = 0;
            Object.entries(expMap).forEach(([expKey, contracts]) => {
              if (!expKey.startsWith(leg.expiration) || !Array.isArray(contracts)) return;
              const match = contracts.find(c => c.strikePrice === leg.strike);
              if (match) { currentOI = match.openInterest || 0; currentPrice = ((match.bid || 0) + (match.ask || 0)) / 2; }
            });
            const oppositeFlows = flows.filter(f => trade.direction === 'BULLISH' ? f.putCall === 'PUT' && f.side === 'ASK' : f.putCall === 'CALL' && f.side === 'ASK');
            updateTrackedTrade(trade.id, currentOI, currentPrice, oppositeFlows.some(f => f.premium > 500000));
          }
        } catch (err) { errors.push({ ticker, error: err.message }); }
      }));
      if (i + batchSize < WATCHLIST.length) await new Promise(r => setTimeout(r, 500));
    }

    cleanupExpiredTrades();

    // Apply VIX circuit breaker — filter bullish cards in extreme conditions
    let filteredOpps = opportunities;
    if (vixWarning?.level === 'HALT') {
      filteredOpps = opportunities.filter(o => o.direction !== 'BULLISH');
    } else if (vixWarning) {
      // Add VIX warning to every bullish card's thesis
      filteredOpps = opportunities.map(o => {
        if (o.direction === 'BULLISH') {
          return { ...o, vixWarning, thesis: o.thesis + ` ${vixWarning.message}` };
        }
        return o;
      });
    }

    filteredOpps.sort((a, b) => {
      if (a.insiderActivity?.confirmed && !b.insiderActivity?.confirmed) return -1;
      if (!a.insiderActivity?.confirmed && b.insiderActivity?.confirmed) return 1;
      if (b.confidence !== a.confidence) return b.confidence - a.confidence;
      return new Date(b.timestamp) - new Date(a.timestamp);
    });

    const mf = getMarketFlow();
    return NextResponse.json({
      opportunities: filteredOpps,
      trackedTrades: getTrackedTrades().filter(t => t.status !== 'EXPIRED'),
      marketFlow: { sentiment: mf.sentiment, netPremium: mf.formatted, bullish: mf.netPremium > 0 },
      marketQuotes,
      vixWarning,
      vixLevel,
      scannedAt: new Date().toISOString(),
      tickersScanned: WATCHLIST.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Scan error:', error);
    return NextResponse.json({ error: 'Scan failed', message: error.message }, { status: 500 });
  }
}
