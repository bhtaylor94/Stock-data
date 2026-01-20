import { promises as fs } from 'fs';
import path from 'path';

import type { Signal } from '@/strategies/signalTypes';
import type { PresetId, StrategyId } from '@/strategies/registry';

export type PendingApprovalStatus = 'PENDING' | 'APPROVED' | 'DECLINED' | 'EXPIRED' | 'ERROR';

export type PendingApproval = {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: PendingApprovalStatus;

  symbol: string;
  strategyId: StrategyId;
  presetId: PresetId;
  action: 'BUY' | 'SELL';

  quantity: number;
  estimatedEntry?: number;
  estimatedNotionalUSD?: number;

  // Stored for explainability and exact replay
  signal: Signal;

  // Execution expression (optional, default STOCK)
  executionInstrument?: 'STOCK' | 'OPTION';
  selectedOptionContract?: any;

  // When executed
  orderId?: string;
  executedAt?: string;
  error?: string;
};

function storePath(): string {
  const custom = process.env.PENDING_APPROVALS_STORE_PATH;
  if (custom && custom.trim()) return custom.trim();
  const base = process.env.VERCEL ? '/tmp' : process.cwd();
  return path.join(base, '.data', 'pending-approvals.json');
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

export async function loadPendingApprovals(): Promise<PendingApproval[]> {
  return readJsonFile<PendingApproval[]>(storePath(), []);
}

export async function savePendingApprovals(items: PendingApproval[]): Promise<void> {
  await atomicWrite(storePath(), JSON.stringify(items, null, 2));
}

export async function addPendingApproval(item: PendingApproval): Promise<void> {
  const all = await loadPendingApprovals();
  all.unshift(item);
  await savePendingApprovals(all.slice(0, 500));
}

export async function updatePendingApproval(id: string, patch: Partial<PendingApproval>): Promise<PendingApproval | null> {
  const all = await loadPendingApprovals();
  const idx = all.findIndex((x) => x.id === id);
  if (idx < 0) return null;
  const updated: PendingApproval = { ...all[idx], ...patch, updatedAt: new Date().toISOString() };
  all[idx] = updated;
  await savePendingApprovals(all);
  return updated;
}

export async function getPendingApproval(id: string): Promise<PendingApproval | null> {
  const all = await loadPendingApprovals();
  return all.find((x) => x.id === id) || null;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function makePendingId(symbol: string, strategyId: string): string {
  return `pa_${symbol}_${strategyId}_${Date.now()}`;
}
