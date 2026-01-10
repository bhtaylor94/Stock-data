import fs from 'fs';
import path from 'path';

export type SuggestionSnapshot = {
  id: string;
  asOf: string;
  source: 'stock' | 'options';
  ticker: string;
  decision: 'TRADE' | 'NO_TRADE';
  // Minimal, stable fields (everything else goes into payload so we don't break deploys)
  setupName: string | null;
  confidence: number;
  evidence: any;
  payload: any;
};

export interface SnapshotStore {
  saveSnapshot(snapshot: SuggestionSnapshot): Promise<void>;
  getSnapshotsByTicker(ticker: string, limit?: number): Promise<SuggestionSnapshot[]>;
  getRecentSnapshots(limit?: number): Promise<SuggestionSnapshot[]>;
}

// Vercel serverless filesystems are ephemeral. /tmp is writable per instance.
// On Optiplex/local, set AIHF_DB_PATH or AIHF_SNAPSHOT_PATH to persist.
function resolveSnapshotPath(): string {
  const explicit = process.env.AIHF_SNAPSHOT_PATH || process.env.AIHF_DB_PATH;
  if (explicit && typeof explicit === 'string' && explicit.trim()) return explicit.trim();
  return path.join('/tmp', 'aihf_snapshots.jsonl');
}

function ensureDir(filePath: string) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function safeJsonParse(line: string): any | null {
  try { return JSON.parse(line); } catch { return null; }
}

class JsonlSnapshotStore implements SnapshotStore {
  private filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
    ensureDir(this.filePath);
  }

  async saveSnapshot(snapshot: SuggestionSnapshot): Promise<void> {
    // Best-effort append. If it fails, we swallow (accuracy logic must never fail because storage failed).
    try {
      const line = JSON.stringify(snapshot) + '\n';
      fs.appendFileSync(this.filePath, line, { encoding: 'utf8' });
    } catch {
      // no-op
    }
  }

  async getSnapshotsByTicker(ticker: string, limit: number = 50): Promise<SuggestionSnapshot[]> {
    const all = await this.readAll();
    const t = String(ticker || '').toUpperCase();
    const out = all.filter(s => String(s?.ticker || '').toUpperCase() === t);
    return out.slice(0, Math.max(0, limit));
  }

  async getRecentSnapshots(limit: number = 50): Promise<SuggestionSnapshot[]> {
    const all = await this.readAll();
    return all.slice(0, Math.max(0, limit));
  }

  private async readAll(): Promise<SuggestionSnapshot[]> {
    try {
      if (!fs.existsSync(this.filePath)) return [];
      const content = fs.readFileSync(this.filePath, 'utf8');
      const lines = content.split(/\r?\n/).filter(Boolean);
      const rows: SuggestionSnapshot[] = [];
      for (const line of lines) {
        const obj = safeJsonParse(line);
        if (obj && obj.id && obj.asOf && obj.ticker) rows.push(obj as SuggestionSnapshot);
      }
      // newest first
      rows.sort((a, b) => (b.asOf || '').localeCompare(a.asOf || ''));
      return rows;
    } catch {
      return [];
    }
  }
}

let _store: SnapshotStore | null = null;

export async function getSnapshotStore(): Promise<SnapshotStore> {
  if (_store) return _store;
  _store = new JsonlSnapshotStore(resolveSnapshotPath());
  return _store;
}

function newId(): string {
  return 'snap_' + Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
}

function asNumber(v: any, fallback: number = 0): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function buildSnapshotFromPayload(params: {
  source: 'stock' | 'options';
  ticker: string;
  payload: any;
}): SuggestionSnapshot {
  const asOf = new Date().toISOString();
  const suggestion = Array.isArray(params.payload?.suggestions) ? params.payload.suggestions[0] : null;
  const decision: 'TRADE' | 'NO_TRADE' =
    suggestion && suggestion.type && suggestion.type !== 'NO_TRADE' ? 'TRADE' : 'NO_TRADE';

  const setupName =
    typeof suggestion?.setup === 'string'
      ? suggestion.setup
      : typeof suggestion?.setupName === 'string'
      ? suggestion.setupName
      : typeof params.payload?.bestSetup?.name === 'string'
      ? params.payload.bestSetup.name
      : null;

  const confidence =
    asNumber(suggestion?.confidence, NaN) ||
    asNumber(params.payload?.meta?.evidence?.verification?.confidence, NaN) ||
    asNumber(params.payload?.meta?.confidence, 0);

  const evidence = params.payload?.meta?.evidence || null;

  return {
    id: newId(),
    asOf,
    source: params.source,
    ticker: String(params.ticker || '').toUpperCase(),
    decision,
    setupName,
    confidence: asNumber(confidence, 0),
    evidence,
    payload: params.payload,
  };
}
