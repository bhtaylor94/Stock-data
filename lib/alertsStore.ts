import { promises as fs } from 'fs';
import path from 'path';

export type AlertEventType =
  | 'SIGNAL_PAPER_TRACKED'
  | 'SIGNAL_LIVE_ORDER_PLACED'
  | 'SIGNAL_LIVE_APPROVAL_QUEUED'
  | 'AUTOPILOT_HALTED'
  | 'AUTOPILOT_ERROR';

export type AlertEvent = {
  id: string;
  createdAt: string;
  type: AlertEventType;
  title: string;
  message: string;
  severity: 'info' | 'warn' | 'error';
  symbol?: string;
  strategyId?: string;
  confidence?: number;
  action?: 'BUY' | 'SELL' | 'NO_TRADE';
  meta?: Record<string, any>;
};

export type AlertsConfig = {
  version: 1;
  enabled: boolean;
  minConfidence: number;
  symbols: string[]; // optional allowlist; empty = all
  strategies: string[]; // optional allowlist; empty = all
  includePaper: boolean;
  includeLiveConfirm: boolean;
  includeLiveAuto: boolean;
  webhookUrl?: string; // optional
  updatedAt: string;
};

export type AlertsStore = {
  config: AlertsConfig;
  inbox: AlertEvent[];
};

function storePath(): string {
  const custom = process.env.ALERTS_STORE_PATH;
  if (custom && custom.trim()) return custom.trim();
  const base = process.env.VERCEL ? '/tmp' : process.cwd();
  return path.join(base, '.data', 'alerts.json');
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

export function defaultAlertsConfig(): AlertsConfig {
  return {
    version: 1,
    enabled: true,
    minConfidence: 70,
    symbols: [],
    strategies: [],
    includePaper: true,
    includeLiveConfirm: true,
    includeLiveAuto: true,
    webhookUrl: '',
    updatedAt: new Date().toISOString(),
  };
}

export async function loadAlertsStore(): Promise<AlertsStore> {
  const fallback: AlertsStore = { config: defaultAlertsConfig(), inbox: [] };
  const stored = await readJsonFile<AlertsStore>(storePath(), fallback);
  return {
    config: { ...fallback.config, ...(stored?.config || {}), updatedAt: new Date().toISOString() },
    inbox: Array.isArray(stored?.inbox) ? stored.inbox : [],
  };
}

export async function saveAlertsConfig(patch: Partial<AlertsConfig>): Promise<AlertsConfig> {
  const store = await loadAlertsStore();
  const next: AlertsStore = {
    ...store,
    config: {
      ...store.config,
      ...patch,
      version: 1,
      updatedAt: new Date().toISOString(),
      symbols: Array.isArray((patch as any).symbols) ? (patch as any).symbols : store.config.symbols,
      strategies: Array.isArray((patch as any).strategies) ? (patch as any).strategies : store.config.strategies,
    },
  };
  await atomicWrite(storePath(), JSON.stringify(next, null, 2));
  return next.config;
}

export async function appendAlertEvent(ev: AlertEvent, maxKeep = 200): Promise<void> {
  const store = await loadAlertsStore();
  const inbox = [ev, ...(store.inbox || [])].slice(0, Math.max(20, maxKeep));
  const next: AlertsStore = { ...store, inbox };
  await atomicWrite(storePath(), JSON.stringify(next, null, 2));
}

export async function listAlertEvents(limit = 50): Promise<AlertEvent[]> {
  const store = await loadAlertsStore();
  return (store.inbox || []).slice(0, Math.max(1, Math.min(200, limit)));
}

export async function clearAlertEvents(): Promise<void> {
  const store = await loadAlertsStore();
  const next: AlertsStore = { ...store, inbox: [] };
  await atomicWrite(storePath(), JSON.stringify(next, null, 2));
}

export function normalizeList(input: any): string[] {
  const arr = Array.isArray(input) ? input : typeof input === 'string' ? input.split(',') : [];
  return arr
    .map((s) => String(s || '').trim())
    .filter(Boolean)
    .map((s) => s.toUpperCase())
    .slice(0, 200);
}

export function shouldEmitAlert(cfg: AlertsConfig, mode: 'PAPER' | 'LIVE' | 'LIVE_CONFIRM', symbol?: string, strategyId?: string, confidence?: number): boolean {
  if (!cfg?.enabled) return false;
  const conf = Number(confidence || 0);
  if (Number.isFinite(cfg.minConfidence) && conf < Number(cfg.minConfidence || 0)) return false;

  if (mode === 'PAPER' && !cfg.includePaper) return false;
  if (mode === 'LIVE_CONFIRM' && !cfg.includeLiveConfirm) return false;
  if (mode === 'LIVE' && !cfg.includeLiveAuto) return false;

  const sym = String(symbol || '').toUpperCase();
  const sid = String(strategyId || '');

  if (Array.isArray(cfg.symbols) && cfg.symbols.length > 0) {
    if (!sym || !cfg.symbols.map((s) => String(s).toUpperCase()).includes(sym)) return false;
  }
  if (Array.isArray(cfg.strategies) && cfg.strategies.length > 0) {
    if (!sid || !cfg.strategies.includes(sid)) return false;
  }

  return true;
}
