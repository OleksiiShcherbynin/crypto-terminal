import { describe, expect, it } from 'vitest';
import connectionReducer, { connectionStatusChanged } from './connectionSlice';

describe('connectionSlice', () => {
  it('starts connecting', () => {
    expect(connectionReducer(undefined, { type: 'init' })).toEqual({
      status: 'connecting',
      attempt: 0,
    });
  });

  it('stores connection status', () => {
    const s = connectionReducer(
      undefined,
      connectionStatusChanged({ status: 'reconnecting', attempt: 3 }),
    );
    expect(s).toEqual({ status: 'reconnecting', attempt: 3 });
  });
});
