'use client';

import React, { useEffect, useMemo, useState } from 'react';

type AutomationConfigResponse = { ok: boolean; config?: any; error?: string };

function num(v: any, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-semibold text-slate-300">{label}</div>
      {children}
      {hint ? <div className="text-[11px] text-slate-400">{hint}</div> : null}
    </div>
  );
}

export default function SettingsPage() {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string>('');
  const [okMsg, setOkMsg] = useState<string>('');
  const [cfg, setCfg] = useState<any>(null);

  const [executionInstrument, setExecutionInstrument] = useState<'STOCK' | 'OPTION'>('STOCK');
  const [maxPremiumNotionalUSD, setMaxPremiumNotionalUSD] = useState<number>(600);
  const [takeProfitPct, setTakeProfitPct] = useState<number>(0.1);
  const [stopLossPct, setStopLossPct] = useState<number>(0.1);
  const [maxContractsPerTrade, setMaxContractsPerTrade] = useState<number>(3);
  const [sizeByBudget, setSizeByBudget] = useState<boolean>(true);
  const [timeStopEnabled, setTimeStopEnabled] = useState<boolean>(true);
  const [timeStopMinutes, setTimeStopMinutes] = useState<number>(120);

  async function load() {
    setErr('');
    setOkMsg('');
    try {
      const r = await fetch('/api/automation/config', { cache: 'no-store' });
      const j = (await r.json()) as AutomationConfigResponse;
      if (!j.ok) throw new Error(j.error || 'Failed to load');
      const c = j.config || null;
      setCfg(c);
      const ap = c?.autopilot || {};
      setExecutionInstrument((ap.executionInstrument || 'STOCK') === 'OPTION' ? 'OPTION' : 'STOCK');
      const opt = ap.options || {};
      setMaxPremiumNotionalUSD(num(opt.maxPremiumNotionalUSD, 600));
      setTakeProfitPct(num(opt.takeProfitPct, 0.1));
      setStopLossPct(num(opt.stopLossPct, 0.1));
      setMaxContractsPerTrade(num(opt.maxContractsPerTrade, 3));
      setSizeByBudget(Boolean(opt.sizeByBudget ?? true));
      const tsm = num(opt.timeStopMinutes, 120);
      setTimeStopEnabled(tsm > 0);
      setTimeStopMinutes(tsm > 0 ? tsm : 120);
    } catch (e: any) {
      setErr(String(e?.message || e));
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const mode = useMemo(() => String(cfg?.autopilot?.mode || 'OFF'), [cfg]);

  async function save() {
    setLoading(true);
    setErr('');
    setOkMsg('');
    try {
      const payload: any = {
        autopilot: {
          executionInstrument,
          options: {
            maxPremiumNotionalUSD: Math.max(0, maxPremiumNotionalUSD),
            takeProfitPct: Math.max(0, takeProfitPct),
            stopLossPct: Math.max(0, stopLossPct),
            maxContractsPerTrade: Math.max(1, Math.floor(maxContractsPerTrade)),
            sizeByBudget: Boolean(sizeByBudget),
            timeStopMinutes: timeStopEnabled ? Math.max(1, Math.floor(timeStopMinutes)) : 0,
          },
        },
      };

      const r = await fetch('/api/automation/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || 'Save failed');
      setOkMsg('Saved.');
      await load();
    } catch (e: any) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/20 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-lg font-black">Settings</div>
            <div className="text-sm text-slate-400">
              Paper settings are editable. Live trading has safety gates (ALLOW_LIVE_AUTOPILOT + arm window).
            </div>
          </div>
          <button
            onClick={save}
            disabled={loading}
            className="text-xs font-bold px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-60"
          >
            {loading ? 'Saving…' : 'Save'}
          </button>
        </div>

        {err ? <div className="mt-3 text-xs text-red-300">{err}</div> : null}
        {okMsg ? <div className="mt-3 text-xs text-emerald-300">{okMsg}</div> : null}

        <div className="mt-4 flex flex-wrap gap-2">
          <div className="px-3 py-2 rounded-xl border border-slate-800 bg-slate-900/30">
            <div className="text-xs text-slate-400">Autopilot mode</div>
            <div className="text-xs font-semibold">{mode}</div>
          </div>
          <div className="px-3 py-2 rounded-xl border border-slate-800 bg-slate-900/30">
            <div className="text-xs text-slate-400">Live gate</div>
            <div className="text-xs font-semibold">ALLOW_LIVE_AUTOPILOT=true required</div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/20 p-5">
        <div className="text-sm font-bold">Execution strategy</div>
        <div className="text-xs text-slate-400">Options are execution expressions of the same strategy signals.</div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Execution instrument">
            <select
              value={executionInstrument}
              onChange={(e) => setExecutionInstrument(e.target.value === 'OPTION' ? 'OPTION' : 'STOCK')}
              className="w-full px-3 py-2 rounded-lg bg-slate-950/40 border border-slate-800 text-sm"
            >
              <option value="STOCK">STOCK (shares)</option>
              <option value="OPTION">OPTION (contracts)</option>
            </select>
          </Field>

          <Field
            label="Max spend per options trade (premium)"
            hint="Hard cap in USD. Used for sizing and safety. Example: $600."
          >
            <input
              type="number"
              value={maxPremiumNotionalUSD}
              onChange={(e) => setMaxPremiumNotionalUSD(num(e.target.value, 600))}
              className="w-full px-3 py-2 rounded-lg bg-slate-950/40 border border-slate-800 text-sm"
            />
          </Field>

          <Field label="Profit take %" hint="Example: 10% means sell when option premium is +10% vs entry.">
            <input
              type="number"
              step="0.01"
              value={takeProfitPct}
              onChange={(e) => setTakeProfitPct(num(e.target.value, 0.1))}
              className="w-full px-3 py-2 rounded-lg bg-slate-950/40 border border-slate-800 text-sm"
            />
          </Field>

          <Field label="Stop loss %" hint="Example: 10% means sell when option premium is -10% vs entry.">
            <input
              type="number"
              step="0.01"
              value={stopLossPct}
              onChange={(e) => setStopLossPct(num(e.target.value, 0.1))}
              className="w-full px-3 py-2 rounded-lg bg-slate-950/40 border border-slate-800 text-sm"
            />
          </Field>

          <Field label="Max contracts" hint="Safety cap. Quantity is sized by budget, up to this cap.">
            <input
              type="number"
              value={maxContractsPerTrade}
              onChange={(e) => setMaxContractsPerTrade(num(e.target.value, 3))}
              className="w-full px-3 py-2 rounded-lg bg-slate-950/40 border border-slate-800 text-sm"
            />
          </Field>

          <Field label="Sizing mode">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={sizeByBudget}
                onChange={(e) => setSizeByBudget(e.target.checked)}
              />
              <span className="text-slate-200">Size contracts to fit budget (recommended)</span>
            </label>
          </Field>

          <Field label="Time stop" hint="Closes the position after N minutes in trade.">
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={timeStopEnabled}
                  onChange={(e) => setTimeStopEnabled(e.target.checked)}
                />
                <span className="text-slate-200">Enabled</span>
              </label>
              <input
                type="number"
                value={timeStopMinutes}
                onChange={(e) => setTimeStopMinutes(num(e.target.value, 120))}
                disabled={!timeStopEnabled}
                className="w-32 px-3 py-2 rounded-lg bg-slate-950/40 border border-slate-800 text-sm disabled:opacity-50"
              />
              <span className="text-xs text-slate-400">minutes</span>
            </div>
          </Field>
        </div>
      </div>
    </div>
  );
}
