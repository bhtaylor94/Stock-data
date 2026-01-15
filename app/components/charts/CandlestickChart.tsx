'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import type {
  IChartApi,
  ISeriesApi,
  UTCTimestamp,
  CandlestickData,
  LineData,
  HistogramData,
} from 'lightweight-charts';

type Candle = { time: number; open: number; high: number; low: number; close: number; volume?: number };

type OverlayKey = 'EMA20' | 'EMA50' | 'VWAP' | 'BBANDS';

function toUtcSeconds(t: number): UTCTimestamp {
  const n = Number(t);
  const sec = n > 1e12 ? Math.floor(n / 1000) : Math.floor(n);
  return sec as unknown as UTCTimestamp;
}

function ema(values: number[], period: number) {
  const k = 2 / (period + 1);
  const out: (number | null)[] = [];
  let prev: number | null = null;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (!Number.isFinite(v)) {
      out.push(null);
      continue;
    }
    if (prev === null) {
      prev = v;
      out.push(v);
      continue;
    }
    prev = v * k + prev * (1 - k);
    out.push(prev);
  }
  return out;
}

function sma(values: number[], period: number) {
  const out: (number | null)[] = [];
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    sum += v;
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) out.push(sum / period);
    else out.push(null);
  }
  return out;
}

function stddev(values: number[], period: number, meanArr: (number | null)[]) {
  const out: (number | null)[] = [];
  for (let i = 0; i < values.length; i++) {
    const m = meanArr[i];
    if (m === null || i < period - 1) {
      out.push(null);
      continue;
    }
    let s = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const d = values[j] - m;
      s += d * d;
    }
    out.push(Math.sqrt(s / period));
  }
  return out;
}

function computeVwap(candles: Candle[]) {
  const out: (number | null)[] = [];
  let cumPV = 0;
  let cumV = 0;
  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    const v = Number(c.volume || 0);
    const typical = (c.high + c.low + c.close) / 3;
    if (v <= 0 || !Number.isFinite(typical)) {
      out.push(cumV > 0 ? cumPV / cumV : null);
      continue;
    }
    cumPV += typical * v;
    cumV += v;
    out.push(cumPV / Math.max(1e-9, cumV));
  }
  return out;
}

