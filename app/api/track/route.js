// app/api/track/route.js
// Activate or deactivate trade tracking

import { NextResponse } from 'next/server';
import { activateTrade, deactivateTrade, getTrackedTrades } from '@/lib/tracker';

export async function POST(request) {
  try {
    const body = await request.json();
    const { action, card, tradeId } = body;

    if (action === 'activate' && card) {
      const tracked = activateTrade(card);
      return NextResponse.json({ success: true, trade: tracked });
    }

    if (action === 'deactivate' && tradeId) {
      deactivateTrade(tradeId);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    trades: getTrackedTrades(),
  });
}
