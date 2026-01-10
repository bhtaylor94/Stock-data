export function asString(v: any, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}

export function asNumber(v: any, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function asBool(v: any, fallback = false): boolean {
  return typeof v === 'boolean' ? v : fallback;
}

export function asArray<T = any>(v: any): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

export function pick(obj: any, key: string, fallback: any) {
  if (!obj || typeof obj !== 'object') return fallback;
  return (obj as any)[key] ?? fallback;
}
