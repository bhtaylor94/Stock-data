// strategies/registry.ts
// Strategy-first registry (v1). These are first-class objects.

export type StrategyId =
  | 'trend_rider'
  | 'breakout_volume'
  | 'mean_reversion'
  | 'event_momentum';

export type MarketRegime = 'TREND' | 'RANGE' | 'MOMENTUM' | 'EVENT' | 'MIXED';
export type Horizon = 'INTRADAY' | 'SWING' | 'POSITION';

export type PresetId = 'conservative' | 'balanced' | 'aggressive';

export type StrategyPreset = {
  id: PresetId;
  name: string;
  description: string;
  editableInPaper: boolean;
  lockedInLive: boolean;
  params: Record<string, number | string | boolean>;
};

export type StrategySpec = {
  id: StrategyId;
  name: string;
  shortDescription: string;
  marketRegimes: MarketRegime[];
  horizon: Horizon;
  entryTriggers: string[];
  confirmations: string[];
  disqualifiers: string[];
  invalidationRules: string[];
  riskModel: string[];
  positionLogic: string[];
  output: {
    schemaVersion: 'v1';
    emits: 'Signal';
  };
  engineKey: string;
  presets: StrategyPreset[];
};

export const STRATEGY_REGISTRY: StrategySpec[] = [
  {
    id: 'trend_rider',
    name: 'Trend Rider',
    shortDescription: 'Trend continuation entries using EMA alignment + VWAP confirmation with ATR-based risk.',
    marketRegimes: ['TREND', 'MOMENTUM'],
    horizon: 'SWING',
    entryTriggers: [
      'Bullish: EMA20 > EMA50 and price closes above EMA20',
      'Bearish: EMA20 < EMA50 and price closes below EMA20',
    ],
    confirmations: [
      'VWAP confirmation (bullish: price above VWAP; bearish: price below VWAP)',
      'Avoid major resistance/support immediately overhead/underfoot (buffer %)',
    ],
    disqualifiers: [
      'Regime not trending (EMA spread below threshold)',
      'Price too far extended from EMA20 (chase filter)',
    ],
    invalidationRules: [
      'Bullish invalidation: close back below EMA50 or VWAP (preset-dependent)',
      'Bearish invalidation: close back above EMA50 or VWAP (preset-dependent)',
    ],
    riskModel: [
      'Stop = ATR multiple from entry (preset stopAtrMultiple)',
      'Target = R multiple (preset targetRR)',
      'After 1R, optional trailing stop (preset trailAfterR + trailAtrMultiple)',
      'Time stop (optional) if no progress after N bars',
    ],
    positionLogic: [
      'One position per symbol per strategy (avoid stacking)',
      'Do not re-enter within cooldown bars after invalidation',
    ],
    output: { schemaVersion: 'v1', emits: 'Signal' },
    engineKey: 'engine.trendRider.v1',
    presets: [
      {
        id: 'conservative',
        name: 'Conservative',
        description: 'Stricter EMA spread + stronger VWAP/extension filters; wider stop; fewer trades.',
        editableInPaper: true,
        lockedInLive: true,
        params: {
          emaFast: 20,
          emaSlow: 50,
          minEmaSpreadPct: 0.6,
          requireVwapConfirm: true,
          maxExtensionPct: 3.0,
          stopAtrMultiple: 2.0,
          targetRR: 2.0,
          trailAfterR: 1.0,
          trailAtrMultiple: 1.8,
          levelBufferPct: 0.5,
          minConfidence: 72,
        },
      },
      {
        id: 'balanced',
        name: 'Balanced',
        description: 'Default EMA alignment + VWAP confirmation; moderate stop; balanced frequency.',
        editableInPaper: true,
        lockedInLive: true,
        params: {
          emaFast: 20,
          emaSlow: 50,
          minEmaSpreadPct: 0.4,
          requireVwapConfirm: true,
          maxExtensionPct: 4.0,
          stopAtrMultiple: 1.6,
          targetRR: 2.0,
          trailAfterR: 1.0,
          trailAtrMultiple: 1.5,
          levelBufferPct: 0.35,
          minConfidence: 65,
        },
      },
      {
        id: 'aggressive',
        name: 'Aggressive',
        description: 'Looser EMA spread and VWAP confirmation optional; tighter stop; more trades.',
        editableInPaper: true,
        lockedInLive: true,
        params: {
          emaFast: 20,
          emaSlow: 50,
          minEmaSpreadPct: 0.25,
          requireVwapConfirm: false,
          maxExtensionPct: 6.0,
          stopAtrMultiple: 1.25,
          targetRR: 1.7,
          trailAfterR: 0.75,
          trailAtrMultiple: 1.25,
          levelBufferPct: 0.25,
          minConfidence: 58,
        },
      },
    ],
  },

  {
    id: 'breakout_volume',
    name: 'Breakout + Volume Expansion',
    shortDescription: 'Resistance breakouts validated by volume expansion with breakout-failure invalidation.',
    marketRegimes: ['MOMENTUM', 'TREND', 'MIXED'],
    horizon: 'SWING',
    entryTriggers: [
      'Bullish: close above prior resistance/high (lookback window) by buffer %',
      'Bearish: close below prior support/low (lookback window) by buffer %',
    ],
    confirmations: [
      'Volume expansion vs average volume (multiple threshold)',
      'Optional trend alignment (EMA20 vs EMA50) to avoid counter-trend breakouts',
    ],
    disqualifiers: [
      'Breakout occurs into nearby higher-timeframe resistance (buffer %)',
      'Low liquidity / volume below minimum threshold',
    ],
    invalidationRules: [
      'Breakout failure: close back inside prior range within N bars',
      'Stop triggered (ATR multiple or back below/above breakout level)',
    ],
    riskModel: [
      'Stop = max(ATR multiple, back inside range)',
      'Target = R multiple or measured move (preset)',
      'Time stop if breakout does not follow through after N bars',
    ],
    positionLogic: [
      'No re-entry until cooldown after failed breakout',
      'Reduce size / skip when ATR% indicates high-volatility regime (optional)',
    ],
    output: { schemaVersion: 'v1', emits: 'Signal' },
    engineKey: 'engine.breakoutVolume.v1',
    presets: [
      {
        id: 'conservative',
        name: 'Conservative',
        description: 'Requires stronger volume expansion and wider confirmation; avoids marginal breakouts.',
        editableInPaper: true,
        lockedInLive: true,
        params: {
          lookbackBars: 20,
          breakoutBufferPct: 0.25,
          volumeMinMultiple: 2.0,
          requireTrendAlignment: true,
          stopAtrMultiple: 2.0,
          targetRR: 2.2,
          failBars: 2,
          timeStopBars: 8,
          minConfidence: 72,
        },
      },
      {
        id: 'balanced',
        name: 'Balanced',
        description: 'Default breakout + volume rules; balanced confirmation and frequency.',
        editableInPaper: true,
        lockedInLive: true,
        params: {
          lookbackBars: 20,
          breakoutBufferPct: 0.15,
          volumeMinMultiple: 1.6,
          requireTrendAlignment: false,
          stopAtrMultiple: 1.6,
          targetRR: 2.0,
          failBars: 3,
          timeStopBars: 10,
          minConfidence: 65,
        },
      },
      {
        id: 'aggressive',
        name: 'Aggressive',
        description: 'Looser volume/confirmation; more signals; tighter stop and quicker time stop.',
        editableInPaper: true,
        lockedInLive: true,
        params: {
          lookbackBars: 15,
          breakoutBufferPct: 0.08,
          volumeMinMultiple: 1.25,
          requireTrendAlignment: false,
          stopAtrMultiple: 1.25,
          targetRR: 1.7,
          failBars: 3,
          timeStopBars: 7,
          minConfidence: 58,
        },
      },
    ],
  },

  {
    id: 'mean_reversion',
    name: 'Mean Reversion',
    shortDescription: 'Bollinger extremes + VWAP proximity in range-bound conditions with strict time stops.',
    marketRegimes: ['RANGE', 'MIXED'],
    horizon: 'INTRADAY',
    entryTriggers: [
      'Bullish: price pierces/lives below lower Bollinger band (oversold extreme)',
      'Bearish: price pierces/lives above upper Bollinger band (overbought extreme)',
    ],
    confirmations: [
      'VWAP proximity (don’t fade far-from-VWAP extremes)',
      'Optional RSI confirmation (oversold/overbought bands)',
    ],
    disqualifiers: [
      'Strong trend regime (EMA20/EMA50 spread above threshold)',
      'High volatility (ATR% above max threshold)',
    ],
    invalidationRules: [
      'Time stop: exit after N bars if reversion not occurring',
      'Stop = ATR multiple beyond extreme',
    ],
    riskModel: [
      'Target = VWAP or Bollinger midline',
      'Stop = ATR multiple beyond extreme',
      'Time stop is mandatory',
    ],
    positionLogic: [
      'One attempt per extreme per direction; avoid repeated fading in the same session',
    ],
    output: { schemaVersion: 'v1', emits: 'Signal' },
    engineKey: 'engine.meanReversion.v1',
    presets: [
      {
        id: 'conservative',
        name: 'Conservative',
        description: 'Needs deeper band excursion and closer VWAP; tighter volatility cap; fewer fades.',
        editableInPaper: true,
        lockedInLive: true,
        params: {
          bbPeriod: 20,
          bbStdDev: 2.0,
          bbZMin: 0.35,
          vwapProximityPct: 1.0,
          atrPctMax: 4.0,
          stopAtrMultiple: 1.5,
          timeStopBars: 10,
          minConfidence: 70,
        },
      },
      {
        id: 'balanced',
        name: 'Balanced',
        description: 'Default band + VWAP proximity; strict time stop; balanced frequency.',
        editableInPaper: true,
        lockedInLive: true,
        params: {
          bbPeriod: 20,
          bbStdDev: 2.0,
          bbZMin: 0.2,
          vwapProximityPct: 1.5,
          atrPctMax: 5.0,
          stopAtrMultiple: 1.25,
          timeStopBars: 12,
          minConfidence: 62,
        },
      },
      {
        id: 'aggressive',
        name: 'Aggressive',
        description: 'Allows shallower excursions and looser VWAP; faster time stop; more signals.',
        editableInPaper: true,
        lockedInLive: true,
        params: {
          bbPeriod: 20,
          bbStdDev: 2.0,
          bbZMin: 0.1,
          vwapProximityPct: 2.2,
          atrPctMax: 6.5,
          stopAtrMultiple: 1.1,
          timeStopBars: 9,
          minConfidence: 55,
        },
      },
    ],
  },

  {
    id: 'event_momentum',
    name: 'Event Momentum',
    shortDescription: 'Catalyst-driven momentum with trend alignment and shorter horizon trade plans.',
    marketRegimes: ['EVENT', 'MOMENTUM', 'TREND'],
    horizon: 'INTRADAY',
    entryTriggers: [
      'Catalyst present (earnings/news) and price breaks key level in direction of trend',
    ],
    confirmations: [
      'Trend alignment (EMA20 vs EMA50)',
      'Above-average volume (optional when volume data available)',
    ],
    disqualifiers: [
      'No catalyst detected/declared',
      'Conflicting broader trend (alignment fails)',
    ],
    invalidationRules: [
      'Reversal below/above VWAP after entry (momentum failure)',
      'Time stop (short): exit after N bars',
    ],
    riskModel: [
      'Stop = ATR multiple or VWAP failure',
      'Target = R multiple (smaller) or prior day level',
      'Time stop is mandatory',
    ],
    positionLogic: [
      'One attempt per catalyst window; avoid overtrading the event',
    ],
    output: { schemaVersion: 'v1', emits: 'Signal' },
    engineKey: 'engine.eventMomentum.v1',
    presets: [
      {
        id: 'conservative',
        name: 'Conservative',
        description: 'Requires strict trend alignment and VWAP hold; wider stop; fewer event plays.',
        editableInPaper: true,
        lockedInLive: true,
        params: {
          requireCatalyst: true,
          requireTrendAlignment: true,
          requireVwapHold: true,
          stopAtrMultiple: 1.8,
          targetRR: 1.6,
          timeStopBars: 8,
          minConfidence: 72,
        },
      },
      {
        id: 'balanced',
        name: 'Balanced',
        description: 'Default event momentum rules; medium stop; short time stop.',
        editableInPaper: true,
        lockedInLive: true,
        params: {
          requireCatalyst: true,
          requireTrendAlignment: true,
          requireVwapHold: false,
          stopAtrMultiple: 1.5,
          targetRR: 1.5,
          timeStopBars: 10,
          minConfidence: 65,
        },
      },
      {
        id: 'aggressive',
        name: 'Aggressive',
        description: 'Looser alignment and VWAP rules; more trades; quicker exits.',
        editableInPaper: true,
        lockedInLive: true,
        params: {
          requireCatalyst: true,
          requireTrendAlignment: false,
          requireVwapHold: false,
          stopAtrMultiple: 1.25,
          targetRR: 1.35,
          timeStopBars: 7,
          minConfidence: 58,
        },
      },
    ],
  },
];

export function getStrategySpec(id: StrategyId): StrategySpec | null {
  return STRATEGY_REGISTRY.find((s) => s.id === id) || null;
}

export function getPreset(spec: StrategySpec, presetId: PresetId): StrategyPreset {
  const p = spec.presets.find((x) => x.id === presetId);
  return p || spec.presets[0];
}
