// lib/schwab.js
// Schwab API authentication and data fetching
// Auth logic preserved from original app — OAuth with token refresh caching

let cachedAccessToken = null;
let tokenExpiry = 0;

export async function getAccessToken() {
  const appKey = process.env.SCHWAB_APP_KEY;
  const appSecret = process.env.SCHWAB_APP_SECRET;
  const refreshToken = process.env.SCHWAB_REFRESH_TOKEN;

  if (!appKey || !appSecret || !refreshToken) {
    console.error('Missing Schwab credentials');
    return null;
  }

  // Return cached token if still valid (with 1 min buffer)
  if (cachedAccessToken && Date.now() < tokenExpiry - 60000) {
    return cachedAccessToken;
  }

  try {
    const credentials = Buffer.from(`${appKey}:${appSecret}`).toString('base64');

    const response = await fetch('https://api.schwabapi.com/v1/oauth/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        'grant_type': 'refresh_token',
        'refresh_token': refreshToken,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Token refresh failed:', response.status, errorText);
      return null;
    }

    const data = await response.json();
    cachedAccessToken = data.access_token;
    tokenExpiry = Date.now() + (data.expires_in * 1000);

    return cachedAccessToken;
  } catch (error) {
    console.error('Error refreshing Schwab token:', error);
    return null;
  }
}

// Helper to make authenticated Schwab API calls
async function schwabFetch(endpoint, params = {}) {
  const token = await getAccessToken();
  if (!token) throw new Error('Schwab auth failed');

  const url = new URL(`https://api.schwabapi.com${endpoint}`);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null) url.searchParams.set(k, v);
  });

  const res = await fetch(url.toString(), {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
    },
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Schwab API ${res.status}: ${errText}`);
  }

  return res.json();
}

// Fetch full options chain for a ticker
// Filters to 14-365 DTE as per FlowHunter hard rule
export async function getOptionsChain(ticker) {
  const fromDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
    .toISOString().split('T')[0];
  const toDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
    .toISOString().split('T')[0];

  return schwabFetch('/marketdata/v1/chains', {
    symbol: ticker,
    contractType: 'ALL',
    includeUnderlyingQuote: 'true',
    fromDate,
    toDate,
  });
}

// Fetch real-time quote
export async function getQuote(ticker) {
  return schwabFetch(`/marketdata/v1/quotes/${ticker}`);
}

// Fetch multiple quotes at once
export async function getQuotes(tickers) {
  return schwabFetch('/marketdata/v1/quotes', {
    symbols: tickers.join(','),
  });
}

// Fetch price history for technical analysis
export async function getPriceHistory(ticker, periodType = 'year', period = 1, frequencyType = 'daily', frequency = 1) {
  return schwabFetch('/marketdata/v1/pricehistory', {
    symbol: ticker,
    periodType,
    period: String(period),
    frequencyType,
    frequency: String(frequency),
  });
}

// Fetch movers for an index
export async function getMovers(index = '$SPX') {
  return schwabFetch(`/marketdata/v1/movers/${index}`, {
    sort: 'VOLUME',
    frequency: 0,
  });
}
