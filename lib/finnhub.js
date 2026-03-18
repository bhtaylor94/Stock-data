// lib/finnhub.js
// Finnhub API — fundamentals, news, earnings, analyst recommendations

const BASE = 'https://finnhub.io/api/v1';

async function finnhubFetch(endpoint, params = {}) {
  const key = process.env.FINNHUB_API_KEY;
  if (!key) throw new Error('Missing FINNHUB_API_KEY');

  const url = new URL(`${BASE}${endpoint}`);
  url.searchParams.set('token', key);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  });

  const res = await fetch(url.toString());
  if (!res.ok) return null;
  return res.json();
}

// Real-time quote
export async function getQuote(ticker) {
  return finnhubFetch('/quote', { symbol: ticker });
}

// Company profile
export async function getProfile(ticker) {
  return finnhubFetch('/stock/profile2', { symbol: ticker });
}

// Key metrics — P/E, ROE, margins, beta, 52-week range
export async function getMetrics(ticker) {
  return finnhubFetch('/stock/metric', { symbol: ticker, metric: 'all' });
}

// Company news — last N days
export async function getNews(ticker, days = 7) {
  const to = new Date().toISOString().split('T')[0];
  const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    .toISOString().split('T')[0];
  return finnhubFetch('/company-news', { symbol: ticker, from, to });
}

// Upcoming earnings
export async function getEarnings(ticker) {
  const from = new Date().toISOString().split('T')[0];
  const to = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000)
    .toISOString().split('T')[0];
  return finnhubFetch('/calendar/earnings', { symbol: ticker, from, to });
}

// Analyst recommendations
export async function getRecommendations(ticker) {
  return finnhubFetch('/stock/recommendation', { symbol: ticker });
}

// News sentiment
export async function getSentiment(ticker) {
  return finnhubFetch('/news-sentiment', { symbol: ticker });
}
