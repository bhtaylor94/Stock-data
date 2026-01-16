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

function extractEntryOrderId(t: TrackedSuggestion): string | null {
  const direct = norm((t as any)?.broker?.orderId);
  if (direct) return direct;
  const ep = (t as any)?.evidencePacket;
  const epId = norm(ep?.orderId);
  if (epId) return epId;
  return null;
}

function extractExitOrderId(t: TrackedSuggestion): string | null {
  const direct = norm((t as any)?.broker?.exitOrderId);
  if (direct) return direct;
  const ep = (t as any)?.evidencePacket;
  const epId = norm(ep?.exitOrderId);
  if (epId) return epId;
  return null;
}

function keyFor(instrumentSymbol: string, orderId: string): string {
  return [norm(instrumentSymbol).toUpperCase(), norm(orderId)].join('|');
}

function instrumentSymbolForSuggestion(t: TrackedSuggestion): string {
  const opt = norm((t as any)?.optionContract?.optionSymbol);
  if (opt) return opt;
  return norm((t as any)?.ticker || (t as any)?.symbol || '');
}

function classifyFilled(status: string): boolean {
  const s = norm(status).toUpperCase();
  return s === 'FILLED' || s === 'EXECUTED' || s === 'COMPLETED';
}

export async function reconcileSchwabOrders(opts?: {
  lookbackDays?: number;
  maxResults?: number;
}): Promise<ReconcileResult> {
  const lookbackDays = Math.max(1, Math.min(30, Number(opts?.lookbackDays ?? 7)));
  const maxResults = Math.max(25, Math.min(2000, Number(opts?.maxResults ?? 200)));

  const errors: string[] = [];
  const suggestions = await loadSuggestions();

  // Candidates: any suggestion with an entry or exit order id.
  const candidates = (suggestions || []).filter((t: TrackedSuggestion) => {
    return Boolean(extractEntryOrderId(t) || extractExitOrderId(t));
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
      const instrumentSym = instrumentSymbolForSuggestion(t);
      if (!instrumentSym) continue;

      const entryOrderId = extractEntryOrderId(t);
      const exitOrderId = extractExitOrderId(t);

      const entryOrder = entryOrderId ? byKey.get(keyFor(instrumentSym, entryOrderId)) : null;
      const exitOrder = exitOrderId ? byKey.get(keyFor(instrumentSym, exitOrderId)) : null;

      if (!entryOrder && !exitOrder) continue;
      matched += 1;

      const prevBroker = (t as any)?.broker || {};

      const nextBroker: any = {
        ...prevBroker,
        provider: 'SCHWAB' as const,
        accountHash,
        lastUpdate: new Date().toISOString(),
      };

      if (entryOrder && entryOrderId) {
        nextBroker.orderId = entryOrderId;
        nextBroker.status = norm(entryOrder?.status) || prevBroker.status || 'UNKNOWN';
        nextBroker.enteredTime = norm(entryOrder?.enteredTime) || prevBroker.enteredTime;
        nextBroker.closeTime = norm(entryOrder?.closeTime) || prevBroker.closeTime;
        nextBroker.filledQuantity = typeof entryOrder?.filledQuantity === 'number' ? entryOrder.filledQuantity : prevBroker.filledQuantity;
        nextBroker.remainingQuantity = typeof entryOrder?.remainingQuantity === 'number' ? entryOrder.remainingQuantity : prevBroker.remainingQuantity;
        nextBroker.averageFillPrice = typeof entryOrder?.averageFillPrice === 'number' ? entryOrder.averageFillPrice : prevBroker.averageFillPrice;
      }

      if (exitOrder && exitOrderId) {
        nextBroker.exitOrderId = exitOrderId;
        nextBroker.exitStatus = norm(exitOrder?.status) || prevBroker.exitStatus || 'UNKNOWN';
        nextBroker.exitSubmittedAt = prevBroker.exitSubmittedAt || new Date().toISOString();
        nextBroker.exitCloseTime = norm(exitOrder?.closeTime) || prevBroker.exitCloseTime;
        nextBroker.exitFilledQuantity = typeof exitOrder?.filledQuantity === 'number' ? exitOrder.filledQuantity : prevBroker.exitFilledQuantity;
        nextBroker.exitAverageFillPrice = typeof exitOrder?.averageFillPrice === 'number' ? exitOrder.averageFillPrice : prevBroker.exitAverageFillPrice;
      }

      const patch: any = { broker: nextBroker };

      // If we have a FILLED exit order, mark trade closed broker-truthfully.
      const exitFilled = classifyFilled(nextBroker.exitStatus);
      if (exitFilled && (t as any)?.status === 'ACTIVE') {
        patch.status = 'CLOSED';
        patch.closedAt = nextBroker.exitCloseTime || new Date().toISOString();
        // For options, closedPrice is contract fill price; for equities it's per-share fill price.
        const px = Number(nextBroker.exitAverageFillPrice);
        if (Number.isFinite(px)) patch.closedPrice = px;
      }

      const prevStr = JSON.stringify(prevBroker);
      const nextStr = JSON.stringify(nextBroker);
      const statusChanged = patch.status && patch.status !== (t as any)?.status;

      if (prevStr !== nextStr || statusChanged) {
        await updateSuggestion(t.id, patch);
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
