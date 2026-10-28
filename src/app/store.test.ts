import { describe, expect, it } from 'vitest';
import { fakeDeps } from '../test/fixtures';
import { appStarted } from '../domain/actions';
import { filterPairs } from '../features/market/selectors';
import { WATCHED_PAIRS } from '../domain/pairs';
import { createAppStore, rootReducer } from './store';

describe('store', () => {
  it('creates a store with preloaded state and no saga', () => {
    const { store, sagaTask } = createAppStore({
      preloadedState: { selection: { symbol: 'ETHUSDT', interval: '1h' } },
      deps: fakeDeps(),
      runSaga: false,
    });
    expect(store.getState().selection.symbol).toBe('ETHUSDT');
    expect(sagaTask).toBeUndefined();
  });

  it('has the expected root key order', () => {
    expect(Object.keys(rootReducer(undefined, { type: 'init' }))).toEqual([
      'tickers',
      'connection',
      'selection',
      'candles',
      'portfolio',
      'orders',
      'alerts',
      'toasts',
      'app',
    ]);
  });

  it('runs the root saga by default', () => {
    const { store, sagaTask } = createAppStore({ deps: fakeDeps() });
    expect(sagaTask).toBeDefined();
    expect(store.dispatch(appStarted())).toEqual(appStarted());
  });

  it('fakeDeps newId counts up', () => {
    const d = fakeDeps();
    expect([d.newId(), d.newId()]).toEqual(['id-1', 'id-2']);
  });
});

describe('market selectors', () => {
  it('filters pairs case-insensitively in WATCHED_PAIRS order', () => {
    expect(filterPairs('  ')).toEqual([...WATCHED_PAIRS]);
    expect(filterPairs('')).toHaveLength(WATCHED_PAIRS.length);
    expect(filterPairs('btc').map((p) => p.symbol)).toContain('BTCUSDT');
    expect(filterPairs('ethusdt').map((p) => p.symbol)).toEqual(['ETHUSDT']);
  });
});
