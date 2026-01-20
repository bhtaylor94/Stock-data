// strategies/signalTypes.ts
// Canonical, standardized signal schema (v1)

export type Instrument = 'STOCK' | 'OPTION';
export type SignalAction = 'BUY' | 'SELL' | 'NO_TRADE';

export type TradePlan = {
  entry: number | string | null;
  stop: number | string | null;
  target: number | string | null;
  horizon: string;
};

export type Signal = {
  symbol: string;
  instrument: Instrument;
  action: SignalAction;
  confidence: number; // 0-100
  strategyId: string;
  strategyName: string;
  why: string[]; // max 3 bullets
  invalidation: string | null;
  tradePlan: TradePlan;
  evidencePacketId?: string;
};
