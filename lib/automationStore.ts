import { promises as fs } from 'fs';
import path from 'path';

import type { PresetId, StrategyId } from '@/strategies/registry';

export type AutopilotMode = 'OFF' | 'PAPER' | 'LIVE';

export type StrategyAutomationConfig = {
  enabled: boolean;
  minConfidence?: number; // optional override
  symbols?: string[]; // optional override
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
    },
    strategies: {},
    updatedAt: now,
  };
}

export async function loadAutomationConfig(): Promise<AutomationConfig> {
  const cfg = await readJsonFile<AutomationConfig>(storePath(), defaultAutomationConfig());
  // minimal normalization
  if (!cfg.version) return defaultAutomationConfig();
  if (!cfg.autopilot) return defaultAutomationConfig();
  return cfg;
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

export function isLiveArmed(cfg: AutomationConfig): boolean {
  const exp = cfg.autopilot.liveArmExpiresAt ? new Date(cfg.autopilot.liveArmExpiresAt).getTime() : 0;
  return Number.isFinite(exp) && exp > Date.now();
}
