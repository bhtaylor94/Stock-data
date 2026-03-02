'use client';
import React, { useState, useEffect } from 'react';
import { AlertTriangle, ChevronDown } from 'lucide-react';
import { TipLabel } from '@/app/components/core/Tooltip';

import { OptionsDecisionHero } from './OptionsDecisionHero';
import { SmartFlowSection } from './SmartFlowSection';
import { FlowSetupCard } from './FlowSetupCard';
import { ExpirationFlowBar } from './ExpirationFlowBar';
import { IVSkewChart } from './IVSkewChart';
import { OptionsChainTable } from './OptionsChainTable';
import { OIProfileChart } from './OIProfileChart';
import { OptionsIntelPanel } from './OptionsIntelPanel';
import { ZeroDTEAlert } from './ZeroDTEAlert';
import { SkewAnalyticsCard } from './SkewAnalyticsCard';
import { GreeksPanel } from './GreeksPanel';
import { EarningsWidget } from '../core/EarningsWidget';
import { PositionSizingCalc } from '../core/PositionSizingCalc';
import { PLDiagram } from './PLDiagram';
import { IVSurfaceHeatmap } from './IVSurfaceHeatmap';
import { GexChart } from './GexChart';
import { IVHVWidget } from './IVHVWidget';
import { VolConeChart } from './VolConeChart';
import { ContractDrillDown } from './ContractDrillDown';

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

/** Collapsible accordion section used in the right column */
function Section({
  title,
  icon,
  defaultOpen = false,
  children,
  badge,
}: {
  title: string;
  icon: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  badge?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl border border-slate-700/50 bg-slate-800/20 overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-800/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm">{icon}</span>
          <span className="text-xs font-semibold text-slate-300 uppercase tracking-wide">{title}</span>
          {badge && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-700/60 text-slate-400">{badge}</span>
          )}
        </div>
        <ChevronDown
          size={14}
          className={`text-slate-500 transition-transform duration-200 ${open ? '' : '-rotate-90'}`}
        />
      </button>
      {open && <div className="px-4 pb-4 space-y-4">{children}</div>}
    </div>
  );
}

interface OptionsTabProps {
  data: any;
  loading: boolean;
  ticker: string;
  onTrack?: (success: boolean, message: string) => void;
  onViewEvidence?: () => void;
}

