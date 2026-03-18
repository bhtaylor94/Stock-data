// lib/tracker.js
// Post-Alert Tracking System
// Once a card is "activated" by the user, we track the specific
// strike/expiration daily to see if whales are still holding.

// In-memory store (in production, use a database or KV store like Vercel KV)
// For Vercel serverless, this resets on cold starts — consider using
// Vercel KV or a simple JSON file in a connected database
let trackedTrades = {};

export function getTrackedTrades() {
  return Object.values(trackedTrades).sort(
    (a, b) => new Date(b.activatedAt) - new Date(a.activatedAt)
  );
}

export function activateTrade(card) {
  const id = card.id;
  const primaryLeg = card.suggestedPlay.legs[0];

  trackedTrades[id] = {
    id,
    ticker: card.ticker,
    direction: card.direction,
    strategy: card.suggestedPlay.strategy,
    legs: card.suggestedPlay.legs,
    activatedAt: new Date().toISOString(),
    thesis: card.thesis,
    confidence: card.confidence,

    // Tracking state
    status: 'ACTIVE',
    alertOI: primaryLeg._alertOI || 0, // set from chain data at activation
    currentOI: primaryLeg._alertOI || 0,
    oiChange: 0,
    alertPrice: primaryLeg.price,
    currentPrice: primaryLeg.price,
    plPercent: 0,
    daysSinceAlert: 0,
    conflictingFlow: false,
    statusDescription: 'Trade just activated — tracking begins.',
    history: [{
      date: new Date().toISOString().split('T')[0],
      oi: primaryLeg._alertOI || 0,
      price: primaryLeg.price,
    }],
  };

  return trackedTrades[id];
}

export function deactivateTrade(id) {
  if (trackedTrades[id]) {
    trackedTrades[id].status = 'EXPIRED';
    trackedTrades[id].statusDescription = 'Trade manually closed.';
  }
}

// Called daily (or on each scan) to update tracked trades
export function updateTrackedTrade(id, currentOI, currentPrice, conflictingFlow = false) {
  const trade = trackedTrades[id];
  if (!trade || trade.status === 'EXPIRED') return null;

  trade.currentOI = currentOI;
  trade.currentPrice = currentPrice;
  trade.conflictingFlow = conflictingFlow;
  trade.daysSinceAlert = Math.ceil(
    (Date.now() - new Date(trade.activatedAt).getTime()) / (1000 * 60 * 60 * 24)
  );

  // OI change percentage
  if (trade.alertOI > 0) {
    trade.oiChange = Math.round(((currentOI - trade.alertOI) / trade.alertOI) * 100);
  }

  // P/L percentage
  if (trade.alertPrice > 0) {
    trade.plPercent = Math.round(((currentPrice - trade.alertPrice) / trade.alertPrice) * 1000) / 10;
  }

  // Determine status
  if (trade.oiChange > 20) {
    trade.status = 'ACCUMULATING';
    trade.statusDescription = `Whales are adding to this position — OI up ${trade.oiChange}% since alert.`;
  } else if (trade.oiChange >= -10) {
    trade.status = 'HOLDING';
    trade.statusDescription = 'Position still open — whales are holding.';
  } else if (trade.oiChange > -50) {
    trade.status = 'PARTIAL_EXIT';
    trade.statusDescription = `Some profit-taking detected — OI down ${Math.abs(trade.oiChange)}% since alert. Consider tightening your stop.`;
  } else {
    trade.status = 'EXITING';
    trade.statusDescription = `Warning: Whales appear to be closing this position. OI down ${Math.abs(trade.oiChange)}% since alert.`;
  }

  // Override with conflict warning
  if (conflictingFlow) {
    trade.statusDescription += ' ⚠ Conflicting flow detected — new opposite-direction activity on this ticker.';
  }

  // Add to history (one entry per day)
  const today = new Date().toISOString().split('T')[0];
  const lastEntry = trade.history[trade.history.length - 1];
  if (!lastEntry || lastEntry.date !== today) {
    trade.history.push({ date: today, oi: currentOI, price: currentPrice });
  } else {
    lastEntry.oi = currentOI;
    lastEntry.price = currentPrice;
  }

  // Auto-expire if OI dropped >80%
  if (trade.oiChange < -80) {
    trade.status = 'EXPIRED';
    trade.statusDescription = 'Whales have fully exited — OI collapsed. Trade concluded.';
  }

  return trade;
}

// Check expiration — remove trades past their expiration date
export function cleanupExpiredTrades() {
  const now = new Date();
  Object.entries(trackedTrades).forEach(([id, trade]) => {
    const expDate = trade.legs[0]?.expiration;
    if (expDate && new Date(expDate) < now) {
      trade.status = 'EXPIRED';
      trade.statusDescription = 'Option has expired.';
    }
  });
}
