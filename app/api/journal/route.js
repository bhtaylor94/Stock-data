// app/api/journal/route.js
// Trade journal — manual entry of trades and daily P/L
// Uses in-memory storage (for production, use Vercel KV or a database)

import { NextResponse } from 'next/server';

// In-memory store (resets on cold start — see note below)
// For persistence across deploys, you'd use Vercel KV:
//   import { kv } from '@vercel/kv';
//   const entries = await kv.get('journal_entries') || [];
let journalEntries = [];
let dailyPL = {}; // { '2026-03-18': { pl: 245.50, notes: 'NVDA call +$245' } }

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || 'all';
  const month = searchParams.get('month'); // '2026-03' format

  if (type === 'calendar') {
    // Return P/L calendar data for a month
    let filtered = dailyPL;
    if (month) {
      filtered = {};
      Object.entries(dailyPL).forEach(([date, data]) => {
        if (date.startsWith(month)) filtered[date] = data;
      });
    }
    return NextResponse.json({ calendar: filtered });
  }

  if (type === 'stats') {
    // Return aggregate stats
    const entries = Object.values(dailyPL);
    const totalPL = entries.reduce((sum, d) => sum + d.pl, 0);
    const winDays = entries.filter(d => d.pl > 0).length;
    const lossDays = entries.filter(d => d.pl < 0).length;
    const bestDay = entries.length > 0 ? Math.max(...entries.map(d => d.pl)) : 0;
    const worstDay = entries.length > 0 ? Math.min(...entries.map(d => d.pl)) : 0;
    const avgWin = winDays > 0 ? entries.filter(d => d.pl > 0).reduce((s, d) => s + d.pl, 0) / winDays : 0;
    const avgLoss = lossDays > 0 ? entries.filter(d => d.pl < 0).reduce((s, d) => s + d.pl, 0) / lossDays : 0;

    return NextResponse.json({
      stats: {
        totalPL: Math.round(totalPL * 100) / 100,
        winDays,
        lossDays,
        winRate: winDays + lossDays > 0 ? Math.round((winDays / (winDays + lossDays)) * 100) : 0,
        bestDay: Math.round(bestDay * 100) / 100,
        worstDay: Math.round(worstDay * 100) / 100,
        avgWin: Math.round(avgWin * 100) / 100,
        avgLoss: Math.round(avgLoss * 100) / 100,
        totalDays: winDays + lossDays,
      },
    });
  }

  // Return all journal entries
  return NextResponse.json({
    entries: journalEntries.sort((a, b) => new Date(b.date) - new Date(a.date)),
    calendar: dailyPL,
  });
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'add_trade') {
      // Add a trade entry
      const entry = {
        id: `trade-${Date.now()}`,
        date: body.date || new Date().toISOString().split('T')[0],
        ticker: body.ticker?.toUpperCase(),
        type: body.type || 'CALL', // CALL or PUT
        strike: body.strike,
        expiration: body.expiration,
        action: body.tradeAction || 'BUY', // BUY or SELL (to close)
        quantity: body.quantity || 1,
        price: body.price,
        totalCost: (body.price || 0) * (body.quantity || 1) * 100,
        notes: body.notes || '',
        createdAt: new Date().toISOString(),
      };

      journalEntries.push(entry);
      return NextResponse.json({ success: true, entry });
    }

    if (action === 'log_daily_pl') {
      // Log daily P/L for the calendar
      const date = body.date || new Date().toISOString().split('T')[0];
      const pl = parseFloat(body.pl);

      if (isNaN(pl)) {
        return NextResponse.json({ error: 'Invalid P/L amount' }, { status: 400 });
      }

      dailyPL[date] = {
        pl,
        notes: body.notes || '',
        trades: body.trades || [],
        updatedAt: new Date().toISOString(),
      };

      return NextResponse.json({ success: true, date, pl });
    }

    if (action === 'update_daily_pl') {
      const date = body.date;
      if (!date || !dailyPL[date]) {
        return NextResponse.json({ error: 'Date not found' }, { status: 404 });
      }
      if (body.pl !== undefined) dailyPL[date].pl = parseFloat(body.pl);
      if (body.notes !== undefined) dailyPL[date].notes = body.notes;
      dailyPL[date].updatedAt = new Date().toISOString();

      return NextResponse.json({ success: true, date, data: dailyPL[date] });
    }

    if (action === 'delete_daily_pl') {
      const date = body.date;
      if (date && dailyPL[date]) {
        delete dailyPL[date];
        return NextResponse.json({ success: true });
      }
      return NextResponse.json({ error: 'Date not found' }, { status: 404 });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
