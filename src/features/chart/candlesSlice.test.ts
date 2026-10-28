import { describe, expect, it } from 'vitest';
import { c } from '../../test/fixtures';
import candlesReducer, {
  candleReceived,
  candlesLoaded,
  candlesLoading,
  candlesUnavailable,
} from './candlesSlice';

const btc = { symbol: 'BTCUSDT', interval: '1m' } as const;

function ready(candles = [c(1)]) {
  let s = candlesReducer(undefined, candlesLoading(btc));
  s = candlesReducer(s, candlesLoaded({ ...btc, candles }));
  return s;
}

describe('candlesSlice', () => {
  it('has the idle initial state', () => {
    expect(candlesReducer(undefined, { type: 'init' })).toEqual({
      symbol: 'BTCUSDT',
      interval: '1m',
      status: 'idle',
      candles: [],
    });
  });

  it('loading sets target and clears candles', () => {
    const s = candlesReducer(ready(), candlesLoading({ symbol: 'ETHUSDT', interval: '1h' }));
    expect(s).toEqual({ symbol: 'ETHUSDT', interval: '1h', status: 'loading', candles: [] });
  });

  it('loads matching candles', () => {
    const s = ready([c(1), c(2)]);
    expect(s.status).toBe('ready');
    expect(s.candles).toHaveLength(2);
  });

  it('ignores candlesLoaded for another symbol', () => {
    let s = candlesReducer(undefined, candlesLoading({ symbol: 'ETHUSDT', interval: '1m' }));
    s = candlesReducer(s, candlesLoaded({ ...btc, candles: [c(1)] }));
    expect(s.status).toBe('loading');
    expect(s.candles).toEqual([]);
  });

  it('ignores candlesLoaded for another interval', () => {
    let s = candlesReducer(undefined, candlesLoading(btc));
    s = candlesReducer(s, candlesLoaded({ symbol: 'BTCUSDT', interval: '1h', candles: [c(1)] }));
    expect(s.status).toBe('loading');
  });

  it('marks unavailable only for the current target', () => {
    let s = candlesReducer(undefined, candlesLoading(btc));
    s = candlesReducer(s, candlesUnavailable({ symbol: 'ETHUSDT', interval: '1m' }));
    expect(s.status).toBe('loading');
    s = candlesReducer(s, candlesUnavailable(btc));
    expect(s.status).toBe('unavailable');
  });

  it('replaces the last candle when time matches and appends when newer', () => {
    let s = ready([c(1)]);
    s = candlesReducer(s, candleReceived({ ...btc, candle: c(1, 9) }));
    expect(s.candles).toEqual([c(1, 9)]);
    s = candlesReducer(s, candleReceived({ ...btc, candle: c(2) }));
    expect(s.candles.map((x) => x.time)).toEqual([1, 2]);
    s = candlesReducer(s, candleReceived({ ...btc, candle: c(0) }));
    expect(s.candles.map((x) => x.time)).toEqual([1, 2]);
  });

  it('merges live candles in unavailable state', () => {
    let s = candlesReducer(undefined, candlesLoading(btc));
    s = candlesReducer(s, candlesUnavailable(btc));
    s = candlesReducer(s, candleReceived({ ...btc, candle: c(5) }));
    expect(s.candles).toEqual([c(5)]);
  });

  it('does not merge live candles while loading', () => {
    let s = candlesReducer(undefined, candlesLoading(btc));
    s = candlesReducer(s, candleReceived({ ...btc, candle: c(1) }));
    expect(s.candles).toEqual([]);
  });

  it('ignores live candles for another symbol', () => {
    let s = ready([c(1)]);
    s = candlesReducer(s, candleReceived({ symbol: 'ETHUSDT', interval: '1m', candle: c(2) }));
    expect(s.candles).toEqual([c(1)]);
  });
});
