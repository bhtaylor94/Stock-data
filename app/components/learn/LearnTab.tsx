'use client';
import React, { useState } from 'react';
import { BookOpen, BarChart2, Settings2, type LucideIcon } from 'lucide-react';
import { Glossary } from './Glossary';
import { TradingSetups } from './TradingSetups';

type SubTab = 'swings' | 'options' | 'glossary';

const TABS: { id: SubTab; label: string; Icon: LucideIcon }[] = [
  { id: 'swings',  label: 'Stock Swings', Icon: BarChart2  },
  { id: 'options', label: 'Options',      Icon: Settings2  },
  { id: 'glossary',label: 'Glossary',     Icon: BookOpen   },
];

export function LearnTab() {
  const [activeTab, setActiveTab] = useState<SubTab>('swings');

  return (
    <div className="space-y-4">
      {/* Sub-tab bar */}
      <div className="flex gap-1 p-1 rounded-xl bg-slate-800/60 border border-slate-700/50">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[12px] font-semibold rounded-lg transition-all ${
              activeTab === id
                ? 'bg-slate-700 text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <Icon size={12} />
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'swings'  && <TradingSetups initialAsset="stock"   />}
      {activeTab === 'options' && <TradingSetups initialAsset="options" />}
      {activeTab === 'glossary'&& <Glossary />}
    </div>
  );
}
