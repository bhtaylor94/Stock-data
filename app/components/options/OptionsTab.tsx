'use client';
import React, { useState, useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
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

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
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
  const [selectedContractAsk, setSelectedContractAsk] = useState<number>(0);

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

  return (
    <>
      {/* Data quality strip */}
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

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4 animate-fade-in">

        {/* LEFT — sticky decision + setups */}
        <div className="space-y-3 lg:sticky lg:top-[100px] lg:self-start lg:max-h-[calc(100vh-108px)] lg:overflow-y-auto">
          <OptionsDecisionHero
            ticker={ticker}
            currentPrice={data.currentPrice}
            meta={data.meta}
            suggestions={data.suggestions}
            onViewEvidence={onViewEvidence}
          />

          {/* Key stats 2×2 grid */}
          {(ivRank != null || putCallRatio != null || maxPain != null || hv20 != null) && (
            <div className="grid grid-cols-2 gap-2">
              {ivRank != null && (
                <div className="p-3 rounded-xl border border-slate-700/40 bg-slate-800/20 text-center">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-0.5 flex items-center justify-center gap-1">
                    <TipLabel labelKey="IV RANK" iconClassName="inline-flex items-center justify-center w-3 h-3 rounded-full bg-slate-700/70 text-slate-400 text-[8px] leading-none">IV Rank</TipLabel>
                  </p>
                  <p className={`text-sm font-bold ${ivRankColor}`}>{ivRank}%</p>
                </div>
              )}
              {putCallRatio != null && (
                <div className="p-3 rounded-xl border border-slate-700/40 bg-slate-800/20 text-center">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-0.5 flex items-center justify-center gap-1">
                    <TipLabel labelKey="P/C RATIO" iconClassName="inline-flex items-center justify-center w-3 h-3 rounded-full bg-slate-700/70 text-slate-400 text-[8px] leading-none">P/C Ratio</TipLabel>
                  </p>
                  <p className={`text-sm font-bold ${pcColor}`}>{putCallRatio.toFixed(2)}</p>
                  {pcLabel && <p className={`text-[9px] font-semibold mt-0.5 ${pcColor}`}>{pcLabel}</p>}
                </div>
              )}
              {maxPain != null && (
                <div className="p-3 rounded-xl border border-slate-700/40 bg-slate-800/20 text-center">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-0.5 flex items-center justify-center gap-1">
                    <TipLabel labelKey="MAX PAIN" iconClassName="inline-flex items-center justify-center w-3 h-3 rounded-full bg-slate-700/70 text-slate-400 text-[8px] leading-none">Max Pain</TipLabel>
                  </p>
                  <p className="text-sm font-bold text-white">${maxPain}</p>
                </div>
              )}
              {hv20 != null && (
                <div className="p-3 rounded-xl border border-slate-700/40 bg-slate-800/20 text-center">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-0.5 flex items-center justify-center gap-1">
                    <TipLabel labelKey="HV20" iconClassName="inline-flex items-center justify-center w-3 h-3 rounded-full bg-slate-700/70 text-slate-400 text-[8px] leading-none">HV20</TipLabel>
                  </p>
                  <p className="text-sm font-bold text-slate-300">{hv20.toFixed(1)}%</p>
                </div>
              )}
            </div>
          )}

          {/* IV vs HV Premium Widget */}
          {data.ivAnalysis?.atmIV > 0 && data.historicalVolatility?.hv20 > 0 && (
            <IVHVWidget
              atmIV={data.ivAnalysis.atmIV}
              hv20={data.historicalVolatility.hv20 / 100}
              ivVsHV={data.historicalVolatility.ivVsHV}
              ivRank={data.metrics?.ivRank ?? null}
              ivPercentile={data.ivAnalysis?.ivPercentile ?? null}
            />
          )}

          <EarningsWidget ticker={ticker} />

          {/* Named Flow Setups — up to 3 */}
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

        {/* RIGHT — flow + new intel + chain */}
        <div className="space-y-4">
          {/* 0DTE Alert — conditional */}
          {data.zdteFlow && (
            <ZeroDTEAlert zdteFlow={data.zdteFlow} currentPrice={data.currentPrice} />
          )}

          {/* Institutional Intel Dashboard */}
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

          {/* OI Profile Chart */}
          {data.oiProfile && data.gex && (
            <OIProfileChart
              oiProfile={data.oiProfile}
              gex={data.gex}
              maxPain={data.metrics?.maxPain ?? data.currentPrice}
              currentPrice={data.currentPrice}
            />
          )}

          {/* GEX Chart — gamma exposure by strike */}
          {data.gex?.byStrike?.length > 0 && (
            <GexChart gex={data.gex} currentPrice={data.currentPrice} />
          )}

          {/* SmartFlowSection: merged FlowTape + UnusualActivitySection */}
          <SmartFlowSection
            activities={data.unusualActivity || []}
            onTrack={(activity) => {
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
            }}
          />

          {/* Skew Analytics */}
          {data.skewAnalytics && (
            <SkewAnalyticsCard skewAnalytics={data.skewAnalytics} />
          )}

          {/* Greeks Panel (aggregated Greeks + expected move by expiration) */}
          {(data.greeksAggregation || Object.keys(data.expectedMoveByExpiration || {}).length > 0) && (
            <GreeksPanel
              greeksAggregation={data.greeksAggregation ?? null}
              expectedMoveByExpiration={data.expectedMoveByExpiration || {}}
              currentPrice={data.currentPrice}
              expirations={data.expirations || []}
            />
          )}

          {/* IV Surface Heatmap */}
          {data.expirations?.length > 1 && data.byExpiration && data.currentPrice && (
            <IVSurfaceHeatmap
              byExpiration={data.byExpiration}
              currentPrice={data.currentPrice}
              selectedExp={selectedExp}
              onSelectExp={setSelectedExp}
            />
          )}

          {/* Expiration Flow Scanner */}
          {data.expirations?.length > 0 && data.byExpiration && (
            <ExpirationFlowBar
              expirations={data.expirations}
              byExpiration={data.byExpiration}
              selectedExp={selectedExp}
              onSelect={setSelectedExp}
            />
          )}

          {/* IV Skew Chart */}
          {data.byExpiration && selectedExp && data.byExpiration[selectedExp] && (
            <IVSkewChart
              calls={data.byExpiration[selectedExp].calls}
              puts={data.byExpiration[selectedExp].puts}
              currentPrice={data.currentPrice}
              expiration={selectedExp}
            />
          )}

          {/* Full Options Chain Table */}
          {data.byExpiration && selectedExp && data.byExpiration[selectedExp] && (
            <OptionsChainTable
              calls={data.byExpiration[selectedExp].calls}
              puts={data.byExpiration[selectedExp].puts}
              currentPrice={data.currentPrice}
              onSelectContract={(c) => setSelectedContractAsk(c.ask)}
            />
          )}

          {/* P&L Diagram — shows for recommended contract if available */}
          {(() => {
            const rc = data.optionsSetups?.[0]?.recommendedContract;
            if (!rc || !data.currentPrice) return null;
            return (
              <PLDiagram
                strike={rc.strike}
                mark={rc.ask || rc.mark || 0.5}
                type={data.optionsSetups?.[0]?.recommendedStructure?.type?.toLowerCase().includes('put') ? 'put' : 'call'}
                currentPrice={data.currentPrice}
                iv={rc.iv || 0.3}
                dte={rc.dte || 30}
              />
            );
          })()}

          {/* Position Sizing Calculator */}
          <PositionSizingCalc
            ticker={ticker}
            setup={data.optionsSetups?.[0]}
            contractAsk={selectedContractAsk || data.optionsSetups?.[0]?.recommendedContract?.ask}
          />
        </div>
      </div>
    </>
  );
}
