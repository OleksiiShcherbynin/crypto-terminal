import { describe, expect, it, vi } from 'vitest';
import { fakeStorage } from '../test/fixtures';
import { rootReducer } from './store';
import {
  STORAGE_KEY,
  SCHEMA_VERSION,
  loadPersistedState,
  pickPersisted,
  savePersistedState,
} from './persistence';

const init = () => rootReducer(undefined, { type: 'init' });

describe('persistence', () => {
  it('round-trips persisted slices', () => {
    const storage = fakeStorage();
    const state = init();
    savePersistedState(storage, state);
    expect(loadPersistedState(storage)).toEqual({
      portfolio: state.portfolio,
      orders: state.orders,
      alerts: state.alerts,
      selection: state.selection,
    });
  });

  it('pickPersisted only includes the four persisted slices', () => {
    const p = pickPersisted(init());
    expect(Object.keys(p).sort()).toEqual([
      'alerts',
      'orders',
      'portfolio',
      'selection',
      'version',
    ]);
    expect(p.version).toBe(SCHEMA_VERSION);
  });

  it('returns undefined for missing key, garbage and another version', () => {
    const storage = fakeStorage();
    expect(loadPersistedState(storage)).toBeUndefined();
    storage.setItem(STORAGE_KEY, '{nope');
    expect(loadPersistedState(storage)).toBeUndefined();
    storage.setItem(STORAGE_KEY, JSON.stringify({ version: 0 }));
    expect(loadPersistedState(storage)).toBeUndefined();
    storage.setItem(STORAGE_KEY, JSON.stringify(5));
    expect(loadPersistedState(storage)).toBeUndefined();
    storage.setItem(STORAGE_KEY, 'null');
    expect(loadPersistedState(storage)).toBeUndefined();
  });

  it('returns undefined when a persisted slice is missing or not an object', () => {
    const storage = fakeStorage();
    const s = init();
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: 1, portfolio: s.portfolio, orders: s.orders, alerts: s.alerts }),
    );
    expect(loadPersistedState(storage)).toBeUndefined();
    storage.setItem(STORAGE_KEY, JSON.stringify({ ...pickPersisted(s), orders: 'x' }));
    expect(loadPersistedState(storage)).toBeUndefined();
  });

  it('survives a throwing storage', () => {
    const storage = fakeStorage();
    vi.spyOn(storage, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    vi.spyOn(storage, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    expect(loadPersistedState(storage)).toBeUndefined();
    expect(() => savePersistedState(storage, init())).not.toThrow();
  });
});
