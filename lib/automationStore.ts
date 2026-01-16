import { promises as fs } from 'fs';
import path from 'path';

import type { PresetId, StrategyId } from '@/strategies/registry';

export type AutopilotMode = 'OFF' | 'PAPER' | 'LIVE';

export type StrategyAutomationConfig = {
  enabled: boolean;
  minConfidence?: number; // optional override
  symbols?: string[]; // optional override
};

export type NoTradeWindow = {
  startHHMM: string; // e.g. "09:30" (America/New_York)
  endHHMM: string; // e.g. "09:45" (America/New_York)
  label?: string;
};

export type AutomationConfig = {
  version: 1;
  autopilot: {
    enabled: boolean;
    mode: AutopilotMode;
    presetId: PresetId;
    minConfidence: number;
    symbols: string[];
    defaultQuantity: number;
    maxNewPositionsPerTick: number;
    cooldownMinutes: number;

    // Signal quality controls
    enableRegimeGate: boolean;
    signalDedupMinutes: number;
    dedupMinConfidenceDelta: number;

    // Risk controls
    maxOpenPositionsTotal: number;
    maxOpenPositionsPerSymbol: number;
    maxTradesPerDay: number;
    maxNotionalPerTradeUSD: number;

    // Time gates
    requireMarketHours: boolean;
    noTradeWindows: NoTradeWindow[];

    // LIVE safety
    requireLiveAllowlist: boolean;
    liveAllowlistSymbols: string[];

    // Safety: LIVE requires explicit arm window.
    liveArmExpiresAt?: string;
  };
  strategies: Record<string, StrategyAutomationConfig>;
  updatedAt: string;
};

function storePath(): string {
  const custom = process.env.AUTOMATION_STORE_PATH;
  if (custom && custom.trim()) return custom.trim();
  const base = process.env.VERCEL ? '/tmp' : process.cwd();
  return path.join(base, '.data', 'automation.json');
}

async function ensureDir(filePath: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

async function atomicWrite(filePath: string, content: string): Promise<void> {
  await ensureDir(filePath);
  const tmp = `${filePath}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, content, 'utf8');
  await fs.rename(tmp, filePath);
}

export function defaultAutomationConfig(): AutomationConfig {
  const now = new Date().toISOString();
  return {
    version: 1,
    autopilot: {
      enabled: false,
      mode: 'OFF',
      presetId: 'balanced',
      minConfidence: 70,
      symbols: ['SPY', 'QQQ', 'AAPL', 'MSFT', 'NVDA'],
      defaultQuantity: 1,
      maxNewPositionsPerTick: 2,
      cooldownMinutes: 60,

      enableRegimeGate: true,
      signalDedupMinutes: 120,
      dedupMinConfidenceDelta: 5,

      maxOpenPositionsTotal: 6,
      maxOpenPositionsPerSymbol: 1,
      maxTradesPerDay: 10,
      maxNotionalPerTradeUSD: 5000,

      requireMarketHours: true,
      noTradeWindows: [
        { startHHMM: '09:30', endHHMM: '09:35', label: 'Open buffer' },
        { startHHMM: '15:55', endHHMM: '16:00', label: 'Close buffer' },
      ],

      requireLiveAllowlist: true,
      liveAllowlistSymbols: ['SPY', 'QQQ'],
    },
    strategies: {},
    updatedAt: now,
  };
}

export async function loadAutomationConfig(): Promise<AutomationConfig> {
  const defaults = defaultAutomationConfig();
  const cfg = await readJsonFile<AutomationConfig>(storePath(), defaults);
  if (!cfg || !cfg.version || !cfg.autopilot) return defaults;
  return {
    ...defaults,
    ...cfg,
    autopilot: { ...defaults.autopilot, ...cfg.autopilot },
    strategies: cfg.strategies || {},
  };
}

export async function saveAutomationConfig(cfg: AutomationConfig): Promise<void> {
  const next: AutomationConfig = { ...cfg, updatedAt: new Date().toISOString() };
  await atomicWrite(storePath(), JSON.stringify(next, null, 2));
}

export function normalizeSymbolList(input: any): string[] {
  const arr = Array.isArray(input) ? input : typeof input === 'string' ? input.split(',') : [];
  return arr
    .map((s) => String(s || '').trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 200);
}

function normalizeHHMM(v: any): string | null {
  const s = String(v || '').trim();
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(s);
  if (!m) return null;
  return `${m[1]}:${m[2]}`;
}

export function normalizeNoTradeWindows(input: any): NoTradeWindow[] {
  const arr = Array.isArray(input) ? input : typeof input === 'string' ? input.split(',') : [];
  const out: NoTradeWindow[] = [];
  for (const item of arr) {
    if (!item) continue;
    if (typeof item === 'string') {
      // format: "HH:MM-HH:MM"
      const parts = item.split('-').map((x) => x.trim());
      if (parts.length === 2) {
        const a = normalizeHHMM(parts[0]);
        const b = normalizeHHMM(parts[1]);
        if (a && b) out.push({ startHHMM: a, endHHMM: b });
      }
      continue;
    }
    const a = normalizeHHMM((item as any).startHHMM);
    const b = normalizeHHMM((item as any).endHHMM);
    const label = String((item as any).label || '').trim();
    if (a && b) out.push({ startHHMM: a, endHHMM: b, label: label || undefined });
  }
  return out.slice(0, 20);
}

export function isLiveArmed(cfg: AutomationConfig): boolean {
  const exp = cfg.autopilot.liveArmExpiresAt ? new Date(cfg.autopilot.liveArmExpiresAt).getTime() : 0;
  return Number.isFinite(exp) && exp > Date.now();
}
