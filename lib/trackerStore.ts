import { promises as fs } from 'fs';
import path from 'path';

export type TrackedSuggestionStatus = 'ACTIVE' | 'HIT_TARGET' | 'STOPPED_OUT' | 'CLOSED' | 'EXPIRED';

export type TrackedSuggestion = {
  id: string;
  ticker: string;
  type: string;
  strategy: string;
  entryPrice: number;
  // Position sizing assumptions (defaults: stocks=100 shares, options=5 contracts)
  positionShares?: number;
  positionContracts?: number;
  contractMultiplier?: number;
  targetPrice: number;
  stopLoss: number;
  confidence: number;
  reasoning: string[];
  status: TrackedSuggestionStatus;
  createdAt: string;
  updatedAt: string;
  closedAt?: string;
  closedPrice?: number;
  optionContract?: {
    strike: number;
    expiration: string; // ISO date
    dte?: number;
    delta?: number;
    entryAsk?: number;
    optionType?: 'CALL' | 'PUT';
  };
};

function storePath(): string {
  const custom = process.env.TRACKER_STORE_PATH;
  if (custom && custom.trim()) return custom.trim();

  // Prefer /tmp for serverless; fall back to project-local for dev.
  const base = process.env.VERCEL ? '/tmp' : process.cwd();
  return path.join(base, '.data', 'tracker.json');
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

export async function loadSuggestions(): Promise<TrackedSuggestion[]> {
  const p = storePath();
  return readJsonFile<TrackedSuggestion[]>(p, []);
}

export async function saveSuggestions(items: TrackedSuggestion[]): Promise<void> {
  const p = storePath();
  await atomicWrite(p, JSON.stringify(items, null, 2));
}

export async function upsertSuggestion(s: TrackedSuggestion): Promise<void> {
  const all = await loadSuggestions();
  const idx = all.findIndex(x => x.id === s.id);
  if (idx >= 0) all[idx] = s; else all.unshift(s);
  await saveSuggestions(all);
}

export async function updateSuggestion(id: string, patch: Partial<TrackedSuggestion>): Promise<TrackedSuggestion | null> {
  const all = await loadSuggestions();
  const idx = all.findIndex(x => x.id === id);
  if (idx < 0) return null;
  const updated: TrackedSuggestion = { ...all[idx], ...patch, updatedAt: new Date().toISOString() };
  all[idx] = updated;
  await saveSuggestions(all);
  return updated;
}

export async function deleteSuggestion(id: string): Promise<boolean> {
  const all = await loadSuggestions();
  const next = all.filter(x => x.id !== id);
  if (next.length === all.length) return false;
  await saveSuggestions(next);
  return true;
}
