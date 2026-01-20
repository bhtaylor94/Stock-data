import { StrategyLibrary } from '@/app/components/strategies/StrategyLibrary';

export default function StrategiesPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      <div className="max-w-6xl mx-auto px-4 py-6">
        <StrategyLibrary />
      </div>
    </div>
  );
}
