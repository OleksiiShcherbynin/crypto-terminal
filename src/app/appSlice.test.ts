import { describe, expect, it } from 'vitest';
import appReducer, { externalChangeDetected, selectExternalChange } from './appSlice';

describe('appSlice', () => {
  it('flags an external change', () => {
    const s = appReducer(undefined, { type: 'init' });
    expect(s.externalChange).toBe(false);
    const next = appReducer(s, externalChangeDetected());
    expect(selectExternalChange({ app: next })).toBe(true);
  });
});
