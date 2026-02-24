import { NextRequest, NextResponse } from 'next/server';
import { TTLCache } from '@/lib/cache';
import Anthropic from '@anthropic-ai/sdk';

export const runtime = 'nodejs';

const cache = new TTLCache<any>();
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

const FINNHUB_KEY = process.env.FINNHUB_API_KEY;

// ── Types ──────────────────────────────────────────────────────────────────────

export interface MarketEvent {
  date: string;        // 'YYYY-MM-DD'
  label: string;
  type: 'opex' | 'quarterly_opex' | 'economic' | 'earnings';
  impact: 'high' | 'medium' | 'low';
  detail?: string;     // e.g. "8:30am ET"
}

export interface NewsItem {
  ticker: string;
  headline: string;
  source: string;
  url: string;
  datetime: number;    // Unix timestamp (seconds)
  summary: string;
}

// ── OpEx calendar (computed) ───────────────────────────────────────────────────

function getUpcomingOpEx(daysAhead: number): MarketEvent[] {
  const today = new Date();
  const cutoff = new Date(Date.now() + daysAhead * 86_400_000);
  const results: MarketEvent[] = [];

  for (let m = 0; m < 4; m++) {
    const probe = new Date(today.getFullYear(), today.getMonth() + m, 1);
    const year = probe.getFullYear();
    const month = probe.getMonth();

    // 3rd Friday: start at day 1, advance to first Friday, then +14 days
    const firstOfMonth = new Date(year, month, 1);
    const dow = firstOfMonth.getDay(); // 0=Sun … 6=Sat
    const daysToFirstFriday = (5 - dow + 7) % 7;
    const thirdFriday = new Date(year, month, 1 + daysToFirstFriday + 14);

    if (thirdFriday < today || thirdFriday > cutoff) continue;

    const dateStr = thirdFriday.toISOString().slice(0, 10);
    const isQuarterly = [2, 5, 8, 11].includes(month); // Mar Jun Sep Dec

    results.push({
      date: dateStr,
      label: isQuarterly ? 'Quarterly OpEx (Triple Witching)' : 'Monthly OpEx',
      type: isQuarterly ? 'quarterly_opex' : 'opex',
      impact: isQuarterly ? 'high' : 'medium',
    });
  }
  return results;
}

// ── Finnhub: company news ──────────────────────────────────────────────────────

async function fetchCompanyNews(ticker: string): Promise<NewsItem[]> {
  if (!FINNHUB_KEY) return [];
  const to = new Date().toISOString().slice(0, 10);
  const from = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);

  try {
    const res = await fetch(
      `https://finnhub.io/api/v1/company-news?symbol=${ticker}&from=${from}&to=${to}&token=${FINNHUB_KEY}`,
      { signal: AbortSignal.timeout(5000) },
    );
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];

    return data.slice(0, 5).map((n: any) => ({
      ticker,
      headline: n.headline ?? '',
      source: n.source ?? '',
      url: n.url ?? '',
      datetime: n.datetime ?? 0,
      summary: (n.summary ?? '').slice(0, 200),
    }));
  } catch {
    return [];
  }
}

// ── Finnhub: economic calendar ─────────────────────────────────────────────────

async function fetchEconomicCalendar(): Promise<MarketEvent[]> {
  if (!FINNHUB_KEY) return [];
  const from = new Date().toISOString().slice(0, 10);
  const to = new Date(Date.now() + 45 * 86_400_000).toISOString().slice(0, 10);

  try {
    const res = await fetch(
      `https://finnhub.io/api/v1/calendar/economic?from=${from}&to=${to}&token=${FINNHUB_KEY}`,
      { signal: AbortSignal.timeout(5000) },
    );
    if (!res.ok) return [];
    const data = await res.json();
    const events: any[] = data.economicCalendar ?? [];

    return events
      .filter((e: any) => e.country === 'US' && e.impact === 'high')
      .map((e: any) => ({
        date: (e.time ?? '').slice(0, 10),
        label: e.event ?? 'Economic Event',
        type: 'economic' as const,
        impact: 'high' as const,
        detail: e.time ? e.time.slice(11, 16) + ' UTC' : undefined,
      }))
      .filter(e => e.date.length === 10);
  } catch {
    return [];
  }
}

// ── Claude Haiku: market insight ───────────────────────────────────────────────

async function generateInsight(
  flowSummary: string,
  events: MarketEvent[],
  topNews: NewsItem[],
): Promise<string | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const eventLines = events
      .slice(0, 8)
      .map(e => `${e.date}: ${e.label}`)
      .join('\n');

    const newsLines = topNews
      .slice(0, 8)
      .map(n => `[${n.ticker}] ${n.headline}`)
      .join('\n');

    const prompt = `You are a professional options flow analyst. In 2-3 sentences, explain what institutional traders are likely positioning for based on the signals below. Be specific about dates and catalysts. No bullet points. Under 130 words.

ACTIVE OPTIONS FLOW:
${flowSummary || 'No flow data provided'}

UPCOMING MARKET EVENTS (next 45 days):
${eventLines || 'No events data'}

RECENT NEWS:
${newsLines || 'No recent news'}`;

    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 180,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = msg.content[0];
    return content.type === 'text' ? content.text.trim() : null;
  } catch {
    return null;
  }
}

// ── Main handler ───────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const tickersParam = url.searchParams.get('tickers') ?? 'SPY,QQQ,NVDA,TSLA,AAPL,AMD,MSFT,META,AMZN,GOOGL';
  const flowSummary = url.searchParams.get('flowSummary') ?? '';
  const force = url.searchParams.has('force');

  const cacheKey = `news-feed-${tickersParam}`;
  const cached = cache.get(cacheKey);
  if (cached && !force) return NextResponse.json(cached);

  const tickers = tickersParam.split(',').map(t => t.trim()).slice(0, 8);

  // Parallel: company news for all tickers + economic calendar
  const [economicRaw, ...newsArrays] = await Promise.all([
    fetchEconomicCalendar(),
    ...tickers.map(t => fetchCompanyNews(t)),
  ]);

  // Merge and sort all events
  const opExEvents = getUpcomingOpEx(45);
  const allEvents: MarketEvent[] = [
    ...opExEvents,
    ...economicRaw,
  ]
    .filter(e => e.date >= new Date().toISOString().slice(0, 10))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Flatten news, sort by recency
  const allNews: NewsItem[] = (newsArrays as NewsItem[][])
    .flat()
    .sort((a, b) => b.datetime - a.datetime)
    .slice(0, 40);

  // Top 2 headlines per ticker for AI context
  const topNews = tickers.flatMap(t => allNews.filter(n => n.ticker === t).slice(0, 2));

  // Generate AI insight
  const insight = await generateInsight(flowSummary, allEvents, topNews);

  const response = {
    events: allEvents,
    newsItems: allNews,
    insight,
    generatedAt: new Date().toISOString(),
    tickers,
  };

  cache.set(cacheKey, response, CACHE_TTL);
  return NextResponse.json(response);
}
