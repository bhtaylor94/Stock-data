'use client';

import React, { useEffect, useMemo, useState } from 'react';
import type { StrategySpec } from '@/strategies/registry';

type AutopilotMode = 'OFF' | 'PAPER' | 'LIVE' | 'LIVE_CONFIRM';

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

    enableRegimeGate: boolean;
    signalDedupMinutes: number;
    dedupMinConfidenceDelta: number;

    maxOpenPositionsTotal: number;
    maxOpenPositionsPerSymbol: number;
    maxTradesPerDay: number;
    maxNotionalPerTradeUSD: number;

    requireMarketHours: boolean;
    noTradeWindows: { startHHMM: string; endHHMM: string; label?: string }[];

    requireLiveAllowlist: boolean;
    liveAllowlistSymbols: string[];

    // Trade lifecycle manager
    manageOpenTradesEnabled: boolean;
    timeStopDays: number;
    enableTrailingStop: boolean;
    trailAfterR: number;
    trailLockInR: number;

    // Kill switch (halts NEW entries)
    haltNewEntries?: boolean;
    haltReason?: string;
    haltSetAt?: string;

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
  const [runs, setRuns] = useState<any[]>([]);
  const [runsLoading, setRunsLoading] = useState(false);
  const [pendingApprovals, setPendingApprovals] = useState<any[]>([]);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [pendingActionLoading, setPendingActionLoading] = useState<string>('');
  const [alertsConfig, setAlertsConfig] = useState<any>(null);
  const [alertsEvents, setAlertsEvents] = useState<any[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [alertsSaving, setAlertsSaving] = useState(false);


  const [summary, setSummary] = useState<any>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [tickLoading, setTickLoading] = useState(false);
  const [lifecycleLoading, setLifecycleLoading] = useState(false);
  const [lifecycleResult, setLifecycleResult] = useState<any>(null);
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

  const fetchRuns = async () => {
    setRunsLoading(true);
    try {
      const res = await fetch('/api/automation/runs?limit=25');
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'Failed to load runs');
      setRuns(Array.isArray(data.runs) ? data.runs : []);
    } catch {
      // do not spam global error for runs
    } finally {
      setRunsLoading(false);
    }

  };


  const fetchPending = async () => {
    setPendingLoading(true);
    try {
      const res = await fetch('/api/automation/pending');
      const data = await res.json();
      if (data?.ok) setPendingApprovals(Array.isArray(data.pending) ? data.pending : []);
    } catch {
      // quiet
    } finally {
      setPendingLoading(false);
    }
  };

  const fetchSummary = async () => {
    setSummaryLoading(true);
    try {
      const res = await fetch('/api/automation/summary?scope=autopilot');
      const data = await res.json();
      if (data?.ok) setSummary(data.summary);
    } catch {
      // quiet
    } finally {
      setSummaryLoading(false);
    }
  };

  const fetchAlerts = async () => {
    setAlertsLoading(true);
    try {
      const [cfgRes, inboxRes] = await Promise.all([
        fetch("/api/alerts/config"),
        fetch("/api/alerts/inbox?limit=50"),
      ]);
      const cfg = await cfgRes.json();
      const inbox = await inboxRes.json();
      if (cfg?.ok) setAlertsConfig(cfg.config);
      if (inbox?.ok) setAlertsEvents(Array.isArray(inbox.events) ? inbox.events : []);
    } catch {
      // quiet
    } finally {
      setAlertsLoading(false);
    }
  };

  const patchAlertsConfig = async (patch: any) => {
    setAlertsSaving(true);
    try {
      const res = await fetch("/api/alerts/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (data?.ok) {
        setAlertsConfig(data.config);
        fetchAlerts();
      }
    } finally {
      setAlertsSaving(false);
    }
  };

  const clearAlerts = async () => {
    setAlertsLoading(true);
    try {
      await fetch("/api/alerts/inbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "CLEAR" }),
      });
      await fetchAlerts();
    } finally {
      setAlertsLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
    fetchRuns();
    fetchPending();
    fetchSummary();
    fetchAlerts();
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
      fetchRuns();
      fetchSummary();
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setTickLoading(false);
    }
  };



  const actOnPending = async (id: string, action: 'APPROVE' | 'DECLINE') => {
    setPendingActionLoading(id + ':' + action);
    setError('');
    try {
      const res = await fetch('/api/automation/pending', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'Action failed');
      await fetchPending();
      await fetchRuns();
      await fetchSummary();
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setPendingActionLoading('');
    }
  };
  const runLifecycle = async (dryRun: boolean) => {
    setLifecycleLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/automation/lifecycle?dryRun=${dryRun ? 'true' : 'false'}`);
      const data = await res.json();
      if (!data.ok && res.status >= 400) throw new Error(data.error || 'Lifecycle run failed');
      setLifecycleResult(data);
      fetchRuns();
      fetchSummary();
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setLifecycleLoading(false);
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
          <button
            onClick={fetchRuns}
            className="px-3 py-2 rounded-lg border border-slate-700 bg-slate-800/50 text-sm hover:bg-slate-700/50"
          >
            Runs
          </button>
          <button
            onClick={fetchSummary}
            className="px-3 py-2 rounded-lg border border-slate-700 bg-slate-800/50 text-sm hover:bg-slate-700/50"
          >
            Risk
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
              <option value="LIVE_CONFIRM">LIVE (Confirm)</option>
            </select>
            <div className="text-xs text-slate-500 mt-2">
              Paper will auto-track signals. LIVE places market orders. LIVE (Confirm) queues orders for approval.
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

        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-700/70 bg-slate-900/30">
            <input
              type="checkbox"
              checked={Boolean(config.autopilot.enableRegimeGate)}
              onChange={(e) => patchConfig({ autopilot: { enableRegimeGate: e.target.checked } })}
              className="w-4 h-4"
            />
            <div>
              <div className="font-medium">Regime gating</div>
              <div className="text-xs text-slate-400">Only run a strategy when its allowed market regime is detected.</div>
            </div>
          </label>

          <div className="p-3 rounded-xl border border-slate-700/70 bg-slate-900/30">
            <div className="text-xs text-slate-400 mb-1">Signal dedup minutes</div>
            <input
              type="number"
              min={0}
              max={10080}
              value={config.autopilot.signalDedupMinutes}
              onChange={(e) => patchConfig({ autopilot: { signalDedupMinutes: Number(e.target.value) } })}
              className="w-full px-3 py-2 rounded-lg bg-slate-950/40 border border-slate-700 text-sm"
            />
            <div className="text-xs text-slate-500 mt-2">Suppress repeat signals within this window unless confidence improves.</div>
          </div>

          <div className="p-3 rounded-xl border border-slate-700/70 bg-slate-900/30">
            <div className="text-xs text-slate-400 mb-1">Dedup confidence delta</div>
            <input
              type="number"
              min={0}
              max={50}
              value={config.autopilot.dedupMinConfidenceDelta}
              onChange={(e) => patchConfig({ autopilot: { dedupMinConfidenceDelta: Number(e.target.value) } })}
              className="w-full px-3 py-2 rounded-lg bg-slate-950/40 border border-slate-700 text-sm"
            />
            <div className="text-xs text-slate-500 mt-2">Example: 5 = only re-alert if confidence rises by 5+.</div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="p-3 rounded-xl border border-slate-700/70 bg-slate-900/30">
            <div className="text-xs text-slate-400 mb-1">Max open positions (total)</div>
            <input
              type="number"
              min={0}
              max={250}
              value={config.autopilot.maxOpenPositionsTotal}
              onChange={(e) => patchConfig({ autopilot: { maxOpenPositionsTotal: Number(e.target.value) } })}
              className="w-full px-3 py-2 rounded-lg bg-slate-950/40 border border-slate-700 text-sm"
            />
          </div>
          <div className="p-3 rounded-xl border border-slate-700/70 bg-slate-900/30">
            <div className="text-xs text-slate-400 mb-1">Max open positions (per symbol)</div>
            <input
              type="number"
              min={0}
              max={50}
              value={config.autopilot.maxOpenPositionsPerSymbol}
              onChange={(e) => patchConfig({ autopilot: { maxOpenPositionsPerSymbol: Number(e.target.value) } })}
              className="w-full px-3 py-2 rounded-lg bg-slate-950/40 border border-slate-700 text-sm"
            />
          </div>
          <div className="p-3 rounded-xl border border-slate-700/70 bg-slate-900/30">
            <div className="text-xs text-slate-400 mb-1">Max trades / day</div>
            <input
              type="number"
              min={0}
              max={500}
              value={config.autopilot.maxTradesPerDay}
              onChange={(e) => patchConfig({ autopilot: { maxTradesPerDay: Number(e.target.value) } })}
              className="w-full px-3 py-2 rounded-lg bg-slate-950/40 border border-slate-700 text-sm"
            />
          </div>
          <div className="p-3 rounded-xl border border-slate-700/70 bg-slate-900/30">
            <div className="text-xs text-slate-400 mb-1">Max notional / trade (USD)</div>
            <input
              type="number"
              min={0}
              max={10000000}
              value={config.autopilot.maxNotionalPerTradeUSD}
              onChange={(e) => patchConfig({ autopilot: { maxNotionalPerTradeUSD: Number(e.target.value) } })}
              className="w-full px-3 py-2 rounded-lg bg-slate-950/40 border border-slate-700 text-sm"
            />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-700/70 bg-slate-900/30">
            <input
              type="checkbox"
              checked={Boolean(config.autopilot.requireMarketHours)}
              onChange={(e) => patchConfig({ autopilot: { requireMarketHours: e.target.checked } })}
              className="w-4 h-4"
            />
            <div>
              <div className="font-medium">Market hours only</div>
              <div className="text-xs text-slate-400">Blocks ticks outside 9:30–16:00 ET</div>
            </div>
          </label>

          <div className="p-3 rounded-xl border border-slate-700/70 bg-slate-900/30 md:col-span-2">
            <div className="text-xs text-slate-400 mb-1">No-trade windows (ET)</div>
            <input
              type="text"
              value={(config.autopilot.noTradeWindows || []).map((w) => `${w.startHHMM}-${w.endHHMM}`).join(', ')}
              onChange={(e) => patchConfig({ autopilot: { noTradeWindows: e.target.value } })}
              className="w-full px-3 py-2 rounded-lg bg-slate-950/40 border border-slate-700 text-sm"
              placeholder="09:30-09:35, 15:55-16:00"
            />
            <div className="text-xs text-slate-500 mt-1">Comma-separated time ranges</div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-700/70 bg-slate-900/30">
            <input
              type="checkbox"
              checked={Boolean(config.autopilot.requireLiveAllowlist)}
              onChange={(e) => patchConfig({ autopilot: { requireLiveAllowlist: e.target.checked } })}
              className="w-4 h-4"
            />
            <div>
              <div className="font-medium">LIVE allowlist required</div>
              <div className="text-xs text-slate-400">Blocks LIVE execution unless the symbol is allowlisted</div>
            </div>
          </label>

          <div className="p-3 rounded-xl border border-slate-700/70 bg-slate-900/30 md:col-span-2">
            <div className="text-xs text-slate-400 mb-1">LIVE allowlist symbols</div>
            <input
              type="text"
              value={(config.autopilot.liveAllowlistSymbols || []).join(', ')}
              onChange={(e) => patchConfig({ autopilot: { liveAllowlistSymbols: e.target.value } })}
              className="w-full px-3 py-2 rounded-lg bg-slate-950/40 border border-slate-700 text-sm"
              placeholder="SPY, QQQ"
            />
            <div className="text-xs text-slate-500 mt-1">Comma-separated tickers</div>
          </div>
        </div>

        <div className="mt-4 p-3 rounded-xl border border-slate-700/70 bg-slate-900/30">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="font-medium">LIVE Safety</div>
              <div className="text-xs text-slate-400 mt-1">
                LIVE requires <code className="text-slate-200">ALLOW_LIVE_AUTOPILOT=true</code>, an active arm window, and passes risk gates (market-hours, caps, allowlist).
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
        title="Pending approvals"
        subtitle="Only used in LIVE (Confirm) mode. Approve places a live market order and tracks it."
      >
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="text-sm text-slate-400">{pendingLoading ? 'Loading…' : `${pendingApprovals.length} pending`}</div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchPending}
              className="px-3 py-2 rounded-lg border border-slate-700 bg-slate-800/50 text-sm hover:bg-slate-700/50"
            >
              Refresh
            </button>
          </div>
        </div>

        {config.autopilot.mode !== 'LIVE_CONFIRM' ? (
          <div className="text-sm text-slate-400">
            Set mode to <span className="text-slate-200">LIVE (Confirm)</span> to queue approvals.
          </div>
        ) : null}

        {pendingApprovals.length ? (
          <div className="space-y-3">
            {pendingApprovals.map((p: any) => (
              <div key={p.id} className="p-4 rounded-xl border border-slate-700/70 bg-slate-900/30">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-white">
                      {p.symbol} <span className="text-slate-400 font-normal">•</span> <span className="text-slate-200">{p.signal?.strategyName || p.strategyId}</span>
                    </div>
                    <div className="text-xs text-slate-400 mt-1">
                      {p.action} {p.quantity} • conf {Number(p.signal?.confidence || 0).toFixed(0)} • est ${Number(p.estimatedNotionalUSD || 0).toFixed(0)}
                    </div>
                    {p.executionInstrument === 'OPTION' && p.selectedOptionContract ? (
                      <div className="text-xs text-slate-500 mt-1">
                        OPTION • {String(p.selectedOptionContract.expiration || '')} • {Number(p.selectedOptionContract.strike || 0).toFixed(2)}
                        {String(p.selectedOptionContract.optionType || '').toUpperCase().startsWith('C') ? 'C' : 'P'}
                        <span className="text-slate-600"> • </span>
                        {String(p.selectedOptionContract.optionSymbol || '')}
                      </div>
                    ) : null}
                    <div className="text-xs text-slate-500 mt-2">
                      {Array.isArray(p.signal?.why) ? p.signal.why.slice(0, 3).join(' • ') : ''}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      disabled={pendingActionLoading === p.id + ':DECLINE'}
                      onClick={() => actOnPending(p.id, 'DECLINE')}
                      className="px-3 py-2 rounded-lg border border-slate-700 bg-slate-950/40 text-sm hover:bg-slate-800/50 disabled:opacity-60"
                    >
                      Decline
                    </button>
                    <button
                      disabled={pendingActionLoading === p.id + ':APPROVE'}
                      onClick={() => actOnPending(p.id, 'APPROVE')}
                      className="px-3 py-2 rounded-lg border border-emerald-700 bg-emerald-700/10 text-sm hover:bg-emerald-700/20 disabled:opacity-60"
                    >
                      Approve
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-slate-400">No pending approvals.</div>
        )}
      </Section>
      <Section
        title="Risk Summary"
        subtitle="Read-only snapshot (autopilot trades). Use this to monitor exposure and PnL at a glance."
      >
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {summaryLoading ? <Badge>Loading…</Badge> : null}
          {summary?.asOf ? <Badge>As of {new Date(summary.asOf).toLocaleString()}</Badge> : null}
          {summary?.killSwitch?.enabled ? <Badge>⛔ Halted</Badge> : <Badge>✅ Entries allowed</Badge>}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-3 rounded-xl border border-slate-700/70 bg-slate-900/30">
            <div className="text-xs text-slate-400">Open positions</div>
            <div className="text-2xl font-bold text-white mt-1">{summary?.openPositions?.total ?? '—'}</div>
            <div className="text-xs text-slate-500 mt-1">Autopilot ACTIVE trades</div>
          </div>
          <div className="p-3 rounded-xl border border-slate-700/70 bg-slate-900/30">
            <div className="text-xs text-slate-400">Unrealized PnL</div>
            <div className="text-2xl font-bold text-white mt-1">
              {typeof summary?.pnl?.unrealizedUSD === 'number' ? summary.pnl.unrealizedUSD.toFixed(0) : '—'}
            </div>
            <div className="text-xs text-slate-500 mt-1">USD (best-effort)</div>
          </div>
          <div className="p-3 rounded-xl border border-slate-700/70 bg-slate-900/30">
            <div className="text-xs text-slate-400">Realized PnL</div>
            <div className="text-2xl font-bold text-white mt-1">
              {typeof summary?.pnl?.realizedTodayUSD === 'number' ? summary.pnl.realizedTodayUSD.toFixed(0) : '—'}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              Today · 7d: {typeof summary?.pnl?.realized7dUSD === 'number' ? summary.pnl.realized7dUSD.toFixed(0) : '—'}
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-3 rounded-xl border border-slate-700/70 bg-slate-900/20">
            <div className="text-sm font-semibold text-white mb-2">Exposure (by symbol)</div>
            <div className="text-xs text-slate-400">Gross notional: {typeof summary?.exposure?.grossNotionalUSD === 'number' ? summary.exposure.grossNotionalUSD.toFixed(0) : '—'}</div>
            <div className="mt-2 space-y-1">
              {summary?.exposure?.bySymbolUSD
                ? Object.entries(summary.exposure.bySymbolUSD)
                    .sort((a: any, b: any) => Number(b[1]) - Number(a[1]))
                    .slice(0, 8)
                    .map(([sym, val]: any) => (
                      <div key={sym} className="flex items-center justify-between text-sm">
                        <span className="text-slate-200">{sym}</span>
                        <span className="text-slate-400">{Number(val).toFixed(0)}</span>
                      </div>
                    ))
                : <div className="text-sm text-slate-500">No active exposure.</div>}
            </div>
          </div>

          <div className="p-3 rounded-xl border border-slate-700/70 bg-slate-900/20">
            <div className="text-sm font-semibold text-white mb-2">Open positions (by strategy)</div>
            <div className="mt-1 space-y-1">
              {summary?.openPositions?.byStrategy
                ? Object.entries(summary.openPositions.byStrategy)
                    .sort((a: any, b: any) => Number(b[1]) - Number(a[1]))
                    .slice(0, 8)
                    .map(([k, v]: any) => (
                      <div key={k} className="flex items-center justify-between text-sm">
                        <span className="text-slate-200">{String(k)}</span>
                        <span className="text-slate-400">{Number(v)}</span>
                      </div>
                    ))
                : <div className="text-sm text-slate-500">No active trades.</div>}
            </div>
          </div>
        </div>
      </Section>

      <Section
        title="Kill Switch"
        subtitle="Halts NEW entries immediately. Lifecycle exits can still run (target/stop/time-stop)."
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-700/70 bg-slate-900/30">
            <input
              type="checkbox"
              checked={Boolean(config.autopilot.haltNewEntries)}
              onChange={(e) => patchConfig({ autopilot: { haltNewEntries: e.target.checked } })}
              className="w-4 h-4"
            />
            <div>
              <div className="font-medium">Halt new entries</div>
              <div className="text-xs text-slate-400">Immediate</div>
            </div>
          </label>

          <div className="md:col-span-2 p-3 rounded-xl border border-slate-700/70 bg-slate-900/30">
            <div className="text-xs text-slate-400 mb-1">Halt reason (optional)</div>
            <input
              value={config.autopilot.haltReason || ''}
              onChange={(e) => patchConfig({ autopilot: { haltReason: e.target.value } })}
              placeholder="e.g., volatility spike / news risk / manual pause"
              className="w-full px-3 py-2 rounded-lg bg-slate-950/40 border border-slate-700 text-sm"
            />
            {config.autopilot.haltSetAt ? (
              <div className="text-xs text-slate-500 mt-2">Set at: {new Date(config.autopilot.haltSetAt).toLocaleString()}</div>
            ) : null}
          </div>
        </div>
      </Section>

      <Section
        title="Recent runs"
        subtitle="Audit log of the most recent autopilot ticks (best-effort; stored locally in this deployment)."
      >
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="text-xs text-slate-500">
            {runsLoading ? 'Loading…' : `Showing ${runs.length} / 25`}
          </div>
          <button
            onClick={fetchRuns}
            className="px-3 py-2 rounded-lg border border-slate-700 bg-slate-800/50 text-sm hover:bg-slate-700/50"
          >
            Refresh runs
          </button>
        </div>

        {runs.length === 0 ? (
          <div className="text-sm text-slate-400">No runs yet. Use “Preview” or “Execute tick now”.</div>
        ) : (
          <div className="space-y-2">
            {runs.map((r: any) => {
              const ok = Boolean(r.ok);
              const started = r.startedAt ? new Date(r.startedAt).toLocaleString() : '';
              const executed = r.meta?.executed ?? 0;
              const candidates = r.meta?.candidates ?? 0;
              return (
                <details key={r.id} className="group p-3 rounded-xl border border-slate-700/70 bg-slate-950/20">
                  <summary className="cursor-pointer list-none flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${ok ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200' : 'border-red-500/40 bg-red-500/10 text-red-200'}`}> 
                        {ok ? 'OK' : 'ERROR'}
                      </span>
                      <span className="text-sm font-semibold text-slate-100">{r.mode}</span>
                      <span className="text-xs text-slate-400">{r.dryRun ? 'DRY' : 'EXEC'}</span>
                      <span className="text-xs text-slate-500">{started}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <Badge>candidates {candidates}</Badge>
                      <Badge>executed {executed}</Badge>
                    </div>
                  </summary>

                  {r.error ? <div className="mt-2 text-sm text-red-300">{r.error}</div> : null}

                  <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                    {(r.actions || []).slice(0, 12).map((a: any, idx: number) => (
                      <div key={idx} className="p-2 rounded-lg border border-slate-800 bg-slate-900/40">
                        <div className="text-sm">
                          <span className="font-semibold">{a.symbol || '—'}</span>
                          <span className="text-slate-500"> · {a.strategyId}</span>
                          {a.signal?.confidence !== undefined ? (
                            <span className="text-slate-400"> · {Math.round(Number(a.signal.confidence))}%</span>
                          ) : null}
                        </div>
                        <div className="text-xs text-slate-400 mt-1">{a.action} — {a.reason}</div>
                      </div>
                    ))}
                  </div>
                  {(r.actions || []).length > 12 ? (
                    <div className="text-xs text-slate-500 mt-2">Showing first 12 actions…</div>
                  ) : null}
                </details>
              );
            })}
          </div>
        )}
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
        title="Trade Lifecycle"
        subtitle="Manages ACTIVE tracked trades (targets, stops, time-stops, and a simple trailing lock-in)."
      >
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-700/70 bg-slate-900/30 md:col-span-2">
            <input
              type="checkbox"
              checked={Boolean(config.autopilot.manageOpenTradesEnabled)}
              onChange={(e) => patchConfig({ autopilot: { manageOpenTradesEnabled: e.target.checked } })}
              className="w-4 h-4"
            />
            <div>
              <div className="font-medium">Enable trade manager</div>
              <div className="text-xs text-slate-400">Runs automatically at the start of each tick.</div>
            </div>
          </label>

          <div className="p-3 rounded-xl border border-slate-700/70 bg-slate-900/30">
            <div className="text-xs text-slate-400 mb-1">Time stop (days)</div>
            <input
              type="number"
              min={0}
              max={120}
              value={config.autopilot.timeStopDays}
              onChange={(e) => patchConfig({ autopilot: { timeStopDays: Number(e.target.value) } })}
              className="w-full px-3 py-2 rounded-lg bg-slate-950/40 border border-slate-700 text-sm"
            />
          </div>

          <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-700/70 bg-slate-900/30">
            <input
              type="checkbox"
              checked={Boolean(config.autopilot.enableTrailingStop)}
              onChange={(e) => patchConfig({ autopilot: { enableTrailingStop: e.target.checked } })}
              className="w-4 h-4"
            />
            <div>
              <div className="font-medium">Trailing lock-in</div>
              <div className="text-xs text-slate-400">After +R, tighten stop.</div>
            </div>
          </label>

          <div className="p-3 rounded-xl border border-slate-700/70 bg-slate-900/30">
            <div className="text-xs text-slate-400 mb-1">Trail after (R)</div>
            <input
              type="number"
              min={0}
              max={10}
              step={0.1}
              value={config.autopilot.trailAfterR}
              onChange={(e) => patchConfig({ autopilot: { trailAfterR: Number(e.target.value) } })}
              className="w-full px-3 py-2 rounded-lg bg-slate-950/40 border border-slate-700 text-sm"
            />
          </div>

          <div className="p-3 rounded-xl border border-slate-700/70 bg-slate-900/30">
            <div className="text-xs text-slate-400 mb-1">Lock-in (R)</div>
            <input
              type="number"
              min={0}
              max={5}
              step={0.05}
              value={config.autopilot.trailLockInR}
              onChange={(e) => patchConfig({ autopilot: { trailLockInR: Number(e.target.value) } })}
              className="w-full px-3 py-2 rounded-lg bg-slate-950/40 border border-slate-700 text-sm"
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={() => runLifecycle(true)}
            disabled={lifecycleLoading}
            className="px-4 py-2 rounded-lg border border-slate-700 bg-slate-800/50 hover:bg-slate-700/50 text-sm"
          >
            {lifecycleLoading ? 'Running…' : 'Preview manager (dry-run)'}
          </button>
          <button
            onClick={() => runLifecycle(false)}
            disabled={lifecycleLoading}
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-sky-500 hover:from-emerald-600 hover:to-sky-600 text-white text-sm"
          >
            {lifecycleLoading ? 'Running…' : 'Run manager now'}
          </button>
        </div>

        {lifecycleResult ? (
          <div className="mt-4 p-4 rounded-xl border border-slate-700/70 bg-slate-950/30">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-semibold">Last lifecycle run</div>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Badge>{lifecycleResult.meta?.dryRun ? 'DRY' : 'EXEC'}</Badge>
                <Badge>closed {lifecycleResult.meta?.closed ?? 0}</Badge>
                <Badge>stop updates {lifecycleResult.meta?.stopUpdates ?? 0}</Badge>
              </div>
            </div>
            <div className="text-xs text-slate-500 mt-2">{JSON.stringify(lifecycleResult.meta)}</div>
          </div>
        ) : null}
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

      <Section
        title="Alerts"
        subtitle="In-app notifications from autopilot ticks (and optional webhooks)."
      >
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <Badge>{alertsConfig?.enabled ? 'Enabled' : 'Disabled'}</Badge>
            <Badge>min conf {alertsConfig?.minConfidence ?? '—'}</Badge>
            {alertsSaving ? <Badge>Saving…</Badge> : null}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchAlerts}
              className="px-3 py-2 rounded-lg border border-slate-700 bg-slate-800/50 text-sm hover:bg-slate-700/50"
            >
              Refresh
            </button>
            <button
              onClick={clearAlerts}
              className="px-3 py-2 rounded-lg border border-red-700/40 bg-red-500/5 text-red-200 text-sm hover:bg-red-500/10"
            >
              Clear
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl border border-slate-700/70 bg-slate-900/30">
            <div className="text-sm font-semibold text-white mb-3">Settings</div>

            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <div className="text-xs text-slate-400 mb-1">Alerts enabled</div>
                <div className="text-sm text-slate-300">Show in-app alerts when autopilot tracks/queues/places orders.</div>
              </div>
              <button
                onClick={() => patchAlertsConfig({ enabled: !Boolean(alertsConfig?.enabled) })}
                className={
                  'px-3 py-2 rounded-lg text-sm border ' +
                  (alertsConfig?.enabled
                    ? 'border-emerald-700 bg-emerald-700/10 text-emerald-200 hover:bg-emerald-700/20'
                    : 'border-slate-700 bg-slate-800/40 text-slate-200 hover:bg-slate-700/50')
                }
              >
                {alertsConfig?.enabled ? 'On' : 'Off'}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-slate-400 mb-1">Min confidence</div>
                <input
                  value={String(alertsConfig?.minConfidence ?? 70)}
                  onChange={(e) => patchAlertsConfig({ minConfidence: Number(e.target.value || 0) })}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950/40 border border-slate-700 text-slate-100 text-sm"
                />
              </div>
              <div>
                <div className="text-xs text-slate-400 mb-1">Webhook URL (optional)</div>
                <input
                  value={String(alertsConfig?.webhookUrl || '')}
                  onChange={(e) => patchAlertsConfig({ webhookUrl: e.target.value })}
                  placeholder="https://..."
                  className="w-full px-3 py-2 rounded-lg bg-slate-950/40 border border-slate-700 text-slate-100 text-sm"
                />
              </div>
            </div>

            <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={Boolean(alertsConfig?.includePaper)}
                  onChange={(e) => patchAlertsConfig({ includePaper: e.target.checked })}
                />
                Paper
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={Boolean(alertsConfig?.includeLiveConfirm)}
                  onChange={(e) => patchAlertsConfig({ includeLiveConfirm: e.target.checked })}
                />
                Live confirm
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={Boolean(alertsConfig?.includeLiveAuto)}
                  onChange={(e) => patchAlertsConfig({ includeLiveAuto: e.target.checked })}
                />
                Live auto
              </label>
            </div>

            <div className="mt-3">
              <div className="text-xs text-slate-400 mb-1">Symbols allowlist (optional)</div>
              <input
                value={Array.isArray(alertsConfig?.symbols) ? alertsConfig.symbols.join(', ') : ''}
                onChange={(e) => patchAlertsConfig({ symbols: e.target.value })}
                placeholder="SPY, QQQ, AAPL"
                className="w-full px-3 py-2 rounded-lg bg-slate-950/40 border border-slate-700 text-slate-100 text-sm"
              />
            </div>
          </div>

          <div className="p-4 rounded-xl border border-slate-700/70 bg-slate-900/30">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-semibold text-white">Inbox</div>
              <div className="text-xs text-slate-400">{alertsEvents.length} events</div>
            </div>

            {alertsEvents.length ? (
              <div className="space-y-2 max-h-80 overflow-auto pr-1">
                {alertsEvents.slice(0, 50).map((ev: any) => (
                  <div key={ev.id} className="p-3 rounded-lg border border-slate-800 bg-slate-950/20">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-white">{ev.title}</div>
                        <div className="text-xs text-slate-400 mt-1">{ev.message}</div>
                        <div className="text-[11px] text-slate-500 mt-2">{ev.createdAt ? new Date(ev.createdAt).toLocaleString() : ''}</div>
                      </div>
                      <div className="text-xs text-slate-400">{String(ev.severity || 'info')}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-slate-400">No alerts yet.</div>
            )}
          </div>
        </div>
      </Section>

<div className="p-4 rounded-xl border border-slate-700/60 bg-slate-900/20 text-sm text-slate-300">
        <div className="font-semibold mb-2">Notes</div>
        <ul className="list-disc pl-5 space-y-1 text-slate-400">
          <li>Autopilot runs when you click “Execute tick now”. You can also schedule it via <code>/api/automation/cron</code> (requires <code>AUTOMATION_CRON_ENABLED=true</code> and a Vercel Cron invocation).</li>
          <li>Paper mode writes tracked suggestions into the Portfolio tab (Tracker store).</li>
          <li>Live mode places a simple market order and also tracks the signal for auditability.</li>
        </ul>
      </div>
    </div>
  );
}

