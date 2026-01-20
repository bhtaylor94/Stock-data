import { buildTrendRiderSignal } from './trendRider';

export async function runStrategiesForSymbol(symbol: string) {
  // Future: regime gating + multi-strategy fan-out
  return buildTrendRiderSignal(symbol);
}
