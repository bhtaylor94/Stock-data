'use client';
import React, { useEffect, useRef } from 'react';
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  ColorType,
  CrosshairMode,
} from 'lightweight-charts';

export interface PriceCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface StockChartProps {
  priceHistory: PriceCandle[];
  sma20?: number;
  sma50?: number;
  ticker?: string;
}

// Convert unix-seconds timestamp to YYYY-MM-DD string required by lightweight-charts
function toDateStr(unixSec: number): string {
  const d = new Date(unixSec * 1000);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function StockChart({ priceHistory, ticker }: StockChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || priceHistory.length < 5) return;

    const container = containerRef.current;

    const chart = createChart(container, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#94a3b8',
        fontSize: 11,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      },
      grid: {
        vertLines: { color: 'rgba(100,116,139,0.08)' },
        horzLines: { color: 'rgba(100,116,139,0.08)' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: 'rgba(148,163,184,0.3)', labelBackgroundColor: '#1e293b' },
        horzLine: { color: 'rgba(148,163,184,0.3)', labelBackgroundColor: '#1e293b' },
      },
      rightPriceScale: {
        borderColor: 'rgba(100,116,139,0.2)',
        scaleMargins: { top: 0.08, bottom: 0.28 },
      },
      timeScale: {
        borderColor: 'rgba(100,116,139,0.2)',
        timeVisible: false,
        secondsVisible: false,
      },
      width: container.clientWidth,
      height: 320,
    });

    // Build sorted, deduplicated candle data with valid timestamps
    const validCandles = priceHistory
      .filter(c => c.time > 0 && Number.isFinite(c.close) && c.close > 0)
      .sort((a, b) => a.time - b.time);

    // Deduplicate by date string
    const seen = new Set<string>();
    const candleData = validCandles.reduce<{ time: string; open: number; high: number; low: number; close: number }[]>((acc, c) => {
      const dateStr = toDateStr(c.time);
      if (!seen.has(dateStr)) {
        seen.add(dateStr);
        acc.push({ time: dateStr, open: c.open, high: c.high, low: c.low, close: c.close });
      }
      return acc;
    }, []);

    const volumeData = validCandles.reduce<{ time: string; value: number; color: string }[]>((acc, c) => {
      const dateStr = toDateStr(c.time);
      if (!acc.find(x => x.time === dateStr)) {
        acc.push({
          time: dateStr,
          value: c.volume,
          color: c.close >= c.open ? 'rgba(16,185,129,0.35)' : 'rgba(239,68,68,0.35)',
        });
      }
      return acc;
    }, []);

    if (candleData.length < 2) {
      chart.remove();
      return;
    }

    // Candlestick series
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#10b981',
      downColor: '#ef4444',
      borderUpColor: '#10b981',
      borderDownColor: '#ef4444',
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
    });
    candleSeries.setData(candleData);

    // Volume histogram on a separate pane-like overlay using price scale
    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    });
    chart.priceScale('volume').applyOptions({
      scaleMargins: { top: 0.78, bottom: 0 },
    });
    volumeSeries.setData(volumeData);

    // Simple SMA overlays computed from candle data closes
    const closes = candleData.map(c => c.close);
    const times = candleData.map(c => c.time);

    function buildSMASeries(period: number, color: string) {
      if (closes.length < period) return;
      const smaData: { time: string; value: number }[] = [];
      for (let i = period - 1; i < closes.length; i++) {
        const slice = closes.slice(i - period + 1, i + 1);
        const avg = slice.reduce((a, b) => a + b, 0) / period;
        smaData.push({ time: times[i], value: Math.round(avg * 100) / 100 });
      }
      const smaSeries = chart.addSeries(LineSeries, {
        color,
        lineWidth: 1,
        crosshairMarkerVisible: false,
        lastValueVisible: true,
        priceLineVisible: false,
      });
      smaSeries.setData(smaData);
    }

    buildSMASeries(20, 'rgba(251,191,36,0.7)');  // SMA20: amber
    buildSMASeries(50, 'rgba(96,165,250,0.7)');   // SMA50: blue

    // Fit and handle resize
    chart.timeScale().fitContent();

    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        chart.applyOptions({ width: entry.contentRect.width });
      }
    });
    ro.observe(container);

    return () => {
      ro.disconnect();
      chart.remove();
    };
  }, [priceHistory]);

  if (priceHistory.length < 5) return null;

  return (
    <div className="rounded-2xl border border-slate-700/50 bg-slate-800/30 overflow-hidden">
      <div className="flex items-center justify-between px-4 pt-3 pb-1">
        <h3 className="text-xs font-semibold text-slate-300 tracking-wide uppercase">
          {ticker ? `${ticker} — ` : ''}Price History
        </h3>
        <div className="flex items-center gap-3 text-[10px] text-slate-500">
          <span className="flex items-center gap-1">
            <span className="inline-block w-5 h-px bg-amber-400/70" /> SMA 20
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-5 h-px bg-blue-400/70" /> SMA 50
          </span>
        </div>
      </div>
      <div ref={containerRef} className="w-full" style={{ height: 320 }} />
    </div>
  );
}
