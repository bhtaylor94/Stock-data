import { promises as fs } from 'fs';
import path from 'path';

import type { AutopilotMode } from '@/lib/automationStore';
import type { AutopilotAction } from '@/lib/autopilot';

export type AutomationRunRecord = {
  id: string;
  startedAt: string;
  finishedAt: string;
  ok: boolean;
  mode: AutopilotMode;
  dryRun: boolean;
  presetId?: string;
  minConfidence?: number;
  meta?: any;
  actions: AutopilotAction[];
  error?: string;
};

type RunsFile = {
  version: 1;
  runs: AutomationRunRecord[];
};

function storePath(): string {
  const custom = process.env.AUTOMATION_RUNS_STORE_PATH;
  if (custom && custom.trim()) return custom.trim();
  const base = process.env.VERCEL ? '/tmp' : process.cwd();
  return path.join(base, '.data', 'automation_runs.json');
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

function defaultRunsFile(): RunsFile {
  return { version: 1, runs: [] };
}

export async function listAutomationRuns(limit = 25): Promise<AutomationRunRecord[]> {
  const file = await readJsonFile<RunsFile>(storePath(), defaultRunsFile());
  const n = Math.max(1, Math.min(200, Number(limit || 25)));
  return (file.runs || []).slice(0, n);
}

export async function appendAutomationRun(record: AutomationRunRecord): Promise<void> {
  const filePath = storePath();
  const file = await readJsonFile<RunsFile>(filePath, defaultRunsFile());
  const runs = Array.isArray(file.runs) ? file.runs : [];
  const nextRuns = [record, ...runs].slice(0, 200);
  await atomicWrite(filePath, JSON.stringify({ version: 1, runs: nextRuns }, null, 2));
}
