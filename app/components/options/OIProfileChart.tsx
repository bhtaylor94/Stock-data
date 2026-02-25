'use client';
import React from 'react';

interface OIStrike {
  strike: number;
  callOI: number;
  putOI: number;
  totalOI: number;
}

interface GEXWall {
  strike: number;
  level: number;
  type: 'CALL_WALL' | 'PUT_WALL';
}

interface Props {
  oiProfile: {
    strikes: OIStrike[];
    maxOI: number;
    dominantSide: 'CALLS' | 'PUTS' | 'BALANCED';
  };
  gex: {
    byStrike: { strike: number; callGEX: number; putGEX: number; netGEX: number }[];
    gexWalls: GEXWall[];
    flipPoint: number | null;
  };
  maxPain: number;
  currentPrice: number;
}

function fmtOI(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return String(v);
}

export function OIProfileChart({ oiProfile, gex, maxPain, currentPrice }: Props) {
  if (!oiProfile?.strikes?.length) {
    return (
      <div className="rounded-2xl border border-slate-700/50 bg-slate-800/20 p-6 text-center">
        <p className="text-xs text-slate-500">No open interest data available</p>
      </div>
    );
  }

  const { strikes, maxOI, dominantSide } = oiProfile;
  const gexWallStrikes = new Set(gex?.gexWalls?.map(w => w.strike) || []);
  const largestCallWall = gex?.gexWalls?.find(w => w.type === 'CALL_WALL');
  const largestPutWall = gex?.gexWalls?.find(w => w.type === 'PUT_WALL');

  const dominantColor =
    dominantSide === 'CALLS' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' :
    dominantSide === 'PUTS' ? 'text-red-400 bg-red-500/10 border-red-500/20' :
    'text-slate-300 bg-slate-700/20 border-slate-600/30';

  return (
    <div className="rounded-2xl border border-slate-700/50 bg-slate-800/20 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/40">
        <div>
          <h3 className="text-sm font-semibold text-white">Open Interest Profile</h3>
          <p className="text-xs text-slate-500 mt-0.5">Call vs put OI by strike · ±20% from spot</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[11px] px-2 py-0.5 rounded-full border font-semibold ${dominantColor}`}>
            {dominantSide}
          </span>
          <span className="text-[11px] px-2 py-0.5 rounded-full border font-semibold text-amber-400 bg-amber-500/10 border-amber-500/20">
            Max Pain ${maxPain}
          </span>
        </div>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[1fr_80px_1fr] text-[10px] text-slate-600 uppercase tracking-wide px-3 py-1.5 bg-slate-900/40 border-b border-slate-800/60">
        <span className="text-right pr-2">Puts</span>
        <span className="text-center">Strike</span>
        <span className="text-left pl-2">Calls</span>
      </div>

      {/* Strike rows */}
      <div className="overflow-y-auto" style={{ maxHeight: 320 }}>
        {strikes.map((row) => {
          const isATM = Math.abs(row.strike - currentPrice) / currentPrice < 0.008;
          const isMaxPain = row.strike === maxPain;
          const isGEXWall = gexWallStrikes.has(row.strike);
          const callWall = gex?.gexWalls?.find(w => w.strike === row.strike && w.type === 'CALL_WALL');
          const putWall = gex?.gexWalls?.find(w => w.strike === row.strike && w.type === 'PUT_WALL');
          const callBarPct = maxOI > 0 ? Math.min((row.callOI / maxOI) * 100, 100) : 0;
          const putBarPct = maxOI > 0 ? Math.min((row.putOI / maxOI) * 100, 100) : 0;

          return (
            <div
              key={row.strike}
              className={`grid grid-cols-[1fr_80px_1fr] items-center px-3 py-1 border-b border-slate-800/30 transition-colors ${
                isATM
                  ? 'bg-blue-500/10 border-blue-500/20'
                  : isMaxPain
                  ? 'bg-amber-500/5 border-amber-500/20'
                  : 'hover:bg-slate-800/15'
              }`}
            >
              {/* Put bar — grows from right to left */}
              <div className="flex items-center justify-end gap-1.5 pr-1">
                {putWall && <span className="text-[9px] text-red-400" title="Put GEX wall">●</span>}
                <span className="text-[10px] text-slate-600 font-mono w-8 text-right">{fmtOI(row.putOI)}</span>
                <div className="w-20 h-2 bg-slate-800 rounded-full overflow-hidden flex justify-end">
                  <div
                    className="h-full bg-red-500/60 rounded-full"
                    style={{ width: `${putBarPct}%` }}
                  />
                </div>
              </div>

              {/* Strike */}
              <div className="text-center">
                <span className={`text-xs font-mono font-bold ${
                  isATM ? 'text-blue-400' : isMaxPain ? 'text-amber-400' : 'text-slate-300'
                }`}>
                  ${row.strike}
                </span>
                {isATM && <span className="block text-[9px] text-blue-500 leading-none mt-0.5">ATM</span>}
                {isMaxPain && !isATM && <span className="block text-[9px] text-amber-500 leading-none mt-0.5">MAX PAIN</span>}
              </div>

              {/* Call bar — grows left to right */}
              <div className="flex items-center gap-1.5 pl-1">
                <div className="w-20 h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500/60 rounded-full"
                    style={{ width: `${callBarPct}%` }}
                  />
                </div>
                <span className="text-[10px] text-slate-600 font-mono w-8">{fmtOI(row.callOI)}</span>
                {callWall && <span className="text-[9px] text-emerald-400" title="Call GEX wall">●</span>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer annotations */}
      {(largestCallWall || largestPutWall || gex?.flipPoint) && (
        <div className="px-4 py-2.5 border-t border-slate-700/30 flex flex-wrap gap-3 text-[10px] text-slate-500">
          {gex?.flipPoint && (
            <span>GEX Flip: <span className="text-slate-300 font-mono">${gex.flipPoint}</span></span>
          )}
          {largestCallWall && (
            <span>Largest call wall: <span className="text-emerald-400 font-mono">${largestCallWall.strike}</span></span>
          )}
          {largestPutWall && (
            <span>Largest put wall: <span className="text-red-400 font-mono">${largestPutWall.strike}</span></span>
          )}
        </div>
      )}
    </div>
  );
}
