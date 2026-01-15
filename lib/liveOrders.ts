import { getSchwabAccessToken, schwabFetchJson } from '@/lib/schwab';

export type PlaceOrderResult = {
  ok: boolean;
  orderId?: string;
  status?: number;
  error?: string;
};

export async function placeMarketEquityOrder(
  symbol: string,
  quantity: number,
  instruction: 'BUY' | 'SELL'
): Promise<PlaceOrderResult> {
  try {
    const sym = String(symbol || '').trim().toUpperCase();
    const qty = Math.max(1, Math.min(10000, Number(quantity || 1)));
    if (!sym) return { ok: false, status: 400, error: 'symbol required' };

    const tokenResult = await getSchwabAccessToken('tracker', { forceRefresh: false });
    if (!tokenResult.token) {
      return { ok: false, status: tokenResult.status || 401, error: tokenResult.error || 'Auth failed' };
    }

    const accountsResult = await schwabFetchJson<any[]>(
      tokenResult.token,
      'https://api.schwabapi.com/trader/v1/accounts/accountNumbers',
      { scope: 'tracker' }
    );

    if (!accountsResult.ok || !accountsResult.data || accountsResult.data.length === 0) {
      return { ok: false, status: 500, error: 'Failed to get account information' };
    }

    const accountHash = accountsResult.data[0].hashValue;

    const orderPayload: any = {
      orderType: 'MARKET',
      session: 'NORMAL',
      duration: 'DAY',
      orderStrategyType: 'SINGLE',
      orderLegCollection: [
        {
          instruction,
          quantity: qty,
          instrument: { symbol: sym, assetType: 'EQUITY' },
        },
      ],
    };

    const orderResponse = await fetch(
      `https://api.schwabapi.com/trader/v1/accounts/${accountHash}/orders`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokenResult.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(orderPayload),
      }
    );

    if (orderResponse.status === 201) {
      const locationHeader = orderResponse.headers.get('location');
      const orderId = locationHeader?.split('/').pop() || 'unknown';
      return { ok: true, orderId };
    }

    const text = await orderResponse.text();
    return { ok: false, status: orderResponse.status, error: text || 'Order failed' };
  } catch (err: any) {
    return { ok: false, status: 500, error: String(err?.message || err) };
  }
}
