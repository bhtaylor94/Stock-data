'use client';
import React, { useState, useMemo } from 'react';
import { Calculator } from 'lucide-react';

interface PositionSizingCalcProps {
  setup?: any;
  contractAsk?: number;
  ticker?: string;
}

export function PositionSizingCalc({ setup, contractAsk, ticker }: PositionSizingCalcProps) {
  const [accountSize, setAccountSize] = useState(25000);
  const [riskPct, setRiskPct] = useState(2);
  const [contractPrice, setContractPrice] = useState(contractAsk ?? 0);

  // Sync contractPrice when prop changes
  React.useEffect(() => {
    if (contractAsk) setContractPrice(contractAsk);
  }, [contractAsk]);

  const calc = useMemo(() => {
    const maxRiskDollars = accountSize * (riskPct / 100);
    const costPerContract = contractPrice * 100; // 1 contract = 100 shares
    const contracts = costPerContract > 0 ? Math.floor(maxRiskDollars / costPerContract) : 0;
    const maxLoss = contracts * costPerContract;
    const pctOfAccount = accountSize > 0 ? (maxLoss / accountSize) * 100 : 0;
    const confluenceScore = setup?.confluenceScore ?? 0;
    const kellyMultiplier = confluenceScore > 0 ? confluenceScore / 100 : 0.5;
    const kellyContracts = contracts > 0 ? Math.max(1, Math.round(contracts * kellyMultiplier)) : 0;
    return { maxRiskDollars, contracts, maxLoss, pctOfAccount, kellyContracts };
  }, [accountSize, riskPct, contractPrice, setup]);

  return (
    <div className="p-4 rounded-2xl border border-slate-700/50 bg-slate-800/20">
      <div className="flex items-center gap-2 mb-3">
        <Calculator size={14} className="text-slate-400" />
        <h3 className="text-sm font-semibold text-white">Position Sizing</h3>
        {ticker && <span className="text-xs text-slate-500">for {ticker}</span>}
      </div>

      {/* Inputs */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div>
          <label className="stat-label block mb-1">Account ($)</label>
          <input
            type="number"
            value={accountSize}
            onChange={e => setAccountSize(Number(e.target.value) || 0)}
            className="w-full bg-slate-900/60 border border-slate-700/50 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500/50"
          />
        </div>
        <div>
          <label className="stat-label block mb-1">Risk %</label>
          <input
            type="number"
            min={0.1}
            max={20}
            step={0.5}
            value={riskPct}
            onChange={e => setRiskPct(Number(e.target.value) || 0)}
            className="w-full bg-slate-900/60 border border-slate-700/50 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500/50"
          />
        </div>
        <div>
          <label className="stat-label block mb-1">Contract ($)</label>
          <input
            type="number"
            min={0.01}
            step={0.01}
            value={contractPrice}
            onChange={e => setContractPrice(Number(e.target.value) || 0)}
            className="w-full bg-slate-900/60 border border-slate-700/50 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500/50"
          />
        </div>
      </div>

      {/* Results */}
      {contractPrice > 0 && (
        <div className="grid grid-cols-2 gap-2">
          <div className="p-2.5 rounded-xl bg-slate-900/50 border border-slate-700/40">
            <p className="stat-label">Max Risk</p>
            <p className="text-base font-bold text-amber-400">${calc.maxRiskDollars.toFixed(0)}</p>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-900/50 border border-slate-700/40">
            <p className="stat-label">Contracts</p>
            <p className="text-2xl font-bold text-white">{calc.contracts}</p>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-900/50 border border-slate-700/40">
            <p className="stat-label">Max Loss</p>
            <p className="text-base font-bold text-red-400">${calc.maxLoss.toFixed(0)}</p>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-900/50 border border-slate-700/40">
            <p className="stat-label">% of Account</p>
            <p className="text-base font-bold text-slate-300">{calc.pctOfAccount.toFixed(1)}%</p>
          </div>
        </div>
      )}

      {contractPrice > 0 && calc.contracts === 0 && (
        <p className="text-xs text-amber-400 mt-2">Increase account size or reduce contract price to open a position.</p>
      )}

      {setup?.confluenceScore > 0 && calc.contracts > 0 && (
        <div className="mt-2.5 p-2 rounded-lg bg-blue-500/8 border border-blue-500/20">
          <p className="text-xs text-blue-400">
            Kelly-adjusted ({setup.confluenceScore}% confluence): <span className="font-bold">{calc.kellyContracts} contracts</span>
            <span className="text-slate-500 ml-1">— scale into position if conviction grows</span>
          </p>
        </div>
      )}

      {contractPrice === 0 && (
        <p className="text-xs text-slate-500">Enter a contract price above to calculate position size.</p>
      )}
    </div>
  );
}
