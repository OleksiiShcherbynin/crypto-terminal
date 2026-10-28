import { describe, expect, it, vi } from 'vitest';
import { fakeDeps } from '../test/fixtures';
import { createAppStore } from './store';

describe('rootSaga', () => {
  it('boots: subscribes tickers, dispatches appStarted and loads the chart', async () => {
    const deps = fakeDeps();
    const { store, sagaTask } = createAppStore({ deps });
    try {
      await vi.waitFor(() => expect(store.getState().candles.status).toBe('ready'));
      expect(deps.client.streams.has('btcusdt@miniTicker')).toBe(true);
      expect(deps.client.streams.has('btcusdt@kline_1m')).toBe(true);
      expect(deps.fetchKlines).toHaveBeenCalledTimes(1);
      expect(deps.fetchKlines).toHaveBeenCalledWith('BTCUSDT', '1m', 300);
    } finally {
      sagaTask?.cancel();
    }
  });
});
