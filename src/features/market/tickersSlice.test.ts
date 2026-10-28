import { describe, expect, it } from 'vitest';
import { t } from '../../test/fixtures';
import tickersReducer, { tickersUpdated } from './tickersSlice';

describe('tickersSlice', () => {
  it('upserts tickers by symbol', () => {
    const s = tickersReducer({}, tickersUpdated([t('BTCUSDT', 1), t('BTCUSDT', 2)]));
    expect(s.BTCUSDT.last).toBe(2);
  });

  it('keeps other symbols', () => {
    const s = tickersReducer({ ETHUSDT: t('ETHUSDT', 5) }, tickersUpdated([t('BTCUSDT', 1)]));
    expect(Object.keys(s).sort()).toEqual(['BTCUSDT', 'ETHUSDT']);
  });
});
