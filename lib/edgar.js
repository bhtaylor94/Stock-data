// lib/edgar.js
// SEC EDGAR + Congressional trading data
// All free, public data — no API keys needed (just a user-agent identity)

const EDGAR_BASE = 'https://efts.sec.gov/LATEST';
const EDGAR_DATA = 'https://data.sec.gov';
const IDENTITY = process.env.EDGAR_IDENTITY || 'FlowHunter app@flowhunter.dev';

const HEADERS = {
  'User-Agent': IDENTITY,
  'Accept': 'application/json',
};

// Ticker → CIK mapping cache
let cikCache = {};

// ── Get CIK for a ticker ──
async function getCIK(ticker) {
  if (cikCache[ticker]) return cikCache[ticker];

  try {
    const res = await fetch(`${EDGAR_BASE}/search-index?q=${ticker}&dateRange=custom&startdt=2024-01-01&forms=4`, {
      headers: HEADERS,
    });
    if (!res.ok) return null;
    const data = await res.json();

    // Try company tickers endpoint instead (more reliable)
    const tickerRes = await fetch('https://www.sec.gov/files/company_tickers.json', {
      headers: HEADERS,
    });
    if (tickerRes.ok) {
      const tickers = await tickerRes.json();
      const entry = Object.values(tickers).find(
        t => t.ticker?.toUpperCase() === ticker.toUpperCase()
      );
      if (entry) {
        const cik = String(entry.cik_str).padStart(10, '0');
        cikCache[ticker] = cik;
        return cik;
      }
    }

    return null;
  } catch (err) {
    console.error(`EDGAR CIK lookup failed for ${ticker}:`, err.message);
    return null;
  }
}

// ── Get recent Form 4 insider trades for a ticker ──
export async function getInsiderTrades(ticker, daysBack = 90) {
  try {
    const cik = await getCIK(ticker);
    if (!cik) return [];

    // Fetch recent Form 4 filings
    const res = await fetch(
      `${EDGAR_DATA}/submissions/CIK${cik}.json`,
      { headers: HEADERS }
    );
    if (!res.ok) return [];

    const data = await res.json();
    const recent = data.filings?.recent;
    if (!recent) return [];

    const cutoff = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);
    const trades = [];

    for (let i = 0; i < (recent.form?.length || 0); i++) {
      if (recent.form[i] !== '4') continue;

      const filingDate = new Date(recent.filingDate[i]);
      if (filingDate < cutoff) continue;

      trades.push({
        type: 'INSIDER',
        name: recent.reportOwner?.[i] || 'Corporate Insider',
        title: '',
        action: 'FILED', // Form 4 = insider transaction
        date: recent.filingDate[i],
        daysAgo: Math.ceil((Date.now() - filingDate.getTime()) / (1000 * 60 * 60 * 24)),
        accessionNumber: recent.accessionNumber[i],
        url: `https://www.sec.gov/Archives/edgar/data/${cik.replace(/^0+/, '')}/${recent.accessionNumber[i].replace(/-/g, '')}`,
      });
    }

    return trades.slice(0, 10); // max 10 recent
  } catch (err) {
    console.error(`EDGAR insider fetch failed for ${ticker}:`, err.message);
    return [];
  }
}

// ── Congressional trades via Quiver Quantitative (free tier) ──
// Quiver provides free congressional trading data
const QUIVER_BASE = 'https://api.quiverquant.com/beta';

export async function getCongressTrades(ticker, daysBack = 90) {
  try {
    // Quiver free API — congressional trading
    const res = await fetch(
      `${QUIVER_BASE}/historical/congresstrading/${ticker}`,
      {
        headers: {
          'Accept': 'application/json',
          // Quiver free tier doesn't require auth for basic congressional data
        },
      }
    );

    if (!res.ok) {
      // Fallback: try alternative free source
      return await getCongressTradesFallback(ticker, daysBack);
    }

    const data = await res.json();
    if (!Array.isArray(data)) return [];

    const cutoff = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);

    return data
      .filter(t => new Date(t.Date || t.TransactionDate) > cutoff)
      .map(t => ({
        type: 'CONGRESS',
        name: t.Representative || t.Senator || 'Unknown Member',
        committee: t.House === 'Senate' ? 'Senate' : 'House',
        action: (t.Transaction || '').toLowerCase().includes('purchase') ? 'BUY' : 'SELL',
        amount: t.Range || t.Amount || 'Unknown',
        date: t.Date || t.TransactionDate,
        daysAgo: Math.ceil((Date.now() - new Date(t.Date || t.TransactionDate).getTime()) / (1000 * 60 * 60 * 24)),
      }))
      .slice(0, 10);
  } catch (err) {
    console.error(`Congress trades fetch failed for ${ticker}:`, err.message);
    return [];
  }
}

