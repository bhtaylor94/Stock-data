'use client';
import React, { useEffect, useMemo, useState } from 'react';
import Card from '@/app/components/core/Card';
import Badge from '@/app/components/core/Badge';

type CalibrationBucket = { count: number; wins: number; losses: number; winRate: number; avgPnlPct: number };
type CalibrationSetup = CalibrationBucket & { setup?: string };
type HorizonRow = { count: number; avgReturnPct: number };
type CalibrationResponse = {
  totalTracked: number;
  realizedCount: number;
  byBucket: Record<string, CalibrationBucket>;
  bySetup: Record<string, CalibrationSetup>;
  horizonReturns: Record<string, HorizonRow>;
  note?: string;
};

function pct(v: number): string {
  const n = Number(v);
  if (!Number.isFinite(n)) return '0.0%';
  return [n.toFixed(1), '%'].join('');
}

function fmt(v: number): string {
  const n = Number(v);
  if (!Number.isFinite(n)) return '0.00';
  return n.toFixed(2);
}

export function PerformancePanel() {
  const [loading, setLoading] = useState(false);
  const [cal, setCal] = useState<CalibrationResponse | null>(null);
  const [err, setErr] = useState<string>('');

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setErr('');
      try {
        const res = await fetch('/api/calibration');
        const data = await res.json();
        if (!alive) return;
        if (!res.ok) {
          setErr(String(data?.error || 'Failed to load calibration'));
          setCal(null);
        } else {
          setCal(data as CalibrationResponse);
        }
      } catch (e: any) {
        if (!alive) return;
        setErr(String(e?.message || e || 'Failed to load calibration'));
        setCal(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const buckets = useMemo(() => {
    const byBucket = cal?.byBucket || {};
    const order = ['HIGH', 'MED', 'LOW', 'N/A'];
    return order.filter(k => byBucket[k]).map(k => ({ key: k, ...byBucket[k] }));
  }, [cal]);

  const topSetups = useMemo(() => {
    const bySetup = cal?.bySetup || {};
    const rows = Object.keys(bySetup).map(k => ({ key: k, ...bySetup[k] }));
    rows.sort((a, b) => (b.count || 0) - (a.count || 0));
    return rows.slice(0, 8);
  }, [cal]);

  const horizons = useMemo(() => {
    const h = cal?.horizonReturns || {};
    const keys = Object.keys(h);
    keys.sort((a, b) => {
      const na = Number(String(a).replace('d', ''));
      const nb = Number(String(b).replace('d', ''));
      return na - nb;
    });
    return keys.map(k => ({ key: k, ...h[k] }));
  }, [cal]);

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-lg font-semibold">Performance</div>
            <div className="text-sm text-white/70">
              {cal ? ['Tracked:', String(cal.totalTracked), '• Realized:', String(cal.realizedCount)].join(' ') : 'Calibration summary from tracked suggestions.'}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {loading ? <Badge text="Loading…" /> : null}
            {err ? <Badge text="Error" className="bg-red-500/15 border-red-500/25" /> : null}
          </div>
        </div>
        {err ? <div className="mt-3 text-sm text-red-200/90">{err}</div> : null}
        {cal?.note ? <div className="mt-3 text-xs text-white/60">{cal.note}</div> : null}
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-5">
          <div className="text-sm font-semibold mb-3">By confidence bucket</div>
          <div className="space-y-2">
            {buckets.map(b => (
              <div key={b.key} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Badge text={b.key} />
                  <span className="text-sm text-white/70">{['N=', String(b.count)].join('')}</span>
                </div>
                <div className="text-sm">
                  {['Win:', pct((b.winRate || 0) * 100), '• Avg PnL:', pct(b.avgPnlPct || 0)].join(' ')}
                </div>
              </div>
            ))}
            {buckets.length === 0 ? <div className="text-sm text-white/60">No tracked outcomes yet.</div> : null}
          </div>
        </Card>

        <Card className="p-5">
          <div className="text-sm font-semibold mb-3">Top setups (by sample size)</div>
          <div className="space-y-2">
            {topSetups.map(s => (
              <div key={s.key} className="flex items-center justify-between gap-3">
                <div className="text-sm">{s.key}</div>
                <div className="text-sm text-white/80">
                  {['N=', String(s.count || 0), '• Win', pct((s.winRate || 0) * 100), '• Avg', pct(s.avgPnlPct || 0)].join(' ')}
                </div>
              </div>
            ))}
            {topSetups.length === 0 ? <div className="text-sm text-white/60">No setup stats yet.</div> : null}
          </div>
        </Card>
      </div>

      <Card className="p-5">
        <div className="text-sm font-semibold mb-3">Horizon returns (stock, best-effort)</div>
        <div className="flex flex-wrap gap-2">
          {horizons.map(h => (
            <Badge key={h.key} text={[h.key.toUpperCase(), ':', pct(h.avgReturnPct || 0), '(', String(h.count || 0), ')'].join(' ')} className="bg-white/5" />
          ))}
          {horizons.length === 0 ? <div className="text-sm text-white/60">No horizon data yet.</div> : null}
        </div>
      </Card>
    </div>
  );
}
