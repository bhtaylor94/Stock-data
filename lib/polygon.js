// lib/polygon.js
// Polygon.io API — ticker details, previous close

const BASE = 'https://api.polygon.io';

async function polygonFetch(endpoint) {
  const key = process.env.POLYGON_API_KEY;
  if (!key) throw new Error('Missing POLYGON_API_KEY');

  const url = `${BASE}${endpoint}${endpoint.includes('?') ? '&' : '?'}apiKey=${key}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  return res.json();
}

// Ticker details — market cap, description
export async function getTickerDetails(ticker) {
  return polygonFetch(`/v3/reference/tickers/${ticker}`);
}

// Previous day close + volume
export async function getPreviousClose(ticker) {
  return polygonFetch(`/v2/aggs/ticker/${ticker}/prev`);
}
