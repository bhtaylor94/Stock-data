// lib/netflow.js
// Net Premium Flow Calculator
// Tracks aggregate call vs put premium across all 25 tickers
// Displayed in the bottom bar and factored into thesis generation

let dailyFlow = {
  date: null,
  callPremium: 0,
  putPremium: 0,
  netPremium: 0,
  sentiment: 'NEUTRAL',
  tickerFlows: {},
};

// Calculate net premium flow from a chain scan
export function calculateNetFlow(ticker, chainData) {
  if (!chainData) return;

  const today = new Date().toISOString().split('T')[0];
  if (dailyFlow.date !== today) {
    // Reset for new day
    dailyFlow = {
      date: today,
      callPremium: 0,
      putPremium: 0,
      netPremium: 0,
      sentiment: 'NEUTRAL',
      tickerFlows: {},
    };
  }

  let tickerCallPremium = 0;
  let tickerPutPremium = 0;

  // Sum call premium (volume × mid price × 100)
  if (chainData.callExpDateMap) {
    Object.values(chainData.callExpDateMap).forEach(contracts => {
      if (!Array.isArray(contracts)) return;
      contracts.forEach(c => {
        const vol = c.totalVolume || 0;
        const mid = ((c.bid || 0) + (c.ask || 0)) / 2;
        tickerCallPremium += vol * mid * 100;
      });
    });
  }

  // Sum put premium
  if (chainData.putExpDateMap) {
    Object.values(chainData.putExpDateMap).forEach(contracts => {
      if (!Array.isArray(contracts)) return;
      contracts.forEach(c => {
        const vol = c.totalVolume || 0;
        const mid = ((c.bid || 0) + (c.ask || 0)) / 2;
        tickerPutPremium += vol * mid * 100;
      });
    });
  }

  // Store per-ticker flow
  const prevTicker = dailyFlow.tickerFlows[ticker] || { call: 0, put: 0 };
  dailyFlow.callPremium -= prevTicker.call;
  dailyFlow.putPremium -= prevTicker.put;

  dailyFlow.tickerFlows[ticker] = { call: tickerCallPremium, put: tickerPutPremium };
  dailyFlow.callPremium += tickerCallPremium;
  dailyFlow.putPremium += tickerPutPremium;

  // Recalculate net
  dailyFlow.netPremium = dailyFlow.callPremium - dailyFlow.putPremium;

  // Determine sentiment
  const net = dailyFlow.netPremium;
  if (net > 50000000) dailyFlow.sentiment = 'STRONG_BULLISH';
  else if (net > 10000000) dailyFlow.sentiment = 'BULLISH';
  else if (net > -10000000) dailyFlow.sentiment = 'NEUTRAL';
  else if (net > -50000000) dailyFlow.sentiment = 'BEARISH';
  else dailyFlow.sentiment = 'STRONG_BEARISH';
}

export function getMarketFlow() {
  const net = dailyFlow.netPremium;
  const formatted = Math.abs(net) >= 1000000000
    ? `${(net / 1000000000).toFixed(1)}B`
    : Math.abs(net) >= 1000000
      ? `${(net / 1000000).toFixed(0)}M`
      : `${(net / 1000).toFixed(0)}K`;

  return {
    sentiment: dailyFlow.sentiment,
    netPremium: dailyFlow.netPremium,
    formatted: `${net >= 0 ? '+' : ''}$${formatted}`,
    callPremium: dailyFlow.callPremium,
    putPremium: dailyFlow.putPremium,
    aligned: (direction) => {
      if (direction === 'BULLISH') return ['BULLISH', 'STRONG_BULLISH'].includes(dailyFlow.sentiment);
      if (direction === 'BEARISH') return ['BEARISH', 'STRONG_BEARISH'].includes(dailyFlow.sentiment);
      return true;
    },
    description: (direction) => {
      const aligned = (direction === 'BULLISH' && dailyFlow.netPremium > 0) ||
                      (direction === 'BEARISH' && dailyFlow.netPremium < 0);
      if (dailyFlow.sentiment === 'NEUTRAL') {
        return 'Market flow is neutral today — no strong directional bias across the 25 names.';
      }
      if (aligned) {
        return `Broad market flow supports this direction — net premium is leaning ${dailyFlow.sentiment.toLowerCase().replace('_', ' ')} today.`;
      }
      return `Note: This is a contrarian setup — overall market flow is leaning ${dailyFlow.sentiment.toLowerCase().replace('_', ' ')} today, though individual name flow is strong.`;
    },
  };
}

// Get flow for a specific ticker
export function getTickerFlow(ticker) {
  const flow = dailyFlow.tickerFlows[ticker];
  if (!flow) return null;

  const net = flow.call - flow.put;
  return {
    callPremium: flow.call,
    putPremium: flow.put,
    netPremium: net,
    sentiment: net > 0 ? 'BULLISH' : net < 0 ? 'BEARISH' : 'NEUTRAL',
  };
}
