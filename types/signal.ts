export type Signal = {
  symbol: string;
  instrument: 'STOCK' | 'OPTION';
  action: 'BUY' | 'SELL' | 'NO_TRADE';
  confidence: number;
  strategyId: string;
  strategyName: string;
  why: string[];
  invalidation: string;
  tradePlan: {
    entry?: number | string;
    stop?: number | string;
    target?: number | string;
    horizon?: string;
  };
  evidencePacketId?: string;
};
