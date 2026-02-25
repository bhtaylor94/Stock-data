import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 503 });
    }
    const client = new Anthropic();
    const body = await req.json();
    const { ticker, price, changePercent, analysis, optionsSetups, unusualActivity, technicals, ivContext } = body;

    if (!ticker) return NextResponse.json({ error: 'ticker required' }, { status: 400 });

    const score = analysis?.combined?.score ?? 0;
    const maxScore = analysis?.combined?.maxScore ?? 24;
    const rating = analysis?.combined?.rating ?? 'HOLD';
    const rsi = technicals?.rsi ?? analysis?.technical?.indicators?.rsi ?? 0;
    const trend = technicals?.trend ?? analysis?.technical?.trend ?? 'SIDEWAYS';
    const topSetup = optionsSetups?.[0];
    const topUOA = unusualActivity?.[0];
    const pctStr = changePercent != null
      ? `${changePercent >= 0 ? '+' : ''}${Number(changePercent).toFixed(2)}%`
      : 'N/A';

    const prompt = `You are a professional options trader writing a concise trade brief for an institutional desk. Analyze this data and write exactly 3-4 sentences. Be specific with numbers, direct, and focus on the actionable signal. No bullet points. No headers.

TICKER: ${ticker} @ $${Number(price).toFixed(2)} (${pctStr})
ANALYSIS SCORE: ${score}/${maxScore} — ${rating}
TECHNICALS: RSI ${rsi}, trend ${trend}
IV ENVIRONMENT: ${ivContext ?? 'N/A'}
TOP SETUP: ${topSetup ? `${topSetup.name} (confluence ${topSetup.confluenceScore}/100, ${topSetup.sentiment})` : 'No named setup detected'}
TOP OPTIONS FLOW: ${topUOA ? `${topUOA.alertType ?? 'UOA'} — $${topUOA.strike} ${topUOA.type?.toUpperCase() ?? ''}, UOA score ${topUOA.uoaScore ?? topUOA.score ?? 0}/100, ${topUOA.metrics?.premium != null ? `$${(topUOA.metrics.premium / 1e3).toFixed(0)}K premium` : 'N/A'}` : 'No unusual activity detected'}

Write the trade brief now. Sentence 1: price action and key technical setup. Sentence 2: smart money/options flow signal. Sentence 3: IV environment and risk context. Sentence 4 (optional): specific recommended trade structure.`;

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 280,
      messages: [{ role: 'user', content: prompt }],
    });

    const narrative = (message.content[0] as { type: string; text: string }).text ?? '';

    return NextResponse.json({
      narrative,
      ticker,
      generatedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('Narrative error:', err);
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500 });
  }
}
