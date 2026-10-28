import { expectSaga } from 'redux-saga-test-plan';
import type { PutEffect } from 'redux-saga/effects';
import { describe, expect, it, vi } from 'vitest';
import { rootReducer } from '../../app/store';
import { c, fakeDeps } from '../../test/fixtures';
import { connectionStatusChanged } from '../market/connectionSlice';
import { pairSelected } from '../market/selectionSlice';
import { candlesLoaded, candlesLoading, candlesUnavailable } from './candlesSlice';
import { HISTORY_LIMIT, chartSaga } from './chartSaga';

const initial = () => rootReducer(undefined, { type: '@@init' });

describe('chartSaga', () => {
  it('subscribes the kline stream, unsubscribes the old one and loads history', async () => {
    const deps = fakeDeps();
    deps.client.subscribe(['ethusdt@kline_1m', 'btcusdt@miniTicker']);
    vi.mocked(deps.fetchKlines).mockResolvedValue([c(1)]);
    const result = await expectSaga(chartSaga, deps)
      .withReducer(rootReducer, initial())
      .put(candlesLoading({ symbol: 'BTCUSDT', interval: '1m' }))
      .put(candlesLoaded({ symbol: 'BTCUSDT', interval: '1m', candles: [c(1)] }))
      .dispatch(connectionStatusChanged({ status: 'live', attempt: 0 }))
      .silentRun(50);
    expect(deps.client.streams.has('btcusdt@kline_1m')).toBe(true);
    expect(deps.client.streams.has('ethusdt@kline_1m')).toBe(false);
    expect(deps.client.streams.has('btcusdt@miniTicker')).toBe(true);
    expect(deps.fetchKlines).toHaveBeenCalledWith('BTCUSDT', '1m', HISTORY_LIMIT);
    expect(result.storeState.candles.status).toBe('ready');
  });

  it('marks history unavailable when fetch fails', async () => {
    const deps = fakeDeps();
    vi.mocked(deps.fetchKlines).mockRejectedValue(new Error('klines unavailable'));
    await expectSaga(chartSaga, deps)
      .withReducer(rootReducer, initial())
      .put(candlesUnavailable({ symbol: 'BTCUSDT', interval: '1m' }))
      .dispatch(connectionStatusChanged({ status: 'live', attempt: 0 }))
      .silentRun(50);
    expect(deps.client.streams.has('btcusdt@kline_1m')).toBe(true);
  });

  it('takeLatest cancels the previous load', async () => {
    const deps = fakeDeps();
    vi.mocked(deps.fetchKlines).mockImplementation((symbol) =>
      symbol === 'ETHUSDT' ? new Promise(() => {}) : Promise.resolve([c(2)]),
    );
    const result = await expectSaga(chartSaga, deps)
      .withReducer(rootReducer, initial())
      .dispatch(pairSelected('ETHUSDT'))
      .dispatch(pairSelected('BTCUSDT'))
      .silentRun(50);
    const loaded = result.allEffects
      .filter((e): e is PutEffect => e.type === 'PUT')
      .map((e) => e.payload.action)
      .filter(candlesLoaded.match);
    expect(loaded).toEqual([candlesLoaded({ symbol: 'BTCUSDT', interval: '1m', candles: [c(2)] })]);
    expect(deps.client.streams.has('ethusdt@kline_1m')).toBe(false);
    expect(deps.client.streams.has('btcusdt@kline_1m')).toBe(true);
  });

  it('reloads when the connection comes back live', async () => {
    const deps = fakeDeps();
    await expectSaga(chartSaga, deps)
      .withReducer(rootReducer, initial())
      .dispatch(connectionStatusChanged({ status: 'live', attempt: 0 }))
      .silentRun(50);
    expect(deps.fetchKlines).toHaveBeenCalledTimes(1);
  });

  it('ignores non-live connection statuses', async () => {
    const deps = fakeDeps();
    await expectSaga(chartSaga, deps)
      .withReducer(rootReducer, initial())
      .dispatch(connectionStatusChanged({ status: 'reconnecting', attempt: 1 }))
      .silentRun(50);
    expect(deps.fetchKlines).not.toHaveBeenCalled();
  });
});
