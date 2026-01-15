import Link from 'next/link';
import { STRATEGY_REGISTRY } from '@/strategies/registry';
import { getForwardStats } from '@/lib/forwardStats';

function section(title: string, items: string[]) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/20 p-4">
      <div className="text-sm font-bold text-white">{title}</div>
      {(items || []).length ? (
        <ul className="mt-2 list-disc pl-5 space-y-1 text-sm text-slate-200">
          {(items || []).map((x, i) => (
            <li key={i}>{x}</li>
          ))}
        </ul>
      ) : (
        <div className="mt-2 text-sm text-slate-500">—</div>
      )}
    </div>
  );
}

export default async function StrategyDetailPage({
  params,
}: {
  params: { strategyId: string };
}) {
  const strategy = STRATEGY_REGISTRY.find((s) => s.id === params.strategyId);
  const stats = strategy ? await getForwardStats(strategy.id) : null;

  if (!strategy) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
        <div className="max-w-5xl mx-auto px-4 py-10">
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6">
            <div className="text-lg font-bold text-red-200">Strategy not found</div>
            <div className="mt-2 text-sm text-slate-300">No strategy exists for id: {params.strategyId}</div>
            <div className="mt-4">
              <Link
                href="/strategies"
                className="px-3 py-2 rounded-xl border border-slate-700 bg-slate-900/40 text-slate-200 hover:bg-slate-900/70"
              >
                Back to library
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs text-slate-400">Strategy</div>
            <div className="text-2xl font-bold text-white">{strategy.name}</div>
            <div className="mt-1 text-sm text-slate-400">{strategy.shortDescription}</div>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="px-2 py-1 rounded-full border border-slate-800 bg-slate-950/30 text-[11px] text-slate-200">
                Regime: {(strategy.marketRegimes || []).join(', ') || '—'}
              </span>
              <span className="px-2 py-1 rounded-full border border-slate-800 bg-slate-950/30 text-[11px] text-slate-200">
                Horizon: {strategy.horizon || '—'}
              </span>
              <span className="px-2 py-1 rounded-full border border-slate-800 bg-slate-950/30 text-[11px] text-slate-200">
                Engine: {strategy.engineKey}
              </span>
              <span className="px-2 py-1 rounded-full border border-slate-800 bg-slate-950/30 text-[11px] text-slate-200">
                Forward N: {stats?.sampleSize ?? '—'}
              </span>
              <span className="px-2 py-1 rounded-full border border-slate-800 bg-slate-950/30 text-[11px] text-slate-200">
                Win: {typeof stats?.winRate === 'number' ? `${stats.winRate}%` : '—'}
              </span>
              <span className="px-2 py-1 rounded-full border border-slate-800 bg-slate-950/30 text-[11px] text-slate-200">
                Avg R: {typeof stats?.avgR === 'number' ? stats.avgR : '—'}
              </span>
            </div>
          </div>

          <Link
            href="/strategies"
            className="px-3 py-2 rounded-xl border border-slate-700 bg-slate-900/40 text-slate-200 hover:bg-slate-900/70"
          >
            ← Back
          </Link>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/20 p-4">
          <div className="text-sm font-bold text-white">Forward stats (from tracked outcomes)</div>
          <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-xl border border-slate-800 bg-slate-950/30 p-3">
              <div className="text-[11px] text-slate-400">Sample size</div>
              <div className="mt-1 text-lg font-semibold text-white">{stats?.sampleSize ?? '—'}</div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/30 p-3">
              <div className="text-[11px] text-slate-400">Win rate</div>
              <div className="mt-1 text-lg font-semibold text-white">
                {typeof stats?.winRate === 'number' ? `${stats.winRate}%` : '—'}
              </div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/30 p-3">
              <div className="text-[11px] text-slate-400">Average R</div>
              <div className="mt-1 text-lg font-semibold text-white">{typeof stats?.avgR === 'number' ? stats.avgR : '—'}</div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/30 p-3">
              <div className="text-[11px] text-slate-400">Max drawdown (R)</div>
              <div className="mt-1 text-lg font-semibold text-white">
                {typeof stats?.maxDrawdownR === 'number' ? stats.maxDrawdownR : '—'}
              </div>
            </div>
          </div>
          <div className="mt-2 text-xs text-slate-500">
            Last update: {stats?.lastUpdatedISO ? new Date(stats.lastUpdatedISO).toLocaleString() : '—'}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {section('Entry triggers', strategy.entryTriggers)}
          {section('Confirmations', strategy.confirmations)}
          {section('Disqualifiers', strategy.disqualifiers)}
          {section('Invalidation rules', strategy.invalidationRules)}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {section('Risk model', strategy.riskModel)}
          {section('Position logic', strategy.positionLogic)}
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/20 p-4">
          <div className="text-sm font-bold text-white">Presets</div>
          <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-3">
            {(strategy.presets || []).map((p) => (
              <div key={p.id} className="rounded-xl border border-slate-800 bg-slate-950/30 p-3">
                <div className="text-sm font-semibold text-white">{p.name}</div>
                <div className="mt-1 text-xs text-slate-400">{p.description}</div>
                <div className="mt-2 text-[11px] text-slate-400">
                  Live: {p.lockedInLive ? 'Locked' : 'Editable'} • Paper: {p.editableInPaper ? 'Editable' : 'Locked'}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