// Fallback: scrape from House/Senate disclosure sites or use Capitol Trades
async function getCongressTradesFallback(ticker, daysBack) {
  try {
    // Capitol Trades free API
    const res = await fetch(
      `https://www.capitoltrades.com/api/trades?ticker=${ticker}&page=1&pageSize=10`,
      { headers: { 'Accept': 'application/json' } }
    );

    if (!res.ok) return [];

    const data = await res.json();
    if (!data.data || !Array.isArray(data.data)) return [];

    const cutoff = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);

    return data.data
      .filter(t => new Date(t.txDate) > cutoff)
      .map(t => ({
        type: 'CONGRESS',
        name: `${t.firstName || ''} ${t.lastName || ''}`.trim() || 'Unknown',
        committee: t.chamber || '',
        action: t.txType === 'purchase' ? 'BUY' : 'SELL',
        amount: t.amount || 'Unknown',
        date: t.txDate,
        daysAgo: Math.ceil((Date.now() - new Date(t.txDate).getTime()) / (1000 * 60 * 60 * 24)),
      }))
      .slice(0, 10);
  } catch {
    return [];
  }
}

// ── Master function: get all insider + congressional activity for a ticker ──
export async function getInsiderActivity(ticker, direction) {
  const [insiderTrades, congressTrades] = await Promise.allSettled([
    getInsiderTrades(ticker, 90),
    getCongressTrades(ticker, 90),
  ]);

  const insiders = insiderTrades.status === 'fulfilled' ? insiderTrades.value : [];
  const congress = congressTrades.status === 'fulfilled' ? congressTrades.value : [];

  const allEntries = [...insiders, ...congress];
  if (allEntries.length === 0) {
    return {
      confirmed: false,
      conflictWarning: false,
      entries: [],
      description: '',
    };
  }

  // Check for buys aligned with direction
  const buys = allEntries.filter(e => e.action === 'BUY');
  const sells = allEntries.filter(e => e.action === 'SELL');
  const recentBuys = buys.filter(e => e.daysAgo <= 45);
  const recentSells = sells.filter(e => e.daysAgo <= 45);

  // Congressional cluster buying (2+ members buying same stock)
  const congressBuys = congress.filter(e => e.action === 'BUY' && e.daysAgo <= 60);
  const clusterBuying = congressBuys.length >= 2;

  // Determine confirmation
  let confirmed = false;
  let conflictWarning = false;

  if (direction === 'BULLISH') {
    confirmed = recentBuys.length > 0 || clusterBuying;
    conflictWarning = recentSells.length > recentBuys.length && recentSells.length >= 2;
  } else {
    // For bearish: insider/congress selling confirms
    confirmed = recentSells.length >= 2;
    conflictWarning = recentBuys.length > recentSells.length && recentBuys.length >= 2;
  }

  // Build description
  let description = '';
  if (confirmed && !conflictWarning) {
    const names = recentBuys.slice(0, 2).map(e =>
      e.type === 'CONGRESS'
        ? `${e.name} (${e.committee})`
        : e.name
    );
    if (direction === 'BULLISH') {
      description = `${names.join(' and ')} ${recentBuys.length === 1 ? 'has' : 'have'} been buying in the last ${recentBuys[0]?.daysAgo || 30} days. Smart money at multiple levels is positioning bullish.`;
    } else {
      const sellNames = recentSells.slice(0, 2).map(e => e.name);
      description = `Insider selling detected: ${sellNames.join(', ')}. This aligns with the bearish flow.`;
    }
  } else if (conflictWarning) {
    if (direction === 'BULLISH') {
      description = `⚠ Caution: Insider/congressional selling detected (${recentSells.length} transactions) while flow is bullish. Insiders may know something.`;
    } else {
      description = `⚠ Caution: Insider/congressional buying detected (${recentBuys.length} transactions) while flow is bearish. Insiders may be accumulating.`;
    }
  }

  return {
    confirmed,
    conflictWarning,
    entries: allEntries.slice(0, 5),
    description,
  };
}
