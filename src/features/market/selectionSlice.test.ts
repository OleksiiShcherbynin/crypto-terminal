import { describe, expect, it } from 'vitest';
import selectionReducer, { intervalChanged, pairSelected } from './selectionSlice';

describe('selectionSlice', () => {
  it('maps pairSelected and intervalChanged', () => {
    let s = selectionReducer(undefined, { type: 'init' });
    expect(s).toEqual({ symbol: 'BTCUSDT', interval: '1m' });
    s = selectionReducer(s, pairSelected('ETHUSDT'));
    s = selectionReducer(s, intervalChanged('1h'));
    expect(s).toEqual({ symbol: 'ETHUSDT', interval: '1h' });
  });
});
