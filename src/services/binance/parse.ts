import { INTERVALS, type Candle, type Interval, type Ticker } from '../../domain/types';
import type { RawKline, RawMiniTicker } from './types';

export type MarketEvent =
  | { kind: 'ticker'; ticker: Ticker }
  | { kind: 'candle'; symbol: string; interval: Interval; candle: Candle };

function toInterval(value: string): Interval | null {
  return INTERVALS.find((i) => i === value) ?? null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseTicker(d: RawMiniTicker, now: () => number): MarketEvent {
  const last = Number(d.c);
  const open = Number(d.o);
  return {
    kind: 'ticker',
    ticker: {
      symbol: d.s,
      last,
      open,
      high: Number(d.h),
      low: Number(d.l),
      volume: Number(d.v),
      changePct: open === 0 ? 0 : ((last - open) / open) * 100,
      receivedAt: now(),
    },
  };
}

function parseKline(d: RawKline): MarketEvent | null {
  const interval = toInterval(d.k.i);
  if (!interval) return null;
  return {
    kind: 'candle',
    symbol: d.s,
    interval,
    candle: {
      time: Math.floor(d.k.t / 1000),
      open: Number(d.k.o),
      high: Number(d.k.h),
      low: Number(d.k.l),
      close: Number(d.k.c),
      volume: Number(d.k.v),
    },
  };
}

/** Returns null for subscribe acks, unknown events and malformed JSON. */
export function parseStreamMessage(raw: string, now: () => number = Date.now): MarketEvent | null {
  let msg: unknown;
  try {
    msg = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(msg) || !isRecord(msg.data)) return null;
  const data = msg.data;
  if (data.e === '24hrMiniTicker') return parseTicker(data as unknown as RawMiniTicker, now);
  if (data.e === 'kline' && isRecord(data.k)) return parseKline(data as unknown as RawKline);
  return null;
}
