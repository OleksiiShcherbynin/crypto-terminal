import type { Interval, Pair } from './types';

const QUOTE = 'USDT';
const TWO_DP_PRICE = new Set(['BTC', 'ETH', 'BNB', 'SOL', 'LTC']);

function makePair(base: string): Pair {
  const pricePrecision = base === 'PEPE' ? 8 : TWO_DP_PRICE.has(base) ? 2 : 4;
  const qtyPrecision = base === 'BTC' ? 5 : base === 'ETH' ? 4 : 2;
  return { symbol: `${base}${QUOTE}`, base, quote: QUOTE, pricePrecision, qtyPrecision };
}

// POL replaces MATIC (renamed by Binance in 2024; MATICUSDT is frozen).
const BASES = [
  'BTC',
  'ETH',
  'BNB',
  'SOL',
  'XRP',
  'ADA',
  'DOGE',
  'AVAX',
  'DOT',
  'LINK',
  'POL',
  'LTC',
  'TRX',
  'UNI',
  'ATOM',
  'NEAR',
  'APT',
  'ARB',
  'OP',
  'FIL',
  'ETC',
  'XLM',
  'ICP',
  'SUI',
  'PEPE',
];

export const WATCHED_PAIRS: readonly Pair[] = BASES.map(makePair);

export function findPair(symbol: string): Pair | undefined {
  return WATCHED_PAIRS.find((p) => p.symbol === symbol);
}

export function miniTickerStream(symbol: string): string {
  return `${symbol.toLowerCase()}@miniTicker`;
}

export function klineStream(symbol: string, interval: Interval): string {
  return `${symbol.toLowerCase()}@kline_${interval}`;
}

export function isKlineStream(stream: string): boolean {
  return stream.includes('@kline_');
}
