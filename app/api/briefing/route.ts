import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getSchwabAccessToken } from '@/lib/schwab';

const SCHWAB_API_BASE = 'https://api.schwabapi.com';
import { TTLCache } from '@/lib/cache';

export const dynamic = 'force-dynamic';

const anthropic = new Anthropic();
const cache = new TTLCache<any>();
const CACHE_TTL = 60 * 60 * 1000; // 60 minutes

async function fetchBriefingData() {
  let spyChange = 0, qqqChange = 0, vixLevel = 20;
  let earningsTickers: string[] = [];

  try {
    const token = await getSchwabAccessToken('stock');
    const symbols = encodeURIComponent('SPY,QQQ,$VIX.X');
    const res = await fetch(
      `${SCHWAB_API_BASE}/marketdata/v1/quotes?symbols=${symbols}&fields=quote`,
      { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(8000) },
    );
    if (res.ok) {
      const data = await res.json();
      spyChange = data?.SPY?.quote?.netPercentChangeInDouble ?? 0;
      qqqChange = data?.QQQ?.quote?.netPercentChangeInDouble ?? 0;
      vixLevel = data?.['$VIX.X']?.quote?.lastPrice ?? 20;
    }
  } catch { /* non-fatal */ }

  try {
    const finnhubKey = process.env.FINNHUB_API_KEY;
    if (finnhubKey) {
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const fmt = (d: Date) => d.toISOString().slice(0, 10);
      const earningsRes = await fetch(
        `https://finnhub.io/api/v1/calendar/earnings?from=${fmt(today)}&to=${fmt(tomorrow)}&token=${finnhubKey}`,
        { signal: AbortSignal.timeout(6000) },
      );
      if (earningsRes.ok) {
        const earningsData = await earningsRes.json();
        earningsTickers = (earningsData?.earningsCalendar ?? [])
          .slice(0, 6)
          .map((e: { symbol: string }) => e.symbol);
      }
    }
  } catch { /* non-fatal */ }

  return { spyChange, qqqChange, vixLevel, earningsTickers };
}

export async function GET() {
  try {
    const cached = cache.get('morning-brief');
    if (cached) return NextResponse.json(cached);

    const { spyChange, qqqChange, vixLevel, earningsTickers } = await fetchBriefingData();
    const vixSentiment = vixLevel > 30 ? 'elevated fear' : vixLevel > 20 ? 'moderate caution' : 'complacency';
    const marketDir = spyChange >= 0 ? 'up' : 'down';

    const prompt = `You are a pre-market AI briefing system for an options trader. Write exactly 4 bullet points:
1. 📊 Market: SPY ${marketDir} ${Math.abs(spyChange).toFixed(2)}%, QQQ ${qqqChange >= 0 ? '+' : ''}${qqqChange.toFixed(2)}%. VIX at ${vixLevel.toFixed(1)} (${vixSentiment}). What does this mean today?
2. ⚠️ Earnings: ${earningsTickers.length > 0 ? `Key reports: ${earningsTickers.join(', ')}. Note IV plays.` : 'No major earnings. Low event risk.'}
3. 🔥 Sectors: Which sectors lead/lag given current conditions and why?
4. 🌊 Flow: What options strategies fit current VIX and market trend?

Each bullet starts with its emoji. Max 35 words per bullet. Be specific and actionable.`;

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 320,
      messages: [{ role: 'user', content: prompt }],
    });

    const brief = (response.content[0] as { type: string; text: string }).text;
    const result = {
      brief,
      generatedAt: new Date().toISOString(),
      marketSnapshot: { spyChange, qqqChange, vixLevel, earningsTickers },
    };

    cache.set('morning-brief', result, CACHE_TTL);
    return NextResponse.json(result);
  } catch (err) {
    console.error('[briefing] Error:', err);
    return NextResponse.json({ error: 'Failed to generate briefing' }, { status: 500 });
  }
}

export async function DELETE() {
  // Force-refresh endpoint
  cache.delete('morning-brief');
  return NextResponse.json({ ok: true });
}
