import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const FINNHUB_KEY = process.env.FINNHUB_API_KEY;

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const ticker = url.searchParams.get('ticker')?.toUpperCase();

  if (!FINNHUB_KEY) {
    return NextResponse.json({ earnings: [], error: 'FINNHUB_API_KEY not set' });
  }

  try {
    const now = new Date();
    const from = now.toISOString().split('T')[0];
    const to = new Date(now.getTime() + 35 * 24 * 3600 * 1000).toISOString().split('T')[0];

    const calUrl = ticker
      ? `https://finnhub.io/api/v1/calendar/earnings?symbol=${ticker}&from=${from}&to=${to}&token=${FINNHUB_KEY}`
      : `https://finnhub.io/api/v1/calendar/earnings?from=${from}&to=${to}&token=${FINNHUB_KEY}`;

    const res = await fetch(calUrl, { next: { revalidate: 3600 } });
    if (!res.ok) {
      return NextResponse.json({ earnings: [], error: `Finnhub ${res.status}` });
    }

    const data = await res.json();
    const earnings = (data.earningsCalendar ?? [])
      .filter((e: any) => e.symbol && e.date)
      .map((e: any) => ({
        ticker: e.symbol,
        date: e.date,          // "YYYY-MM-DD"
        quarter: e.quarter,
        year: e.year,
        hour: e.hour,          // "bmo" | "amc" | "dmh"
        epsEstimate: e.epsEstimate ?? null,
        revenueEstimate: e.revenueEstimate ?? null,
      }))
      .slice(0, ticker ? 5 : 40);

    return NextResponse.json({ earnings });
  } catch (err: any) {
    return NextResponse.json({ earnings: [], error: err.message });
  }
}
