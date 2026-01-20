'use client';

import React, { useState } from 'react';
import { RealPortfolio } from '@/app/components/portfolio/RealPortfolio';
import { PaperPortfolio } from '@/app/components/portfolio/PaperPortfolio';

function Tab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={
        active
          ? 'px-3 py-2 rounded-lg text-sm font-bold bg-slate-800 text-slate-100'
          : 'px-3 py-2 rounded-lg text-sm font-semibold text-slate-300 hover:text-slate-100 hover:bg-slate-900/60'
      }
    >
      {label}
    </button>
  );
}

export default function PortfolioPage() {
  const [tab, setTab] = useState<'BROKER' | 'PAPER'>('BROKER');
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/20 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-lg font-black">Portfolio</div>
            <div className="text-sm text-slate-400">
              Broker-truth is the source of truth. Paper tracking is for forward testing.
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Tab label="Broker-truth" active={tab === 'BROKER'} onClick={() => setTab('BROKER')} />
            <Tab label="Paper" active={tab === 'PAPER'} onClick={() => setTab('PAPER')} />
          </div>
        </div>
      </div>

      {tab === 'BROKER' ? <RealPortfolio /> : <PaperPortfolio />}
    </div>
  );
}
