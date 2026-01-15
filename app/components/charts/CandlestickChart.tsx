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

function rsi(values: number[], period: number) {
  const out: (number | null)[] = [];
  let avgGain = 0;
  let avgLoss = 0;

  for (let i = 0; i < values.length; i++) {
    if (i === 0) {
      out.push(null);
      continue;
    }

    const change = values[i] - values[i - 1];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;

    if (i <= period) {
      avgGain += gain;
      avgLoss += loss;
      if (i === period) {
        avgGain = avgGain / period;
        avgLoss = avgLoss / period;
        const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
        out.push(100 - 100 / (1 + rs));
      } else {
        out.push(null);
      }
      continue;
    }

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    out.push(100 - 100 / (1 + rs));
  }
  return out;
}

function macd(values: number[], fast = 12, slow = 26, signal = 9) {
  const emaFast = ema(values, fast);
  const emaSlow = ema(values, slow);
  const macdLine: (number | null)[] = values.map((_, i) => {
    const f = emaFast[i];
    const s = emaSlow[i];
    if (f === null || s === null) return null;
    return f - s;
  });

  // Signal EMA on non-null values (keep alignment)
  const macdForEma = macdLine.map((v) => (v === null ? NaN : v));
  const sig = ema(macdForEma as unknown as number[], signal);
  const hist: (number | null)[] = macdLine.map((m, i) => {
    const s = sig[i];
    if (m === null || s === null) return null;
    return m - s;
  });

  return { macdLine, signalLine: sig, histogram: hist };
}

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
  showRSI = false,
  showMACD = false,
}: {
  candles: Candle[];
  height?: number;
  overlays: Record<OverlayKey, boolean>;
  showRSI?: boolean;
  showMACD?: boolean;
}) {
  const priceContainerRef = useRef<HTMLDivElement | null>(null);
  const volumeContainerRef = useRef<HTMLDivElement | null>(null);
  const rsiContainerRef = useRef<HTMLDivElement | null>(null);
  const macdContainerRef = useRef<HTMLDivElement | null>(null);

  const priceChartRef = useRef<IChartApi | null>(null);
  const volumeChartRef = useRef<IChartApi | null>(null);
  const rsiChartRef = useRef<IChartApi | null>(null);
  const macdChartRef = useRef<IChartApi | null>(null);

  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const overlaySeriesRef = useRef<Record<string, ISeriesApi<'Line'>>>({});
  const rsiSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const macdLineRef = useRef<ISeriesApi<'Line'> | null>(null);
  const macdSignalRef = useRef<ISeriesApi<'Line'> | null>(null);
  const macdHistRef = useRef<ISeriesApi<'Histogram'> | null>(null);

  const { candleData, volumeData, lineOverlays, rsiLine, macdLines } = useMemo(() => {
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
      color: c.close >= c.open ? 'rgba(34,197,94,0.45)' : 'rgba(239,68,68,0.45)',
    }));

    const closes = rows.map((c) => c.close);
    const ema20 = ema(closes, 20);
    const ema50 = ema(closes, 50);
    const mid = sma(closes, 20);
    const sd = stddev(closes, 20, mid);
    const upper = mid.map((m, i) => (m === null || sd[i] === null ? null : (m + 2 * (sd[i] as number))));
    const lower = mid.map((m, i) => (m === null || sd[i] === null ? null : (m - 2 * (sd[i] as number))));
    const vwap = computeVwap(rows);

    const rsi14 = rsi(closes, 14);
    const macdObj = macd(closes, 12, 26, 9);

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
      rsiLine: mkLine(rsi14),
      macdLines: {
        macd: mkLine(macdObj.macdLine),
        signal: mkLine(macdObj.signalLine),
        hist: rows
          .map((c, i) => {
            const v = (macdObj.histogram[i] ?? 0) as number;
            return {
              time: toUtcSeconds(c.time),
              value: v,
              color: v >= 0 ? 'rgba(34,197,94,0.45)' : 'rgba(239,68,68,0.45)',
            };
          })
          .filter((p) => Number.isFinite(p.value)),
      },
    };
  }, [candles]);

  useEffect(() => {
    if (!priceContainerRef.current || !volumeContainerRef.current) return;

    // Lazy import to keep server build clean
    let mounted = true;
    (async () => {
      const lw = await import('lightweight-charts');
      if (!mounted || !priceContainerRef.current || !volumeContainerRef.current) return;

      const baseChartOpts = {
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
          timeVisible: true,
          secondsVisible: false,
        },
        crosshair: {
          vertLine: { color: 'rgba(148,163,184,0.25)' },
          horzLine: { color: 'rgba(148,163,184,0.25)' },
        },
      } as const;

      const priceChart = lw.createChart(priceContainerRef.current, {
        ...baseChartOpts,
        height,
      });

      const volumeChart = lw.createChart(volumeContainerRef.current, {
        ...baseChartOpts,
        height: 80,
      });

      // Hide time axis on sub panes to feel like one chart stack
      volumeChart.applyOptions({ timeScale: { visible: false } });

      let rsiChart: any = null;
      let macdChart: any = null;

      if (showRSI && rsiContainerRef.current) {
        rsiChart = lw.createChart(rsiContainerRef.current, { ...baseChartOpts, height: 70 });
        rsiChart.applyOptions({ timeScale: { visible: false } });
      }

      if (showMACD && macdContainerRef.current) {
        macdChart = lw.createChart(macdContainerRef.current, { ...baseChartOpts, height: 90 });
        macdChart.applyOptions({ timeScale: { visible: true } });
      }

      // Series
      const candleSeries = priceChart.addCandlestickSeries({
        upColor: '#22c55e',
        downColor: '#ef4444',
        borderUpColor: '#22c55e',
        borderDownColor: '#ef4444',
        wickUpColor: '#22c55e',
        wickDownColor: '#ef4444',
      });

      const volSeries = volumeChart.addHistogramSeries({
        priceFormat: { type: 'volume' },
        color: 'rgba(148,163,184,0.35)',
      });

      try {
        volSeries.priceScale().applyOptions({ scaleMargins: { top: 0.2, bottom: 0 } });
      } catch {}

      let rsiSeries: any = null;
      if (rsiChart) {
        rsiSeries = rsiChart.addLineSeries({
          color: 'rgba(56,189,248,0.9)',
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: false,
        });
        try {
          rsiChart.rightPriceScale().applyOptions({ scaleMargins: { top: 0.15, bottom: 0.15 } });
        } catch {}
      }

      let macdLine: any = null;
      let macdSignal: any = null;
      let macdHist: any = null;
      if (macdChart) {
        macdHist = macdChart.addHistogramSeries({
          color: 'rgba(148,163,184,0.35)',
          priceLineVisible: false,
          lastValueVisible: false,
        });
        macdLine = macdChart.addLineSeries({
          color: 'rgba(167,139,250,0.9)',
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: false,
        });
        macdSignal = macdChart.addLineSeries({
          color: 'rgba(245,158,11,0.9)',
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: false,
        });
      }

      // Refs
      priceChartRef.current = priceChart;
      volumeChartRef.current = volumeChart;
      rsiChartRef.current = rsiChart;
      macdChartRef.current = macdChart;
      candleSeriesRef.current = candleSeries;
      volumeSeriesRef.current = volSeries;
      rsiSeriesRef.current = rsiSeries;
      macdLineRef.current = macdLine;
      macdSignalRef.current = macdSignal;
      macdHistRef.current = macdHist;
      overlaySeriesRef.current = {};

      // Sync visible range from price -> subcharts
      const syncRange = (range: any) => {
        try { volumeChart.timeScale().setVisibleRange(range); } catch {}
        try { rsiChart?.timeScale().setVisibleRange(range); } catch {}
        try { macdChart?.timeScale().setVisibleRange(range); } catch {}
      };
      priceChart.timeScale().subscribeVisibleTimeRangeChange(syncRange);

      // Resize observer
      const ro = new ResizeObserver(() => {
        const w = priceContainerRef.current?.clientWidth || 0;
        if (w <= 0) return;
        try { priceChart.applyOptions({ width: w, height }); } catch {}
        try { volumeChart.applyOptions({ width: w, height: 80 }); } catch {}
        try { rsiChart?.applyOptions({ width: w, height: 70 }); } catch {}
        try { macdChart?.applyOptions({ width: w, height: 90 }); } catch {}
      });
      ro.observe(priceContainerRef.current);

      // Cleanup handler
      return () => {
        try { priceChart.timeScale().unsubscribeVisibleTimeRangeChange(syncRange); } catch {}
        ro.disconnect();
      };
    })();

    return () => {
      mounted = false;
      const removeSafe = (c: any) => {
        try { c?.remove(); } catch {}
      };
      removeSafe(priceChartRef.current);
      removeSafe(volumeChartRef.current);
      removeSafe(rsiChartRef.current);
      removeSafe(macdChartRef.current);
      priceChartRef.current = null;
      volumeChartRef.current = null;
      rsiChartRef.current = null;
      macdChartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      rsiSeriesRef.current = null;
      macdLineRef.current = null;
      macdSignalRef.current = null;
      macdHistRef.current = null;
      overlaySeriesRef.current = {};
    };
  }, [height, showRSI, showMACD]);

  // Push data + overlays
  useEffect(() => {
    const priceChart = priceChartRef.current;
    const candleSeries = candleSeriesRef.current;
    const volSeries = volumeSeriesRef.current;
    if (!priceChart || !candleSeries || !volSeries) return;

    candleSeries.setData(candleData);
    volSeries.setData(volumeData);
    try { priceChart.timeScale().fitContent(); } catch {}

    // RSI / MACD
    if (rsiSeriesRef.current) {
      rsiSeriesRef.current.setData(rsiLine);
    }
    if (macdLineRef.current && macdSignalRef.current && macdHistRef.current) {
      macdLineRef.current.setData(macdLines.macd);
      macdSignalRef.current.setData(macdLines.signal);
      macdHistRef.current.setData(macdLines.hist);
    }

    const ensureLine = (key: string, opts?: any) => {
      const existing = overlaySeriesRef.current[key];
      if (existing) return existing;
      const s = priceChart.addLineSeries({
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
  }, [candleData, volumeData, overlays, lineOverlays, rsiLine, macdLines]);

  return (
    <div className="w-full rounded-2xl border border-slate-800 bg-slate-900/10 overflow-hidden">
      <div ref={priceContainerRef} className="w-full" style={{ height }} />
      <div ref={volumeContainerRef} className="w-full" style={{ height: 80 }} />
      {showRSI ? <div ref={rsiContainerRef} className="w-full" style={{ height: 70 }} /> : null}
      {showMACD ? <div ref={macdContainerRef} className="w-full" style={{ height: 90 }} /> : null}
    </div>
  );
}