export default function CandlestickChart({
  candles,
  height = 280,
  overlays,
}: {
  candles: Candle[];
  height?: number;
  overlays: Record<OverlayKey, boolean>;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const overlaySeriesRef = useRef<Record<string, ISeriesApi<'Line'>>>({});

  const { candleData, volumeData, lineOverlays } = useMemo(() => {
    const rows = (candles || [])
      .filter((c) => c && c.time && Number.isFinite(c.open) && Number.isFinite(c.close))
      .sort((a, b) => a.time - b.time);

    const cd: CandlestickData[] = rows.map((c) => ({
      time: toUtcSeconds(c.time),
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));

    const vd: HistogramData[] = rows.map((c) => ({
      time: toUtcSeconds(c.time),
      value: Number(c.volume || 0),
    }));

    const closes = rows.map((c) => c.close);
    const ema20 = ema(closes, 20);
    const ema50 = ema(closes, 50);
    const mid = sma(closes, 20);
    const sd = stddev(closes, 20, mid);
    const upper = mid.map((m, i) => (m === null || sd[i] === null ? null : (m + 2 * (sd[i] as number))));
    const lower = mid.map((m, i) => (m === null || sd[i] === null ? null : (m - 2 * (sd[i] as number))));
    const vwap = computeVwap(rows);

    const mkLine = (arr: (number | null)[]): LineData[] =>
      rows
        .map((c, i) => ({
          time: toUtcSeconds(c.time),
          value: arr[i] as number,
        }))
        .filter((p) => Number.isFinite(p.value));

    return {
      candleData: cd,
      volumeData: vd,
      lineOverlays: {
        EMA20: mkLine(ema20),
        EMA50: mkLine(ema50),
        VWAP: mkLine(vwap),
        BB_MID: mkLine(mid),
        BB_UPPER: mkLine(upper),
        BB_LOWER: mkLine(lower),
      } as Record<string, LineData[]>,
    };
  }, [candles]);

  useEffect(() => {
    if (!containerRef.current) return;

    // Lazy import to keep server build clean
    let mounted = true;
    (async () => {
      const lw = await import('lightweight-charts');
      if (!mounted || !containerRef.current) return;

      const chart = lw.createChart(containerRef.current, {
        height,
        layout: {
          background: { color: 'transparent' },
          textColor: 'rgba(226,232,240,0.85)',
        },
        grid: {
          vertLines: { color: 'rgba(148,163,184,0.08)' },
          horzLines: { color: 'rgba(148,163,184,0.08)' },
        },
        rightPriceScale: {
          borderColor: 'rgba(148,163,184,0.15)',
        },
        timeScale: {
          borderColor: 'rgba(148,163,184,0.15)',
        },
        crosshair: {
          vertLine: { color: 'rgba(148,163,184,0.25)' },
          horzLine: { color: 'rgba(148,163,184,0.25)' },
        },
      });

      const candleSeries = chart.addCandlestickSeries({
        upColor: '#22c55e',
        downColor: '#ef4444',
        borderUpColor: '#22c55e',
        borderDownColor: '#ef4444',
        wickUpColor: '#22c55e',
        wickDownColor: '#ef4444',
      });

      const volSeries = chart.addHistogramSeries({
        priceFormat: { type: 'volume' },
        priceScaleId: '',
        scaleMargins: { top: 0.8, bottom: 0 },
        color: 'rgba(148,163,184,0.35)',
      });

      chartRef.current = chart;
      candleSeriesRef.current = candleSeries;
      volumeSeriesRef.current = volSeries;

      // Resize observer for responsive width
      const ro = new ResizeObserver(() => {
        if (!containerRef.current || !chartRef.current) return;
        chartRef.current.applyOptions({ width: containerRef.current.clientWidth, height });
      });
      ro.observe(containerRef.current);

      return () => {
        ro.disconnect();
      };
    })();

    return () => {
      mounted = false;
      try {
        chartRef.current?.remove();
      } catch {}
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      overlaySeriesRef.current = {};
    };
  }, [height]);

  // Push data + overlays
  useEffect(() => {
    const chart = chartRef.current;
    const candleSeries = candleSeriesRef.current;
    const volSeries = volumeSeriesRef.current;
    if (!chart || !candleSeries || !volSeries) return;

    candleSeries.setData(candleData);
    volSeries.setData(volumeData);
    chart.timeScale().fitContent();

    const ensureLine = (key: string, opts?: any) => {
      const existing = overlaySeriesRef.current[key];
      if (existing) return existing;
      const s = chart.addLineSeries({
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
        ...opts,
      });
      overlaySeriesRef.current[key] = s;
      return s;
    };

    const setOrClear = (key: string, enabled: boolean, data: LineData[], opts?: any) => {
      if (!enabled) {
        if (overlaySeriesRef.current[key]) {
          overlaySeriesRef.current[key].setData([]);
        }
        return;
      }
      const s = ensureLine(key, opts);
      s.setData(data);
    };

    setOrClear('EMA20', overlays.EMA20, lineOverlays.EMA20, { color: 'rgba(56,189,248,0.9)' });
    setOrClear('EMA50', overlays.EMA50, lineOverlays.EMA50, { color: 'rgba(167,139,250,0.9)' });
    setOrClear('VWAP', overlays.VWAP, lineOverlays.VWAP, { color: 'rgba(245,158,11,0.9)', lineWidth: 2 });

    const bbOn = overlays.BBANDS;
    setOrClear('BB_MID', bbOn, lineOverlays.BB_MID, { color: 'rgba(148,163,184,0.75)', lineWidth: 1 });
    setOrClear('BB_UPPER', bbOn, lineOverlays.BB_UPPER, { color: 'rgba(148,163,184,0.55)', lineWidth: 1 });
    setOrClear('BB_LOWER', bbOn, lineOverlays.BB_LOWER, { color: 'rgba(148,163,184,0.55)', lineWidth: 1 });
  }, [candleData, volumeData, overlays, lineOverlays]);

  return (
    <div
      ref={containerRef}
      className="w-full rounded-2xl border border-slate-800 bg-slate-900/10 overflow-hidden"
      style={{ height }}
    />
  );
}
