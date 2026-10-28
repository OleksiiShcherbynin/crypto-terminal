import { useEffect, useRef } from 'react';
import {
  CandlestickSeries,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from 'lightweight-charts';
import type { Candle, Interval } from '../../../domain/types';
import type { CandlesState } from '../candlesSlice';

export interface CandleChartProps {
  symbol: string;
  interval: Interval;
  candles: Candle[];
  status: CandlesState['status'];
  pricePrecision?: number;
}

const FALLBACK = {
  bg: '#0a0c0f',
  text: '#77828f',
  line: '#1f2630',
  up: '#2ebd85',
  down: '#f0455a',
};

function token(name: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

function priceFormat(precision: number) {
  return { type: 'price' as const, precision, minMove: 10 ** -precision };
}

const toBar = (c: Candle) => ({
  time: c.time as UTCTimestamp,
  open: c.open,
  high: c.high,
  low: c.low,
  close: c.close,
});

export function CandleChart({
  symbol,
  interval,
  candles,
  status,
  pricePrecision = 2,
}: CandleChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const pushedRef = useRef<{
    symbol: string;
    interval: Interval;
    first: number;
    length: number;
  } | null>(null);
  const precisionRef = useRef(pricePrecision);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const bg = token('--color-bg', FALLBACK.bg);
    const up = token('--color-up', FALLBACK.up);
    const down = token('--color-down', FALLBACK.down);
    const line = token('--color-line', FALLBACK.line);
    const chart = createChart(el, {
      autoSize: true,
      layout: {
        background: { color: bg },
        textColor: token('--color-muted', FALLBACK.text),
        fontFamily: token('--font-mono', 'monospace'),
      },
      grid: { vertLines: { color: line }, horzLines: { color: line } },
      rightPriceScale: { borderColor: line },
      timeScale: { borderColor: line, timeVisible: true, secondsVisible: false },
    });
    const series = chart.addSeries(CandlestickSeries, {
      upColor: up,
      downColor: down,
      borderUpColor: up,
      borderDownColor: down,
      wickUpColor: up,
      wickDownColor: down,
      priceFormat: priceFormat(precisionRef.current),
    });
    chartRef.current = chart;
    seriesRef.current = series;
    pushedRef.current = null;
    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      pushedRef.current = null;
    };
  }, []);

  useEffect(() => {
    precisionRef.current = pricePrecision;
    seriesRef.current?.applyOptions({ priceFormat: priceFormat(pricePrecision) });
  }, [pricePrecision]);

  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;
    const prev = pushedRef.current;
    if (candles.length === 0) {
      if (prev) series.setData([]);
      pushedRef.current = null;
      return;
    }
    const first = candles[0].time;
    const replaced =
      !prev ||
      prev.symbol !== symbol ||
      prev.interval !== interval ||
      prev.first !== first ||
      candles.length < prev.length ||
      candles.length > prev.length + 1;
    if (replaced) {
      series.setData(candles.map(toBar));
      chartRef.current?.timeScale().fitContent();
    } else {
      series.update(toBar(candles[candles.length - 1]));
    }
    pushedRef.current = { symbol, interval, first, length: candles.length };
  }, [candles, symbol, interval]);

  return (
    <div className="relative h-full min-h-60 w-full">
      <div ref={containerRef} className="absolute inset-0" />
      {status === 'loading' ? (
        <p className="absolute inset-0 flex items-center justify-center text-muted">Loading…</p>
      ) : null}
    </div>
  );
}
