import { getPrimaryAccountHash, listAccountOrders } from '@/lib/schwabBroker';
import { loadSuggestions, updateSuggestion, TrackedSuggestion } from '@/lib/trackerStore';

export type ReconcileResult = {
  ok: boolean;
  scanned: number;
  matched: number;
  updated: number;
  errors: string[];
};

function norm(x: any): string {
  return String(x ?? '').trim();
}

function extractOrderIdFromSuggestion(t: TrackedSuggestion): string | null {
  const direct = norm((t as any)?.broker?.orderId);
  if (direct) return direct;
  const ep = (t as any)?.evidencePacket;
  const epId = norm(ep?.orderId);
  if (epId) return epId;
  return null;
}

function keyFor(symbol: string, orderId: string): string {
  return [norm(symbol).toUpperCase(), norm(orderId)].join('|');
}

export async function reconcileSchwabOrders(opts?: {
  lookbackDays?: number;
  maxResults?: number;
}): Promise<ReconcileResult> {
  const lookbackDays = Math.max(1, Math.min(30, Number(opts?.lookbackDays ?? 7)));
  const maxResults = Math.max(25, Math.min(2000, Number(opts?.maxResults ?? 200)));

  const errors: string[] = [];
  const suggestions = await loadSuggestions();

  // Only reconcile suggestions that have an orderId
  const candidates = (suggestions || []).filter((t: TrackedSuggestion) => {
    const id = extractOrderIdFromSuggestion(t);
    return Boolean(id);
  });

  let matched = 0;
  let updated = 0;

  try {
    const accountHash = await getPrimaryAccountHash();

    const orders = await listAccountOrders(accountHash, {
      fromEnteredTime: new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000).toISOString(),
      maxResults,
    });

    const byKey = new Map<string, any>();
    for (const o of orders) {
      const id = norm(o?.orderId || o?.orderId?.toString?.());
      const sym = norm(o?.orderLegCollection?.[0]?.instrument?.symbol || o?.symbol || '');
      if (!id || !sym) continue;
      byKey.set(keyFor(sym, id), o);
    }

    for (const t of candidates) {
      const orderId = extractOrderIdFromSuggestion(t);
      if (!orderId) continue;

      const sym = norm((t as any)?.ticker || (t as any)?.symbol || '');
      const o = byKey.get(keyFor(sym, orderId));
      if (!o) continue;
      matched += 1;

      const nextBroker = {
        ...(t as any)?.broker,
        provider: 'SCHWAB' as const,
        accountHash,
        orderId,
        status: norm(o?.status) || (t as any)?.broker?.status || 'UNKNOWN',
        enteredTime: norm(o?.enteredTime) || (t as any)?.broker?.enteredTime,
        closeTime: norm(o?.closeTime) || (t as any)?.broker?.closeTime,
        filledQuantity: typeof o?.filledQuantity === 'number' ? o.filledQuantity : (t as any)?.broker?.filledQuantity,
        remainingQuantity: typeof o?.remainingQuantity === 'number' ? o.remainingQuantity : (t as any)?.broker?.remainingQuantity,
        averageFillPrice: typeof o?.averageFillPrice === 'number' ? o.averageFillPrice : (t as any)?.broker?.averageFillPrice,
        lastUpdate: new Date().toISOString(),
      };

      const prev = JSON.stringify((t as any)?.broker || {});
      const next = JSON.stringify(nextBroker);
      if (prev !== next) {
        await updateSuggestion(t.id, { broker: nextBroker } as any);
        updated += 1;
      }
    }

    return {
      ok: true,
      scanned: candidates.length,
      matched,
      updated,
      errors,
    };
  } catch (e: any) {
    errors.push(String(e?.message || e));
    return {
      ok: false,
      scanned: candidates.length,
      matched,
      updated,
      errors,
    };
  }
}
