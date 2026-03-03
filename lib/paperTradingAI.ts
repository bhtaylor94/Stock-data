// lib/paperTradingAI.ts
// Claude AI brain for the paper trading agent.
// All functions return null on API failure — caller falls back to hardcoded rules.

import Anthropic from '@anthropic-ai/sdk';
import type { TradeMemory } from './paperTradingStore';

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTED TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface PortfolioAssessment {
  maxPositions: number;       // 4–12
  cashFloorPct: number;       // 0.15–0.35
  riskBiasPct: number;        // 0.01–0.05
  regimeTake: 'AGGRESSIVE' | 'NORMAL' | 'DEFENSIVE' | 'FLAT';
  avoidSectors: string[];
  reasoning: string;
}

export interface TradeDecision {
  action: 'ENTER' | 'SKIP';
  conviction: 1 | 2 | 3 | 4 | 5;
  riskMultiplier: number;     // 0.5–3.0 × base riskBiasPct
  targetPct: number;          // e.g. 0.60 = +60% profit target
  stopPct: number;            // e.g. -0.35 = -35% stop (negative)
  dteLow: number;             // min DTE to accept
  dteHigh: number;            // max DTE to accept
  deltaLow: number;           // min abs delta
  deltaHigh: number;          // max abs delta
  reasoning: string;
}

