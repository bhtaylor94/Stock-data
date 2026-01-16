import { getSchwabAccessToken, schwabFetchJson } from '@/lib/schwab';

const TRADER_BASE = 'https://api.schwabapi.com/trader/v1';

function envFlag(name: string): boolean {
  const v = process.env[name];
  return Boolean(v && String(v).trim() && String(v).trim() !== '0' && String(v).trim().toLowerCase() !== 'false');
}

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
      TRADER_BASE + '/accounts/accountNumbers',
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

    // Optional: preview gate before placing a live order.
    if (envFlag('SCHWAB_USE_PREVIEW_ORDER')) {
      const previewUrl = TRADER_BASE + '/accounts/' + encodeURIComponent(accountHash) + '/previewOrder';
      const preview = await schwabFetchJson<any>(
        tokenResult.token,
        previewUrl,
        {
          method: 'POST',
          scope: 'tracker',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(orderPayload),
        }
      );

      if (!preview.ok) {
        return { ok: false, status: preview.status, error: preview.text || preview.error || 'Order preview failed' };
      }

      const status = String((preview.data as any)?.orderStrategy?.status || (preview.data as any)?.status || '').toUpperCase();
      if (status && status.includes('REJECT')) {
        return { ok: false, status: 400, error: JSON.stringify(preview.data) };
      }
    }

    const placeUrl = TRADER_BASE + '/accounts/' + encodeURIComponent(accountHash) + '/orders';
    const orderResponse = await fetch(placeUrl, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + tokenResult.token,
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'application/json',
      },
      body: JSON.stringify(orderPayload),
    });

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