export function OptionsTab({ data, loading, ticker, onTrack, onViewEvidence }: OptionsTabProps) {
  const [selectedExp, setSelectedExp] = useState<string>('');
  const [selectedContract, setSelectedContract] = useState<any>(null);
  const [chainOpen, setChainOpen] = useState(false);

  useEffect(() => {
    if (data?.expirations?.length > 0 && !selectedExp) {
      const exps: string[] = data.expirations;
      const byExp = data.byExpiration ?? {};
      const scored = exps.map((exp: string) => {
        const { calls = [], puts = [] } = byExp[exp] ?? {};
        const unusual = [...calls, ...puts].filter(
          (c: any) => c.isUnusual || (c.volumeOIRatio ?? 0) > 2
        ).length;
        const vol = [...calls, ...puts].reduce((s: number, c: any) => s + (c.volume || 0), 0);
        return { exp, score: unusual * 15 + Math.min(vol / 200, 15) };
      });
      const hottest = scored.reduce(
        (a: { exp: string; score: number }, b: { exp: string; score: number }) =>
          b.score > a.score ? b : a,
        scored[0]
      );
      setSelectedExp(hottest.exp);
    }
  }, [data, selectedExp]);

  if (loading) return <LoadingSpinner />;
  if (!data) return <p className="text-slate-500 text-center py-12">Enter a ticker symbol to view options</p>;
  if (data.error) {
    return (
      <div className="p-6 rounded-2xl border border-red-500/30 bg-red-500/5 animate-fade-in">
        <h3 className="text-lg font-semibold text-red-400 mb-3 flex items-center gap-1.5">
          <AlertTriangle size={16} /> {data.error}
        </h3>
        {data.details && <p className="text-sm text-red-300 mb-3 whitespace-pre-wrap">{data.details}</p>}
        {(Array.isArray(data.instructions) ? data.instructions : (data.instructions ? [String(data.instructions)] : [])).map((i: string, idx: number) => (
          <p key={idx} className="text-xs text-slate-400">• {i}</p>
        ))}
      </div>
    );
  }

  const ivRank = data.metrics?.ivRank;
  const putCallRatio = data.metrics?.putCallRatio;
  const maxPain = data.metrics?.maxPain;
  const hv20 = data.historicalVolatility?.hv20;

  const ivRankColor = ivRank != null
    ? ivRank >= 70 ? 'text-red-400' : ivRank >= 40 ? 'text-amber-400' : 'text-emerald-400'
    : 'text-slate-400';
  const pcColor = putCallRatio != null
    ? putCallRatio >= 1.2 ? 'text-red-400' : putCallRatio <= 0.8 ? 'text-emerald-400' : 'text-slate-300'
    : 'text-slate-400';
  const pcLabel = putCallRatio != null
    ? putCallRatio <= 0.8 ? 'Calls' : putCallRatio >= 1.2 ? 'Puts' : null
    : null;

  const optDs = (data.dataSource ?? '') as string;
  const optResponseMs = data.meta?.responseTimeMs as number | undefined;

  const unusualCount = (data.unusualActivity ?? []).filter((a: any) => (a.uoaScore ?? 0) >= 55).length;

  const makeTrackHandler = (payload: object) => {
    if (!onTrack) return undefined;
    return () => {
      fetch('/api/tracker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).then(res => res.json()).then(result => {
        onTrack(result.success, result.message || result.error);
      }).catch(() => {
        onTrack(false, 'Failed to track position');
      });
    };
  };

  const flowTrackHandler = (activity: any) => {
    if (!onTrack) return;
    const optionType = activity.type?.toUpperCase() === 'PUT' ? 'PUT' : 'CALL';
    fetch('/api/tracker', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ticker,
        type: optionType,
        strategy: `${activity.alertType ?? 'UOA'}: $${activity.strike} ${optionType} (${activity.tradeType ?? 'UOA'})`,
        entryPrice: 1.00,
        confidence: activity.uoaScore ?? activity.confidence ?? 70,
        reasoning: activity.signals || [],
        evidencePacket: data,
        optionContract: {
          strike: activity.strike,
          expiration: activity.expiration ?? 'N/A',
          dte: activity.dte,
          delta: activity.delta ?? 0.5,
          entryAsk: 1.00,
          optionType,
        },
      }),
    }).then(res => res.json()).then(result => {
      onTrack(result.success, result.message || result.error);
    }).catch(() => {
      onTrack(false, 'Failed to track position');
    });
  };

  // P&L diagram — derive here for reuse
  const plSetup = data.optionsSetups?.[0];
  const plContract = plSetup?.recommendedContract;

  return (
    <>
      {/* Contract drill-down modal */}
      {selectedContract && (
        <ContractDrillDown
          contract={selectedContract}
          ticker={ticker}
          currentPrice={data.currentPrice}
          onClose={() => setSelectedContract(null)}
        />
      )}

      {/* Data quality + timing strip */}
      <div className="flex items-center gap-2 flex-wrap mb-3">
        {optDs === 'schwab-live' ? (
          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border font-medium text-emerald-400 bg-emerald-500/10 border-emerald-500/20">
            ✓ Schwab Live Options
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border font-medium text-amber-400 bg-amber-500/10 border-amber-500/20">
            ⚠ Options data may be delayed or estimated
          </span>
        )}
        {optResponseMs != null && (
          <span className="text-[10px] text-slate-500">{optResponseMs}ms</span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-4 animate-fade-in">

        {/* ── LEFT — sticky decision sidebar ─────────────────────────── */}
        <div className="space-y-3 lg:sticky lg:top-[100px] lg:self-start lg:max-h-[calc(100vh-108px)] lg:overflow-y-auto">

          <OptionsDecisionHero
            ticker={ticker}
            currentPrice={data.currentPrice}
            meta={data.meta}
            suggestions={data.suggestions}
            onViewEvidence={onViewEvidence}
          />

          {/* Compact inline stat strip — replaces the old 2×2 card grid */}
          {(ivRank != null || putCallRatio != null || maxPain != null || hv20 != null) && (
            <div className="flex items-center rounded-xl border border-slate-700/40 bg-slate-800/20 overflow-hidden divide-x divide-slate-700/40">
              {ivRank != null && (
                <div className="flex-1 px-2 py-2.5 text-center">
                  <p className="text-[9px] text-slate-500 uppercase tracking-wide leading-none mb-1">IV Rank</p>
                  <p className={`text-xs font-bold leading-none ${ivRankColor}`}>{ivRank}</p>
                </div>
              )}
              {putCallRatio != null && (
                <div className="flex-1 px-2 py-2.5 text-center">
                  <p className="text-[9px] text-slate-500 uppercase tracking-wide leading-none mb-1">P/C</p>
                  <p className={`text-xs font-bold leading-none ${pcColor}`}>{putCallRatio.toFixed(2)}</p>
                  {pcLabel && <p className={`text-[8px] mt-0.5 leading-none ${pcColor}`}>{pcLabel}</p>}
                </div>
              )}
              {maxPain != null && (
                <div className="flex-1 px-2 py-2.5 text-center">
                  <p className="text-[9px] text-slate-500 uppercase tracking-wide leading-none mb-1">Max Pain</p>
                  <p className="text-xs font-bold text-white leading-none">${maxPain}</p>
                </div>
              )}
              {hv20 != null && (
                <div className="flex-1 px-2 py-2.5 text-center">
                  <p className="text-[9px] text-slate-500 uppercase tracking-wide leading-none mb-1">HV20</p>
                  <p className="text-xs font-bold text-slate-300 leading-none">{hv20.toFixed(1)}%</p>
                </div>
              )}
            </div>
          )}

          {/* IV vs HV Widget */}
          {data.ivAnalysis?.atmIV > 0 && data.historicalVolatility?.hv20 > 0 && (
            <IVHVWidget
              atmIV={data.ivAnalysis.atmIV / 100}
              hv20={data.historicalVolatility.hv20 / 100}
              ivVsHV={data.historicalVolatility.ivVsHV}
              ivRank={data.metrics?.ivRank ?? null}
              ivPercentile={data.ivAnalysis?.ivPercentile ?? null}
              ivHistoryDays={data.historicalVolatility?.ivHistoryDays ?? 0}
            />
          )}

          <EarningsWidget ticker={ticker} />

          {/* Flow Setups */}
          {data.optionsSetups?.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-slate-400 px-1 uppercase tracking-wide">Flow Setups</h3>
              {data.optionsSetups.slice(0, 3).map((setup: any, i: number) => (
                <FlowSetupCard
                  key={i}
                  setup={setup}
                  onTrack={() => {
                    if (!onTrack || !setup.recommendedContract) return;
                    const rc = setup.recommendedContract;
                    const optType = setup.recommendedStructure?.type === 'PUT' ? 'PUT' : 'CALL';
                    fetch('/api/tracker', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        ticker,
                        type: optType,
                        strategy: setup.name,
                        entryPrice: rc.ask || rc.mark || 1.00,
                        confidence: setup.confluenceScore || 0,
                        reasoning: setup.criteriaHit || [],
                        evidencePacket: data,
                        optionContract: {
                          strike: rc.strike,
                          expiration: rc.expiration,
                          dte: rc.dte,
                          delta: rc.delta,
                          entryAsk: rc.ask || rc.mark || 1.00,
                          optionType: optType,
                        },
                      }),
                    }).then(res => res.json()).then(result => {
                      onTrack(result.success, result.message || result.error);
                    }).catch(() => {
                      onTrack(false, 'Failed to track position');
                    });
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── RIGHT — main content, prioritised by time-sensitivity ────── */}
        <div className="space-y-4">

          {/* 0DTE Alert — critical, always at top when present */}
          {data.zdteFlow && (
            <ZeroDTEAlert zdteFlow={data.zdteFlow} currentPrice={data.currentPrice} />
          )}

          {/* ① UNUSUAL FLOW — most time-sensitive, always visible */}
          <SmartFlowSection
            activities={data.unusualActivity || []}
            onTrack={flowTrackHandler}
          />

          {/* ② INTEL SUMMARY — always visible */}
          {(data.ivAnalysis || data.metrics || data.skewAnalytics || data.gex) && (
            <OptionsIntelPanel
              ivAnalysis={data.ivAnalysis}
              metrics={data.metrics}
              skewAnalytics={data.skewAnalytics}
              gex={data.gex}
              historicalVolatility={data.historicalVolatility}
              expectedMoveByExpiration={data.expectedMoveByExpiration || {}}
            />
          )}

          {/* ③ GAMMA & OI — collapsed by default */}
          {(data.oiProfile || data.gex?.byStrike?.length > 0) && (
            <Section title="Gamma & Open Interest" icon="⚡">
              {data.oiProfile && data.gex && (
                <OIProfileChart
                  oiProfile={data.oiProfile}
                  gex={data.gex}
                  maxPain={data.metrics?.maxPain ?? data.currentPrice}
                  currentPrice={data.currentPrice}
                />
              )}
              {data.gex?.byStrike?.length > 0 && (
                <GexChart gex={data.gex} currentPrice={data.currentPrice} />
              )}
            </Section>
          )}

          {/* ④ VOLATILITY & SKEW — collapsed by default */}
          <Section title="Volatility & Skew" icon="📊">
            {data.ivTermStructure?.term?.length >= 2 && data.historicalVolatility?.hvByWindow && (
              <VolConeChart
                termStructure={data.ivTermStructure.term}
                hvByWindow={data.historicalVolatility.hvByWindow}
                shape={data.ivTermStructure.shape}
                nearTermIV={data.ivTermStructure.nearTermIV}
                longerTermIV={data.ivTermStructure.longerTermIV}
                ivSpread={data.ivTermStructure.ivSpread}
              />
            )}
            {data.skewAnalytics && (
              <SkewAnalyticsCard skewAnalytics={data.skewAnalytics} />
            )}
            {(data.greeksAggregation || Object.keys(data.expectedMoveByExpiration || {}).length > 0) && (
              <GreeksPanel
                greeksAggregation={data.greeksAggregation ?? null}
                expectedMoveByExpiration={data.expectedMoveByExpiration || {}}
                currentPrice={data.currentPrice}
                expirations={data.expirations || []}
              />
            )}
            {data.expirations?.length > 1 && data.byExpiration && data.currentPrice && (
              <IVSurfaceHeatmap
                byExpiration={data.byExpiration}
                currentPrice={data.currentPrice}
                selectedExp={selectedExp}
                onSelectExp={setSelectedExp}
              />
            )}
          </Section>

          {/* ⑤ CONTRACT DETAILS & CHAIN — collapsed by default */}
          <Section title="Contract Details & Chain" icon="📋">
            {/* Expiration selector */}
            {data.expirations?.length > 0 && data.byExpiration && (
              <ExpirationFlowBar
                expirations={data.expirations}
                byExpiration={data.byExpiration}
                selectedExp={selectedExp}
                onSelect={setSelectedExp}
              />
            )}

            {/* IV Skew for selected expiration */}
            {data.byExpiration && selectedExp && data.byExpiration[selectedExp] && (
              <IVSkewChart
                calls={data.byExpiration[selectedExp].calls}
                puts={data.byExpiration[selectedExp].puts}
                currentPrice={data.currentPrice}
                expiration={selectedExp}
              />
            )}

            {/* Full chain — behind its own toggle to prevent 1000px dump */}
            {data.byExpiration && selectedExp && data.byExpiration[selectedExp] && (
              <div>
                <button
                  onClick={() => setChainOpen(v => !v)}
                  className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-slate-700/40 bg-slate-800/30 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-colors"
                >
                  <ChevronDown
                    size={12}
                    className={`transition-transform duration-200 ${chainOpen ? '' : '-rotate-90'}`}
                  />
                  {chainOpen ? 'Hide' : 'Show'} Full Options Chain — {selectedExp}
                </button>
                {chainOpen && (
                  <div className="mt-3">
                    <OptionsChainTable
                      calls={data.byExpiration[selectedExp].calls}
                      puts={data.byExpiration[selectedExp].puts}
                      currentPrice={data.currentPrice}
                      onSelectContract={(c) => setSelectedContract(c)}
                    />
                  </div>
                )}
              </div>
            )}

            {/* P&L Diagram */}
            {plContract && data.currentPrice && (
              <PLDiagram
                strike={plContract.strike}
                mark={plContract.ask || plContract.mark || 0.5}
                type={plSetup?.recommendedStructure?.type?.toLowerCase().includes('put') ? 'put' : 'call'}
                currentPrice={data.currentPrice}
                iv={plContract.iv || 0.3}
                dte={plContract.dte || 30}
              />
            )}

            {/* Position Sizing Calculator */}
            <PositionSizingCalc
              ticker={ticker}
              setup={data.optionsSetups?.[0]}
              contractAsk={selectedContract?.ask || data.optionsSetups?.[0]?.recommendedContract?.ask}
            />
          </Section>
        </div>
      </div>
    </>
  );
}