export interface ExitDecision {
  action: 'HOLD' | 'EXIT' | 'TIGHTEN_STOP';
  newStopPct?: number;        // only when action === 'TIGHTEN_STOP'
  reasoning: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// SYSTEM PROMPT
// ─────────────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are the Chief Investment Officer of a quantitative hedge fund.
You manage a $25K paper trading account. Your edge: reading unusual options flow
(institutional smart money signals) and making disciplined, asymmetric trades.
Always respond with valid JSON only. No explanation outside the JSON.`;

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function formatMemoryLines(memory: TradeMemory[]): string {
  return memory.slice(0, 10).map(m =>
    `${m.closedAt.slice(0, 10)} ${m.ticker} ${m.direction} ` +
    `conviction=${m.claudeEntry.conviction} pnl=${(m.outcome.realizedPnlPct * 100).toFixed(1)}% ` +
    `exit=${m.outcome.exitReason} regime=${m.entrySignal.regime}`
  ).join('\n');
}

function parseClaudeJson<T>(text: string): T | null {
  try {
    // Strip accidental markdown code fences
    const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
    return JSON.parse(cleaned) as T;
  } catch {
    return null;
  }
}

/** Compute win rate + profit factor from trade memory */
export function computeStats(memory: TradeMemory[]): { winRate: number; profitFactor: number } {
  if (memory.length === 0) return { winRate: 0.5, profitFactor: 1.0 };
  const wins  = memory.filter(m => m.outcome.won);
  const gross = memory.reduce((s, m) => s + Math.max(0,  m.outcome.realizedPnlPct), 0);
  const loss  = memory.reduce((s, m) => s + Math.max(0, -m.outcome.realizedPnlPct), 0);
  return {
    winRate:      wins.length / memory.length,
    profitFactor: loss > 0 ? gross / loss : gross > 0 ? 99 : 1.0,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PORTFOLIO ASSESSMENT
// ─────────────────────────────────────────────────────────────────────────────

export interface PortfolioAssessmentCtx {
  portfolioValue: number;
  cash: number;
  drawdownPct: number;
  openPositions: Array<{ ticker: string; positionType: string; unrealizedPnlPct: number; sector: string }>;
  regime: string;
  spyChangePct: number;
  vixLevel: number;
  tradeMemory: TradeMemory[];
  winRate: number;
  profitFactor: number;
}

export async function claudeAssessPortfolio(ctx: PortfolioAssessmentCtx): Promise<PortfolioAssessment | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  try {
    const memoryLines = ctx.tradeMemory.length > 0
      ? `Recent trades (newest first):\n${formatMemoryLines(ctx.tradeMemory)}`
      : 'No trade history yet.';

    const prompt = `Assess current portfolio state and return sizing/risk parameters for this run.

Portfolio:
- Value: $${ctx.portfolioValue.toFixed(0)} | Cash: $${ctx.cash.toFixed(0)} (${((ctx.cash / ctx.portfolioValue) * 100).toFixed(1)}%)
- Drawdown from peak: ${ctx.drawdownPct.toFixed(1)}%
- Open positions (${ctx.openPositions.length}): ${ctx.openPositions.map(p => `${p.ticker}(${p.unrealizedPnlPct > 0 ? '+' : ''}${(p.unrealizedPnlPct * 100).toFixed(1)}%)`).join(', ') || 'none'}
- Regime: ${ctx.regime} | SPY change: ${ctx.spyChangePct > 0 ? '+' : ''}${ctx.spyChangePct.toFixed(2)}% | VIX: ${ctx.vixLevel.toFixed(1)}
- Historical performance: Win rate ${(ctx.winRate * 100).toFixed(0)}% | Profit factor ${ctx.profitFactor.toFixed(2)}x

${memoryLines}

Respond with exactly this JSON shape (no other text):
{
  "maxPositions": <integer 4-12>,
  "cashFloorPct": <decimal 0.15-0.35>,
  "riskBiasPct": <decimal 0.01-0.05>,
  "regimeTake": <"AGGRESSIVE"|"NORMAL"|"DEFENSIVE"|"FLAT">,
  "avoidSectors": [<strings>],
  "reasoning": "<one sentence>"
}`;

    const anthropic = new Anthropic();
    const timeoutP = new Promise<null>(resolve => setTimeout(() => resolve(null), 8000));
    const callP = anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
    }).then(r => (r.content[0] as { type: string; text: string }).text);

    const text = await Promise.race([callP, timeoutP]);
    if (!text) return null;
    return parseClaudeJson<PortfolioAssessment>(text);
  } catch (err) {
    console.error('[paperTradingAI] claudeAssessPortfolio error:', err);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TRADE EVALUATION
// ─────────────────────────────────────────────────────────────────────────────

export interface TradeEvalCtx {
  ticker: string;
  signalType: string;        // 'OPTIONS' | 'STOCK'
  direction: string;         // 'LONG_CALL' | 'LONG_PUT' | 'LONG_STOCK'
  uoaScore: number;
  alertType: string;
  strike?: number;
  dte?: number;
  delta?: number;
  ivRank: number;
  regime: string;
  portfolioValue: number;
  cashPct: number;
  openCount: number;
  relevantMemory: TradeMemory[];
}

export async function claudeEvaluateTrade(ctx: TradeEvalCtx): Promise<TradeDecision | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  try {
    const memLines = ctx.relevantMemory.length > 0
      ? `Past ${ctx.ticker} trades:\n${formatMemoryLines(ctx.relevantMemory)}`
      : `No prior ${ctx.ticker} history.`;

    const prompt = `Evaluate this trade signal and decide whether to enter.

Signal:
- Ticker: ${ctx.ticker} | Type: ${ctx.signalType} | Direction: ${ctx.direction}
- UOA score: ${ctx.uoaScore}/100 | Alert: ${ctx.alertType}
${ctx.strike ? `- Strike: $${ctx.strike} | DTE: ${ctx.dte} | Delta: ${ctx.delta?.toFixed(2)}` : ''}
- IV Rank: ${(ctx.ivRank * 100).toFixed(0)}% | Regime: ${ctx.regime}

Portfolio context:
- Value: $${ctx.portfolioValue.toFixed(0)} | Cash: ${(ctx.cashPct * 100).toFixed(1)}% | Open positions: ${ctx.openCount}

${memLines}

Respond with exactly this JSON shape (no other text):
{
  "action": <"ENTER"|"SKIP">,
  "conviction": <1|2|3|4|5>,
  "riskMultiplier": <decimal 0.5-3.0>,
  "targetPct": <decimal e.g. 0.60 for +60%>,
  "stopPct": <negative decimal e.g. -0.35 for -35%>,
  "dteLow": <integer>,
  "dteHigh": <integer>,
  "deltaLow": <decimal>,
  "deltaHigh": <decimal>,
  "reasoning": "<one sentence>"
}`;

    const anthropic = new Anthropic();
    const timeoutP = new Promise<null>(resolve => setTimeout(() => resolve(null), 8000));
    const callP = anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
    }).then(r => (r.content[0] as { type: string; text: string }).text);

    const text = await Promise.race([callP, timeoutP]);
    if (!text) return null;
    return parseClaudeJson<TradeDecision>(text);
  } catch (err) {
    console.error('[paperTradingAI] claudeEvaluateTrade error:', err);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// EXIT EVALUATION
// ─────────────────────────────────────────────────────────────────────────────

export interface ExitEvalCtx {
  ticker: string;
  direction: string;
  positionType: string;
  unrealizedPnlPct: number;
  daysHeld: number;
  entryPrice: number;
  currentPrice: number;
  stopPrice: number;
  targetPrice: number;
  regime: string;
  vixLevel: number;
  tickerMemory: TradeMemory[];
}

export async function claudeEvaluateExit(ctx: ExitEvalCtx): Promise<ExitDecision | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  try {
    const memLines = ctx.tickerMemory.length > 0
      ? `Past ${ctx.ticker} exits:\n${formatMemoryLines(ctx.tickerMemory)}`
      : `No prior ${ctx.ticker} history.`;

    const prompt = `Evaluate whether to exit, hold, or tighten stop on this position in the danger zone.

Position:
- Ticker: ${ctx.ticker} | Type: ${ctx.positionType} | Direction: ${ctx.direction}
- Entry: $${ctx.entryPrice.toFixed(2)} | Current: $${ctx.currentPrice.toFixed(2)} | Stop: $${ctx.stopPrice.toFixed(2)} | Target: $${ctx.targetPrice.toFixed(2)}
- Unrealized P&L: ${(ctx.unrealizedPnlPct * 100).toFixed(1)}% | Days held: ${ctx.daysHeld}
- Regime: ${ctx.regime} | VIX: ${ctx.vixLevel.toFixed(1)}

${memLines}

Respond with exactly this JSON shape (no other text):
{
  "action": <"HOLD"|"EXIT"|"TIGHTEN_STOP">,
  "newStopPct": <negative decimal only if action is TIGHTEN_STOP, e.g. -0.25>,
  "reasoning": "<one sentence>"
}`;

    const anthropic = new Anthropic();
    const timeoutP = new Promise<null>(resolve => setTimeout(() => resolve(null), 5000));
    const callP = anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 128,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
    }).then(r => (r.content[0] as { type: string; text: string }).text);

    const text = await Promise.race([callP, timeoutP]);
    if (!text) return null;
    return parseClaudeJson<ExitDecision>(text);
  } catch (err) {
    console.error('[paperTradingAI] claudeEvaluateExit error:', err);
    return null;
  }
}
