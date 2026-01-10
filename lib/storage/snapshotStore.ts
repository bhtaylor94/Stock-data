import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

// sql.js is WASM-based SQLite (no native bindings) -> deploy-safe on Vercel.
// We store the DB in AIHF_DB_PATH (default /tmp/aihf.sqlite). On Vercel this is ephemeral,
// but it's perfect for local dev and for your future Optiplex deployment.
type SqlJsStatic = any;
type SqlDatabase = any;

export type SuggestionSnapshot = {
  id: string;
  asOf: string;
  source: 'stock' | 'options';
  ticker: string;
  decision: 'TRADE' | 'NO_TRADE';
  recommendation?: any;
  evidence?: any;
  setup?: any;
  meta?: any;
};

export interface SnapshotStore {
  saveSnapshot(s: SuggestionSnapshot): Promise<void>;
  listSnapshotsByTicker(ticker: string, limit?: number): Promise<SuggestionSnapshot[]>;
}

function safeJsonParse<T>(s: string, fallback: T): T {
  try { return JSON.parse(s) as T; } catch { return fallback; }
}

function dbPath(): string {
  return process.env.AIHF_DB_PATH || '/tmp/aihf.sqlite';
}

async function loadSqlJs(): Promise<SqlJsStatic> {
  // Dynamic import so Next doesn't try to bundle WASM for the client.
  // locateFile is required so sql.js can find sql-wasm.wasm at runtime.
  const initSqlJs = (await import('sql.js')).default as any;
  const wasmDir = path.dirname(require.resolve('sql.js/dist/sql-wasm.wasm'));
  return initSqlJs({ locateFile: (file: string) => path.join(wasmDir, file) });
}

let _dbPromise: Promise<SqlDatabase> | null = null;

async function getDb(): Promise<SqlDatabase> {
  if (_dbPromise) return _dbPromise;

  _dbPromise = (async () => {
    const SQL = await loadSqlJs();
    const p = dbPath();
    let db: SqlDatabase;

    if (fs.existsSync(p)) {
      const buf = fs.readFileSync(p);
      db = new SQL.Database(new Uint8Array(buf));
    } else {
      db = new SQL.Database();
    }

    db.run(`
      CREATE TABLE IF NOT EXISTS snapshots (
        id TEXT PRIMARY KEY,
        asOf TEXT NOT NULL,
        source TEXT NOT NULL,
        ticker TEXT NOT NULL,
        decision TEXT NOT NULL,
        recommendation TEXT,
        evidence TEXT,
        setup TEXT,
        meta TEXT
      );
    `);

    // Basic index for fast lookup
    db.run(`CREATE INDEX IF NOT EXISTS idx_snapshots_ticker_asof ON snapshots(ticker, asOf);`);

    return db;
  })();

  return _dbPromise;
}

async function persistDb(db: SqlDatabase): Promise<void> {
  const p = dbPath();
  const dir = path.dirname(p);
  try { fs.mkdirSync(dir, { recursive: true }); } catch {}
  const data = db.export();
  fs.writeFileSync(p, Buffer.from(data));
}

function newId(): string {
  // Time-ordered, collision-resistant enough for our needs
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

class SqlJsSnapshotStore implements SnapshotStore {
  async saveSnapshot(s: SuggestionSnapshot): Promise<void> {
    const db = await getDb();
    const id = s.id || newId();

    const stmt = db.prepare(`
      INSERT OR REPLACE INTO snapshots
      (id, asOf, source, ticker, decision, recommendation, evidence, setup, meta)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
    `);

    stmt.run([
      id,
      s.asOf,
      s.source,
      s.ticker.toUpperCase(),
      s.decision,
      s.recommendation ? JSON.stringify(s.recommendation) : null,
      s.evidence ? JSON.stringify(s.evidence) : null,
      s.setup ? JSON.stringify(s.setup) : null,
      s.meta ? JSON.stringify(s.meta) : null,
    ]);
    stmt.free();

    // Persist to disk (best-effort on serverless; durable on Optiplex/local)
    await persistDb(db);
  }

  async listSnapshotsByTicker(ticker: string, limit: number = 50): Promise<SuggestionSnapshot[]> {
    const db = await getDb();
    const stmt = db.prepare(`
      SELECT id, asOf, source, ticker, decision, recommendation, evidence, setup, meta
      FROM snapshots
      WHERE ticker = ?
      ORDER BY asOf DESC
      LIMIT ?;
    `);

    const out: SuggestionSnapshot[] = [];
    stmt.bind([ticker.toUpperCase(), limit]);

    while (stmt.step()) {
      const row = stmt.getAsObject() as any;
      out.push({
        id: String(row.id),
        asOf: String(row.asOf),
        source: row.source === 'options' ? 'options' : 'stock',
        ticker: String(row.ticker),
        decision: row.decision === 'NO_TRADE' ? 'NO_TRADE' : 'TRADE',
        recommendation: row.recommendation ? safeJsonParse(row.recommendation, null) : null,
        evidence: row.evidence ? safeJsonParse(row.evidence, null) : null,
        setup: row.setup ? safeJsonParse(row.setup, null) : null,
        meta: row.meta ? safeJsonParse(row.meta, null) : null,
      });
    }

    stmt.free();
    return out;
  }
}

let _store: SnapshotStore | null = null;

export function getSnapshotStore(): SnapshotStore {
  if (_store) return _store;
  _store = new SqlJsSnapshotStore();
  return _store;
}

export function buildSnapshotFromPayload(params: {
  source: 'stock' | 'options';
  ticker: string;
  payload: any;
}): SuggestionSnapshot {
  const asOf = new Date().toISOString();
  const suggestion = Array.isArray(params.payload?.suggestions) ? params.payload.suggestions[0] : null;
  const decision: 'TRADE' | 'NO_TRADE' = suggestion && suggestion.type && suggestion.type !== 'NO_TRADE' ? 'TRADE' : 'NO_TRADE';

  return {
    id: newId(),
    asOf,
    source: params.source,
    ticker: params.ticker,
    decision,
    recommendation: suggestion,
    evidence: params.payload?.meta?.evidence || params.payload?.evidence || null,
    setup: params.payload?.meta?.setup || params.payload?.setup || null,
    meta: {
      calibration: params.payload?.meta?.calibration || null,
      version: 'phase3-snapshot-v1',
    },
  };
}
