// lib/schwab.js
// Schwab API — OAuth auth (preserved from original app) + data fetching
// Chain data is normalized from Schwab's strike-keyed format to flat arrays

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

async function schwabFetch(endpoint, params = {}) {
  const token = await getAccessToken();
  if (!token) throw new Error('Schwab auth failed');

  const url = new URL(`https://api.schwabapi.com${endpoint}`);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  });

  const res = await fetch(url.toString(), {
    headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' },
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Schwab API ${res.status}: ${errText.substring(0, 200)}`);
  }

  return res.json();
}

// ── Normalize Schwab chain structure ──
// Schwab returns: { "2026-04-01:14": { "655.0": [{contract}], "660.0": [{contract}] } }
// We normalize to: { "2026-04-01:14": [{contract}, {contract}, ...] }
function normalizeExpDateMap(expDateMap) {
  if (!expDateMap) return {};
  const normalized = {};

  Object.entries(expDateMap).forEach(([expKey, strikeMap]) => {
    const contracts = [];

    if (Array.isArray(strikeMap)) {
      // Already a flat array (unlikely but handle it)
      contracts.push(...strikeMap);
    } else if (typeof strikeMap === 'object' && strikeMap !== null) {
      // Object keyed by strike price: { "655.0": [{...}], "660.0": [{...}] }
      Object.values(strikeMap).forEach(contractArr => {
        if (Array.isArray(contractArr)) {
          contracts.push(...contractArr);
        } else if (contractArr && typeof contractArr === 'object') {
          contracts.push(contractArr);
        }
      });
    }

    normalized[expKey] = contracts;
  });

  return normalized;
}

// ── Fetch options chain (normalized) ──
export async function getOptionsChain(ticker) {
  const fromDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
    .toISOString().split('T')[0];
  const toDate = new Date(Date.now() + 730 * 24 * 60 * 60 * 1000)
    .toISOString().split('T')[0];

  const raw = await schwabFetch('/marketdata/v1/chains', {
    symbol: ticker,
    contractType: 'ALL',
    includeUnderlyingQuote: 'true',
    fromDate,
    toDate,
  });

  if (!raw) return null;

  return {
    ...raw,
    callExpDateMap: normalizeExpDateMap(raw.callExpDateMap),
    putExpDateMap: normalizeExpDateMap(raw.putExpDateMap),
  };
}

// ── Fetch quotes ──
export async function getQuote(ticker) {
  const data = await schwabFetch('/marketdata/v1/quotes', {
    symbols: ticker,
    fields: 'quote',
  });
  return data?.[ticker] || data;
}

export async function getQuotes(tickers) {
  return schwabFetch('/marketdata/v1/quotes', {
    symbols: tickers.join(','),
    fields: 'quote',
  });
}

// ── Fetch price history ──
export async function getPriceHistory(ticker, periodType = 'year', period = 1, frequencyType = 'daily', frequency = 1) {
  return schwabFetch('/marketdata/v1/pricehistory', {
    symbol: ticker,
    periodType,
    period: String(period),
    frequencyType,
    frequency: String(frequency),
  });
}

// ── Fetch movers ──
export async function getMovers(index = '$SPX') {
  return schwabFetch(`/marketdata/v1/movers/${index}`, {
    sort: 'VOLUME',
    frequency: 0,
  });
}
