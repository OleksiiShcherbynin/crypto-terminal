import { describe, it, expect } from 'vitest';
import { WATCHED_PAIRS, findPair, miniTickerStream, klineStream, isKlineStream } from './pairs';

describe('pairs', () => {
  it('has 25 unique USDT pairs', () => {
    expect(new Set(WATCHED_PAIRS.map((p) => p.symbol)).size).toBe(25);
    WATCHED_PAIRS.forEach((p) => expect(p.quote).toBe('USDT'));
  });
  it('builds stream names in lowercase', () => {
    expect(miniTickerStream('BTCUSDT')).toBe('btcusdt@miniTicker');
    expect(klineStream('BTCUSDT', '15m')).toBe('btcusdt@kline_15m');
    expect(isKlineStream('btcusdt@kline_1m')).toBe(true);
    expect(isKlineStream('btcusdt@miniTicker')).toBe(false);
  });
  it('finds pairs and applies precisions', () => {
    expect(findPair('BTCUSDT')).toMatchObject({ pricePrecision: 2, qtyPrecision: 5 });
    expect(findPair('PEPEUSDT')?.pricePrecision).toBe(8);
    expect(findPair('XRPUSDT')).toMatchObject({ pricePrecision: 4, qtyPrecision: 2 });
    expect(findPair('NOPE')).toBeUndefined();
  });
});
