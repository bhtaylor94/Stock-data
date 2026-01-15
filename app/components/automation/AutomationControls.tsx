'use client';

import React, { useEffect, useMemo, useState } from 'react';
import type { StrategySpec } from '@/strategies/registry';

type AutopilotMode = 'OFF' | 'PAPER' | 'LIVE';

type AutomationConfig = {
  version: 1;
  autopilot: {
    enabled: boolean;
    mode: AutopilotMode;
    presetId: 'conservative' | 'balanced' | 'aggressive';
    minConfidence: number;
    symbols: string[];
    defaultQuantity: number;
    maxNewPositionsPerTick: number;
    cooldownMinutes: number;
    liveArmExpiresAt?: string;
  };
  strategies: Record<string, { enabled: boolean; minConfidence?: number; symbols?: string[] }>;
  updatedAt: string;
};

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="px-2 py-0.5 rounded-full text-xs font-medium border border-slate-700 bg-slate-800/60 text-slate-200">
      {children}
    </span>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="p-5 rounded-2xl border border-slate-700/60 bg-slate-900/30">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          {subtitle ? <p className="text-sm text-slate-400 mt-1">{subtitle}</p> : null}
        </div>
      </div>
      {children}
    </div>
  );
}

export function AutomationControls() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<AutomationConfig | null>(null);
  const [strategies, setStrategies] = useState<StrategySpec[]>([]);
  const [tickResult, setTickResult] = useState<any>(null);
  const [tickLoading, setTickLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');

  const liveArmed = useMemo(() => {
    const exp = config?.autopilot?.liveArmExpiresAt ? new Date(config.autopilot.liveArmExpiresAt).getTime() : 0;
    return Number.isFinite(exp) && exp > Date.now();
  }, [config?.autopilot?.liveArmExpiresAt]);

  const fetchConfig = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/automation/config');
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'Failed to load automation config');
      setConfig(data.config);
      setStrategies(Array.isArray(data.strategies) ? data.strategies : []);
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const patchConfig = async (patch: any) => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch('/api/automation/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'Update failed');
      setConfig(data.config);
      setSuccess('Saved');
      setTimeout(() => setSuccess(''), 1500);
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setSaving(false);
    }
  };

  const runTick = async (dryRun: boolean) => {
    setTickLoading(true);
    setError('');
    try {
      const res = await fetch('/api/automation/tick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun }),
      });
      const data = await res.json();
      if (!data.ok && res.status >= 400) throw new Error(data.error || 'Tick failed');
      setTickResult(data);
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setTickLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="py-10 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!config) {
    return (
      <div className="p-6 rounded-2xl border border-red-500/30 bg-red-500/5 text-red-200">
        Failed to load config. {error ? <span className="text-red-300">{error}</span> : null}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">⚙️ Automation</h2>
          <p className="text-sm text-slate-400 mt-1">
            Strategy-first autopilot controls. Default is <span className="text-slate-200">OFF</span>. Use Paper to forward-test automation.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {success ? <Badge>✓ {success}</Badge> : null}
          {saving ? <Badge>Saving…</Badge> : null}
          <button
            onClick={fetchConfig}
            className="px-3 py-2 rounded-lg border border-slate-700 bg-slate-800/50 text-sm hover:bg-slate-700/50"
          >
            Refresh
          </button>
        </div>
      </div>

      {error ? (
        <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/5 text-red-200 text-sm">{error}</div>
      ) : null}

      <Section
        title="Autopilot Mode"
        subtitle="Controls scan + execution. LIVE is gated by env + a short arm window."
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-700/70 bg-slate-900/30">
            <input
              type="checkbox"
              checked={config.autopilot.enabled}
              onChange={(e) => patchConfig({ autopilot: { enabled: e.target.checked } })}
              className="w-4 h-4"
            />
            <div>
              <div className="font-medium">Enabled</div>
              <div className="text-xs text-slate-400">Master toggle</div>
            </div>
          </label>

          <div className="p-3 rounded-xl border border-slate-700/70 bg-slate-900/30">
            <div className="text-xs text-slate-400 mb-1">Mode</div>
            <select
              value={config.autopilot.mode}
              onChange={(e) => patchConfig({ autopilot: { mode: e.target.value } })}
              className="w-full px-3 py-2 rounded-lg bg-slate-950/40 border border-slate-700 text-sm"
            >
              <option value="OFF">OFF</option>
              <option value="PAPER">PAPER</option>
              <option value="LIVE">LIVE</option>
            </select>
            <div className="text-xs text-slate-500 mt-2">
              Paper will auto-track signals. Live will place market orders.
            </div>
          </div>

          <div className="p-3 rounded-xl border border-slate-700/70 bg-slate-900/30">
            <div className="text-xs text-slate-400 mb-1">Preset</div>
            <select
              value={config.autopilot.presetId}
              onChange={(e) => patchConfig({ autopilot: { presetId: e.target.value } })}
              className="w-full px-3 py-2 rounded-lg bg-slate-950/40 border border-slate-700 text-sm"
            >
              <option value="conservative">Conservative</option>
              <option value="balanced">Balanced</option>
              <option value="aggressive">Aggressive</option>
            </select>
            <div className="text-xs text-slate-500 mt-2">
              Live trading should use locked presets.
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
          <div className="p-3 rounded-xl border border-slate-700/70 bg-slate-900/30">
            <div className="text-xs text-slate-400 mb-1">Min confidence</div>
            <input
              type="number"
              min={0}
              max={100}
              value={config.autopilot.minConfidence}
              onChange={(e) => patchConfig({ autopilot: { minConfidence: Number(e.target.value) } })}
              className="w-full px-3 py-2 rounded-lg bg-slate-950/40 border border-slate-700 text-sm"
            />
          </div>
          <div className="p-3 rounded-xl border border-slate-700/70 bg-slate-900/30">
            <div className="text-xs text-slate-400 mb-1">Default quantity (LIVE)</div>
            <input
              type="number"
              min={1}
              max={10000}
              value={config.autopilot.defaultQuantity}
              onChange={(e) => patchConfig({ autopilot: { defaultQuantity: Number(e.target.value) } })}
              className="w-full px-3 py-2 rounded-lg bg-slate-950/40 border border-slate-700 text-sm"
            />
          </div>
          <div className="p-3 rounded-xl border border-slate-700/70 bg-slate-900/30">
            <div className="text-xs text-slate-400 mb-1">Max new positions / tick</div>
            <input
              type="number"
              min={0}
              max={25}
              value={config.autopilot.maxNewPositionsPerTick}
              onChange={(e) => patchConfig({ autopilot: { maxNewPositionsPerTick: Number(e.target.value) } })}
              className="w-full px-3 py-2 rounded-lg bg-slate-950/40 border border-slate-700 text-sm"
            />
          </div>
          <div className="p-3 rounded-xl border border-slate-700/70 bg-slate-900/30">
            <div className="text-xs text-slate-400 mb-1">Cooldown minutes</div>
            <input
              type="number"
              min={0}
              max={10080}
              value={config.autopilot.cooldownMinutes}
              onChange={(e) => patchConfig({ autopilot: { cooldownMinutes: Number(e.target.value) } })}
              className="w-full px-3 py-2 rounded-lg bg-slate-950/40 border border-slate-700 text-sm"
            />
          </div>
        </div>

        <div className="mt-4 p-3 rounded-xl border border-slate-700/70 bg-slate-900/30">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="font-medium">LIVE Safety</div>
              <div className="text-xs text-slate-400 mt-1">
                LIVE requires <code className="text-slate-200">ALLOW_LIVE_AUTOPILOT=true</code> and an active arm window.
              </div>
            </div>
            <div className="flex items-center gap-2">
              {liveArmed ? <Badge>Armed</Badge> : <Badge>Not armed</Badge>}
              <button
                onClick={() => patchConfig({ action: 'armLive', minutes: 30 })}
                className="px-3 py-2 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-sm hover:bg-emerald-500/25"
              >
                Arm 30m
              </button>
              <button
                onClick={() => patchConfig({ action: 'disarmLive' })}
                className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm hover:bg-red-500/20"
              >
                Disarm
              </button>
            </div>
          </div>
          {config.autopilot.liveArmExpiresAt ? (
            <div className="text-xs text-slate-500 mt-2">Arm expires: {new Date(config.autopilot.liveArmExpiresAt).toLocaleString()}</div>
          ) : null}
        </div>
      </Section>

      <Section
        title="Universe"
        subtitle="Comma-separated tickers. Autopilot evaluates enabled strategies across this list."
      >
        <textarea
          value={(config.autopilot.symbols || []).join(', ')}
          onChange={(e) => patchConfig({ autopilot: { symbols: e.target.value } })}
          rows={3}
          className="w-full px-3 py-2 rounded-xl bg-slate-950/40 border border-slate-700 text-sm"
          placeholder="SPY, QQQ, AAPL, MSFT, NVDA"
        />
        <div className="text-xs text-slate-500 mt-2">Tip: keep this small on Vercel. You can expand on the Optiplex runner later.</div>
      </Section>

      <Section
        title="Strategy Toggles"
        subtitle="Disable strategies you don't want in automation. Optional per-strategy confidence overrides."
      >
        <div className="space-y-3">
          {strategies.map((s) => {
            const sc = config.strategies?.[s.id] || { enabled: true };
            const override = sc.minConfidence;
            return (
              <div key={s.id} className="p-4 rounded-xl border border-slate-700/70 bg-slate-900/30">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={Boolean(sc.enabled)}
                          onChange={(e) =>
                            patchConfig({
                              strategies: {
                                [s.id]: { enabled: e.target.checked },
                              },
                            })
                          }
                          className="w-4 h-4"
                        />
                        <span className="font-semibold">{s.name}</span>
                      </label>
                      <Badge>{s.horizon}</Badge>
                      <Badge>{s.marketRegimes.join(', ')}</Badge>
                    </div>
                    <div className="text-sm text-slate-400 mt-1">{s.shortDescription}</div>
                  </div>

                  <div className="min-w-[180px]">
                    <div className="text-xs text-slate-400 mb-1">Min confidence (override)</div>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={override ?? ''}
                      onChange={(e) =>
                        patchConfig({
                          strategies: {
                            [s.id]: { minConfidence: e.target.value === '' ? undefined : Number(e.target.value) },
                          },
                        })
                      }
                      className="w-full px-3 py-2 rounded-lg bg-slate-950/40 border border-slate-700 text-sm"
                      placeholder={`${config.autopilot.minConfidence}`}
                    />
                    <div className="text-xs text-slate-500 mt-1">Blank = global</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      <Section
        title="Run"
        subtitle="Run a single scan tick. Dry-run previews what would happen without executing paper tracks or live orders."
      >
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => runTick(true)}
            disabled={tickLoading}
            className="px-4 py-2 rounded-lg border border-slate-700 bg-slate-800/50 hover:bg-slate-700/50 text-sm"
          >
            {tickLoading ? 'Running…' : 'Preview (dry-run)'}
          </button>
          <button
            onClick={() => runTick(false)}
            disabled={tickLoading}
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-emerald-500 hover:from-blue-600 hover:to-emerald-600 text-white text-sm"
          >
            {tickLoading ? 'Running…' : 'Execute tick now'}
          </button>
        </div>

        {tickResult ? (
          <div className="mt-4 p-4 rounded-xl border border-slate-700/70 bg-slate-950/30">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-semibold">Last tick</div>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Badge>{String(tickResult.meta?.mode || 'OFF')}</Badge>
                <Badge>{tickResult.meta?.dryRun ? 'DRY' : 'LIVE EXEC'}</Badge>
                <Badge>executed {tickResult.meta?.executed ?? 0}</Badge>
              </div>
            </div>
            <div className="text-xs text-slate-500 mt-2">{JSON.stringify(tickResult.meta)}</div>
            <div className="mt-3 space-y-2">
              {(tickResult.actions || []).slice(0, 25).map((a: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between gap-3 p-2 rounded-lg border border-slate-800 bg-slate-900/40">
                  <div className="text-sm">
                    <span className="font-semibold">{a.symbol || '—'}</span>
                    <span className="text-slate-500"> · {a.strategyId}</span>
                    {a.signal?.confidence !== undefined ? (
                      <span className="text-slate-400"> · {Math.round(Number(a.signal.confidence))}%</span>
                    ) : null}
                  </div>
                  <div className="text-xs text-slate-400">{a.action}</div>
                </div>
              ))}
            </div>
            {(tickResult.actions || []).length > 25 ? (
              <div className="text-xs text-slate-500 mt-2">Showing first 25 actions…</div>
            ) : null}
          </div>
        ) : null}
      </Section>

      <div className="p-4 rounded-xl border border-slate-700/60 bg-slate-900/20 text-sm text-slate-300">
        <div className="font-semibold mb-2">Notes</div>
        <ul className="list-disc pl-5 space-y-1 text-slate-400">
          <li>Autopilot runs only when you click “Execute tick now” (for now). Later you can trigger <code>/api/automation/tick</code> via Vercel Cron or your Optiplex runner.</li>
          <li>Paper mode writes tracked suggestions into the Portfolio tab (Tracker store).</li>
          <li>Live mode places a simple market order and also tracks the signal for auditability.</li>
        </ul>
      </div>
    </div>
  );
}
