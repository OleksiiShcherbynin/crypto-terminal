import { describe, expect, it } from 'vitest';
import { parseStreamMessage } from './parse';

const kline = (i: string) =>
  JSON.stringify({
    stream: `btcusdt@kline_${i}`,
    data: {
      e: 'kline',
      E: 1,
      s: 'BTCUSDT',
      k: {
        t: 1700000000000,
        T: 1700000059999,
        s: 'BTCUSDT',
        i,
        o: '1',
        c: '1.5',
        h: '2',
        l: '0.5',
        v: '10',
        x: false,
      },
    },
  });

describe('parseStreamMessage', () => {
  it('parses miniTicker into Ticker with changePct', () => {
    const raw = JSON.stringify({
      stream: 'btcusdt@miniTicker',
      data: {
        e: '24hrMiniTicker',
        E: 1,
        s: 'BTCUSDT',
        c: '101',
        o: '100',
        h: '102',
        l: '99',
        v: '10',
        q: '1000',
      },
    });
    expect(parseStreamMessage(raw, () => 5)).toEqual({
      kind: 'ticker',
      ticker: {
        symbol: 'BTCUSDT',
        last: 101,
        open: 100,
        high: 102,
        low: 99,
        volume: 10,
        changePct: 1,
        receivedAt: 5,
      },
    });
  });

  it('gives changePct 0 when open is 0', () => {
    const raw = JSON.stringify({
      stream: 'x@miniTicker',
      data: { e: '24hrMiniTicker', E: 1, s: 'X', c: '1', o: '0', h: '1', l: '0', v: '1', q: '1' },
    });
    const ev = parseStreamMessage(raw, () => 1);
    expect(ev?.kind === 'ticker' && ev.ticker.changePct).toBe(0);
  });

  it('parses kline into Candle with seconds time', () => {
    expect(parseStreamMessage(kline('1m'))).toEqual({
      kind: 'candle',
      symbol: 'BTCUSDT',
      interval: '1m',
      candle: { time: 1700000000, open: 1, high: 2, low: 0.5, close: 1.5, volume: 10 },
    });
  });

  it('returns null for unsupported kline intervals', () => {
    expect(parseStreamMessage(kline('5m'))).toBeNull();
  });

  it('returns null for subscribe acks and garbage', () => {
    expect(parseStreamMessage('{"result":null,"id":1}')).toBeNull();
    expect(parseStreamMessage('nope')).toBeNull();
    expect(parseStreamMessage('null')).toBeNull();
    expect(parseStreamMessage('{"stream":"a","data":{"e":"trade"}}')).toBeNull();
  });
});
