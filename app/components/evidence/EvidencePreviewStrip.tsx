'use client';
import React from 'react';
import Card from '@/app/components/core/Card';
import Badge from '@/app/components/core/Badge';

type EvidenceCheck = { name: string; pass: boolean; details?: any };
type EvidencePacket = { hash?: string; checks?: EvidenceCheck[]; notes?: string[] };

function shortHash(h: string): string {
  if (!h) return '';
  if (h.length <= 12) return h;
  return [h.slice(0, 6), '…', h.slice(-4)].join('');
}

function findCheck(checks: EvidenceCheck[], needle: string): EvidenceCheck | null {
  const n = needle.toLowerCase();
  for (const c of checks) {
    const name = String(c?.name || '').toLowerCase();
    if (name.includes(n)) return c;
  }
  return null;
}

export function EvidencePreviewStrip(props: { packet?: EvidencePacket | null; onOpen?: () => void }) {
  const packet = props.packet || null;
  const checks = Array.isArray(packet?.checks) ? packet!.checks! : [];
  const hash = typeof packet?.hash === 'string' ? packet!.hash! : '';

  if (!packet && checks.length === 0 && !hash) return null;

  const freshness = findCheck(checks, 'fresh');
  const completeness = findCheck(checks, 'complete');
  const agreement = findCheck(checks, 'agreement');
  const patterns = findCheck(checks, 'pattern');
  const liquidity = findCheck(checks, 'liquid');
  const uoa = findCheck(checks, 'unusual');

  const items: Array<{ label: string; c: EvidenceCheck | null }> = [
    { label: 'Freshness', c: freshness },
    { label: 'Completeness', c: completeness },
    { label: 'Agreement', c: agreement },
    { label: 'Patterns', c: patterns },
    { label: 'Liquidity', c: liquidity },
    { label: 'UOA', c: uoa },
  ].filter(x => x.c);

  const passCount = checks.filter(c => c && c.pass).length;
  const failCount = checks.filter(c => c && !c.pass).length;

  const copyHash = async () => {
    try {
      if (!hash) return;
      await navigator.clipboard.writeText(hash);
    } catch {
      // ignore
    }
  };

  return (
    <Card className="p-4 mt-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge text={['Checks:', String(passCount), 'pass', failCount ? ['/', String(failCount), 'fail'].join(' ') : ''].join(' ')} className={failCount ? 'bg-red-500/15 border-red-500/25' : 'bg-emerald-500/10 border-emerald-500/20'} />
          {items.slice(0, 5).map((x, idx) => (
            <Badge
              key={[x.label, String(idx)].join('-')}
              text={[x.label, ':', x.c!.pass ? 'Pass' : 'Fail'].join(' ')}
              className={x.c!.pass ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/15 border-red-500/25'}
            />
          ))}
        </div>

        <div className="flex items-center gap-2">
          {hash ? (
            <button onClick={copyHash} className="text-xs px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10">
              {['Hash:', shortHash(hash), '(copy)'].join(' ')}
            </button>
          ) : null}
          {props.onOpen ? (
            <button onClick={props.onOpen} className="text-xs px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10">
              View evidence
            </button>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
