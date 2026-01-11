import crypto from 'crypto';

export type EvidenceCheck = { name: string; pass: boolean; details?: any };

export type EvidencePacket = {
  version: string;
  source: 'stock' | 'options';
  ticker: string;
  asOf: string;
  decision?: any;
  setup?: any;
  datapoints: any;
  checks: EvidenceCheck[];
  notes: string[];
  hash: string;
};

function sortKeysDeep(value: any): any {
  if (Array.isArray(value)) {
    return value.map(sortKeysDeep);
  }
  if (value && typeof value === 'object') {
    const out: any = {};
    for (const k of Object.keys(value).sort()) {
      out[k] = sortKeysDeep(value[k]);
    }
    return out;
  }
  return value;
}

function stableStringify(obj: any): string {
  return JSON.stringify(sortKeysDeep(obj));
}

function sha256Hex(s: string): string {
  return crypto.createHash('sha256').update(s).digest('hex');
}

function asString(v: any, fallback = ''): string {
  if (typeof v === 'string') return v;
  if (v === null || v === undefined) return fallback;
  return String(v);
}

export function buildEvidencePacket(source: 'stock' | 'options', payload: any): EvidencePacket {
  const ticker = asString(payload?.ticker || payload?.symbol, '').toUpperCase();
  const asOf = asString(payload?.meta?.asOf || payload?.asOf || payload?.timestamp, new Date().toISOString());

  // The endpoints already compute a lot of evidence under meta.evidence.
  const evidence = payload?.meta?.evidence || {};

  const checks: EvidenceCheck[] = [];
  const notes: string[] = [];

  // Common checks
  if (payload?.meta?.freshness) {
    checks.push({
      name: 'Data freshness',
      pass: !Boolean(payload.meta.freshness.isStale),
      details: payload.meta.freshness,
    });
  }

  // Stock-specific checks
  if (source === 'stock') {
    if (evidence?.verification) {
      const v = evidence.verification;
      if (typeof v.completenessScore === 'number') {
        // Support both 0..1 and 0..100 scales.
        const cs = v.completenessScore > 1 ? v.completenessScore / 100 : v.completenessScore;
        checks.push({ name: 'Completeness score >= 0.70', pass: cs >= 0.7, details: { raw: v.completenessScore, normalized: cs } });
      }
      if (typeof v.agreementCount === 'number' && typeof v.totalSignals === 'number') {
        const ratio = v.totalSignals > 0 ? v.agreementCount / v.totalSignals : 0;
        checks.push({ name: 'Signal agreement ratio >= 0.45', pass: ratio >= 0.45, details: { agreementCount: v.agreementCount, totalSignals: v.totalSignals, ratio } });
      }
      if (Array.isArray(v.gateFailures) && v.gateFailures.length) {
        notes.push(`Gates failed: ${v.gateFailures.join('; ')}`);
      }
    }
    if (evidence?.patterns) {
      const p = evidence.patterns;
      const confirmed = Array.isArray(p.confirmed) ? p.confirmed.length : 0;
      checks.push({ name: 'At least one confirmed chart pattern', pass: confirmed > 0, details: { confirmed } });
    }
  }

  // Options-specific checks
  if (source === 'options') {
    if (evidence?.liquidityEvidence) {
      const le = evidence.liquidityEvidence;
      checks.push({
        name: 'Liquidity check (spread/OI/volume)',
        pass: Boolean(le.liquidityOk),
        details: le,
      });
    }
    if (evidence?.unusualOptions) {
      const u = evidence.unusualOptions;
      const unusual = Boolean(u?.isUnusual);
      checks.push({ name: 'Unusual options activity present', pass: unusual, details: u });
    }
  }

  const packetBody = {
    version: '1.0.0',
    source,
    ticker,
    asOf,
    decision: payload?.analysis?.recommendation || payload?.recommendation || null,
    setup: payload?.analysis?.setup || payload?.setup || null,
    datapoints: {
      // Keep raw evidence, but avoid duplicating huge arrays when possible.
      indicators: evidence?.indicators || null,
      levels: evidence?.levels || null,
      patterns: evidence?.patterns || null,
      options: evidence?.options || null,
      liquidityEvidence: evidence?.liquidityEvidence || null,
      unusualOptions: evidence?.unusualOptions || null,
      fundamentals: evidence?.fundamentals || null,
      valuation: evidence?.valuation || null,
    },
    checks,
    notes,
  };

  const hash = sha256Hex(stableStringify(packetBody));

  return {
    ...packetBody,
    hash,
  };
}
