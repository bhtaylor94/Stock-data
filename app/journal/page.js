'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year, month) {
  return new Date(year, month, 1).getDay();
}

function formatMoney(n) {
  if (n === 0) return '$0';
  const sign = n >= 0 ? '+' : '';
  return `${sign}$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

// ── P/L Calendar Grid ──
function PLCalendar({ calendar, currentMonth, onDayClick, onMonthChange }) {
  const [year, month] = currentMonth.split('-').map(Number);
  const daysInMonth = getDaysInMonth(year, month - 1);
  const firstDay = getFirstDayOfMonth(year, month - 1);

  const cells = [];
  // Empty cells before first day
  for (let i = 0; i < firstDay; i++) cells.push(null);
  // Day cells
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const data = calendar[dateStr];
    cells.push({ day: d, date: dateStr, pl: data?.pl || null, notes: data?.notes || '' });
  }

  // Monthly total
  const monthTotal = Object.entries(calendar)
    .filter(([d]) => d.startsWith(currentMonth))
    .reduce((sum, [, v]) => sum + (v.pl || 0), 0);

  const prevMonth = () => {
    const d = new Date(year, month - 2, 1);
    onMonthChange(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };
  const nextMonth = () => {
    const d = new Date(year, month, 1);
    onMonthChange(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  return (
    <div>
      {/* Month header */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={prevMonth} className="text-white/30 hover:text-white/60 font-mono text-sm px-2 py-1 transition-colors">◀</button>
        <div className="text-center">
          <span className="text-lg font-bold font-display text-white">{MONTHS[month - 1]} {year}</span>
          <span className="block text-sm font-mono mt-0.5" style={{ color: monthTotal >= 0 ? '#22c55e' : '#ef4444' }}>
            {formatMoney(monthTotal)}
          </span>
        </div>
        <button onClick={nextMonth} className="text-white/30 hover:text-white/60 font-mono text-sm px-2 py-1 transition-colors">▶</button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DAYS.map(d => (
          <div key={d} className="text-center text-[9px] font-mono text-white/20 py-1">{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell, i) => {
          if (!cell) return <div key={`empty-${i}`} className="aspect-square" />;

          const hasPL = cell.pl !== null;
          const isPositive = cell.pl > 0;
          const isNegative = cell.pl < 0;
          const isZero = cell.pl === 0;
          const isToday = cell.date === new Date().toISOString().split('T')[0];
          const isWeekend = new Date(cell.date).getDay() === 0 || new Date(cell.date).getDay() === 6;

          return (
            <button
              key={cell.date}
              onClick={() => onDayClick(cell)}
              className="aspect-square rounded-lg flex flex-col items-center justify-center transition-all hover:scale-105 relative"
              style={{
                background: hasPL
                  ? isPositive ? 'rgba(34,197,94,0.12)' : isNegative ? 'rgba(239,68,68,0.12)' : 'rgba(255,255,255,0.03)'
                  : isWeekend ? 'rgba(255,255,255,0.01)' : 'rgba(255,255,255,0.02)',
                border: isToday ? '1px solid rgba(0,212,255,0.3)' : '1px solid transparent',
                boxShadow: hasPL && isPositive ? '0 0 12px rgba(34,197,94,0.1)' : hasPL && isNegative ? '0 0 12px rgba(239,68,68,0.1)' : 'none',
              }}
            >
              <span className="text-[10px] font-mono" style={{
                color: isToday ? '#00d4ff' : hasPL ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.2)',
              }}>{cell.day}</span>
              {hasPL && (
                <span className="text-[10px] font-bold font-mono leading-none mt-0.5" style={{
                  color: isPositive ? '#22c55e' : isNegative ? '#ef4444' : 'rgba(255,255,255,0.3)',
                  textShadow: isPositive ? '0 0 6px rgba(34,197,94,0.3)' : isNegative ? '0 0 6px rgba(239,68,68,0.3)' : 'none',
                }}>
                  {formatMoney(cell.pl)}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Stats bar ──
function StatsBar({ stats }) {
  if (!stats) return null;
  return (
    <div className="grid grid-cols-4 gap-3 mb-6">
      {[
        { label: 'Total P/L', value: formatMoney(stats.totalPL), color: stats.totalPL >= 0 ? '#22c55e' : '#ef4444' },
        { label: 'Win Rate', value: `${stats.winRate}%`, color: stats.winRate >= 50 ? '#22c55e' : '#ef4444' },
        { label: 'Best Day', value: formatMoney(stats.bestDay), color: '#22c55e' },
        { label: 'Worst Day', value: formatMoney(stats.worstDay), color: '#ef4444' },
      ].map(s => (
        <div key={s.label} className="rounded-lg p-3 text-center" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
          <span className="block text-[9px] font-mono text-white/25 mb-1">{s.label}</span>
          <span className="text-lg font-bold font-mono" style={{ color: s.color }}>{s.value}</span>
        </div>
      ))}
    </div>
  );
}

// ── Entry modal ──
function EntryModal({ day, onSave, onClose }) {
  const [pl, setPl] = useState(day?.pl !== null ? String(day.pl) : '');
  const [notes, setNotes] = useState(day?.notes || '');

  const handleSave = () => {
    if (pl === '') return;
    onSave(day.date, parseFloat(pl), notes);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}>
      <div className="w-full max-w-sm rounded-xl p-5" style={{ background: '#12121a', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="flex justify-between items-center mb-4">
          <span className="text-sm font-bold font-display text-white">{day.date}</span>
          <button onClick={onClose} className="text-white/30 hover:text-white/60 text-lg">✕</button>
        </div>

        <div className="mb-4">
          <label className="block text-[10px] font-bold text-white/30 font-mono mb-1 tracking-wide">DAILY P/L ($)</label>
          <input
            type="number"
            step="0.01"
            value={pl}
            onChange={e => setPl(e.target.value)}
            placeholder="e.g. 245.50 or -120"
            className="w-full bg-white/[0.03] border border-white/10 rounded-lg px-3 py-3 text-xl text-center font-bold font-mono focus:outline-none focus:border-cyan-500/30"
            style={{ color: parseFloat(pl) >= 0 ? '#22c55e' : parseFloat(pl) < 0 ? '#ef4444' : 'white' }}
            autoFocus
          />
        </div>

        <div className="mb-4">
          <label className="block text-[10px] font-bold text-white/30 font-mono mb-1 tracking-wide">NOTES (optional)</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="e.g. NVDA call +$245, closed TSLA put -$80"
            className="w-full bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2 text-sm font-mono text-white/60 focus:outline-none focus:border-cyan-500/30 resize-none h-20"
          />
        </div>

        <div className="flex gap-2">
          <button onClick={handleSave}
            className="flex-1 py-2.5 rounded-lg text-sm font-bold font-mono"
            style={{ background: '#00d4ff', color: '#08080a' }}>
            Save
          </button>
          {day.pl !== null && (
            <button onClick={() => onSave(day.date, null, '')}
              className="px-4 py-2.5 rounded-lg text-sm font-mono text-red-400/60 border border-red-500/20 hover:bg-red-500/10 transition-colors">
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Journal Page ──
export default function JournalPage() {
  const now = new Date();
  const [currentMonth, setCurrentMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
  const [calendar, setCalendar] = useState({});
  const [stats, setStats] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [calRes, statsRes] = await Promise.all([
        fetch('/api/journal?type=calendar'),
        fetch('/api/journal?type=stats'),
      ]);
      if (calRes.ok) { const d = await calRes.json(); setCalendar(d.calendar || {}); }
      if (statsRes.ok) { const d = await statsRes.json(); setStats(d.stats); }
    } catch { }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const handleSave = async (date, pl, notes) => {
    if (pl === null) {
      // Delete
      await fetch('/api/journal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_daily_pl', date }),
      });
    } else {
      await fetch('/api/journal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'log_daily_pl', date, pl, notes }),
      });
    }
    setSelectedDay(null);
    fetchData();
  };

  return (
    <div className="min-h-screen" style={{ background: '#08080a' }}>
      {/* Header */}
      <div className="sticky top-0 z-10 backdrop-blur-xl border-b border-white/5" style={{ background: 'rgba(8,8,10,0.94)' }}>
        <div className="max-w-[680px] mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/" className="text-white/30 hover:text-white/60 text-sm font-mono transition-colors">← Feed</Link>
          <span className="text-[17px] font-extrabold tracking-tight font-display text-white">JOURNAL</span>
        </div>
      </div>

      <div className="max-w-[680px] mx-auto px-4 py-6">
        {loading ? (
          <div className="text-center py-20 text-white/20 text-sm font-mono">Loading journal...</div>
        ) : (
          <>
            {/* Stats */}
            <StatsBar stats={stats} />

            {/* Calendar */}
            <PLCalendar
              calendar={calendar}
              currentMonth={currentMonth}
              onDayClick={setSelectedDay}
              onMonthChange={setCurrentMonth}
            />

            {/* Instructions */}
            <p className="text-center text-[10px] text-white/15 font-mono mt-6">
              Tap any day to log your P/L. Green = profit. Red = loss.
            </p>
          </>
        )}
      </div>

      {/* Entry modal */}
      {selectedDay && (
        <EntryModal day={selectedDay} onSave={handleSave} onClose={() => setSelectedDay(null)} />
      )}
    </div>
  );
}
