import { expectSaga } from 'redux-saga-test-plan';
import type { Action } from '@reduxjs/toolkit';
import type { PutEffect } from 'redux-saga/effects';
import { describe, expect, it, vi } from 'vitest';
import { rootReducer } from '../../app/store';
import type { Candle } from '../../domain/types';
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
    let resolveEth: (candles: Candle[]) => void = () => {};
    vi.mocked(deps.fetchKlines).mockImplementation((symbol) =>
      symbol === 'ETHUSDT'
        ? new Promise<Candle[]>((resolve) => {
            resolveEth = resolve;
          })
        : Promise.resolve([c(2)]),
    );
    // The stale ETH request settles after the BTC load has finished.
    setTimeout(() => resolveEth([c(9)]), 25);
    const result = await expectSaga(chartSaga, deps)
      .withReducer(rootReducer, initial())
      .dispatch(pairSelected('ETHUSDT'))
      .dispatch(pairSelected('BTCUSDT'))
      .silentRun(60);
    const loaded = result.allEffects
      .filter((e): e is PutEffect => e.type === 'PUT')
      .map((e) => e.payload.action)
      .filter(candlesLoaded.match);
    expect(loaded).toEqual([candlesLoaded({ symbol: 'BTCUSDT', interval: '1m', candles: [c(2)] })]);
    expect(loaded.some((a) => a.payload.symbol === 'ETHUSDT')).toBe(false);
    expect(deps.client.streams.has('ethusdt@kline_1m')).toBe(false);
    expect(deps.client.streams.has('btcusdt@kline_1m')).toBe(true);
  });

  describe('silent refresh', () => {
    const readyStart = () => {
      const s = initial();
      return { ...s, candles: { ...s.candles, status: 'ready' as const, candles: [c(1)] } };
    };
    const putsOf = (result: { allEffects: unknown[] }) =>
      (result.allEffects as Array<{ type: string; payload: { action?: unknown } }>)
        .filter((e) => e.type === 'PUT')
        .map((e) => e.payload.action as Action);

    it('keeps the candles while refreshing the same pair after a reconnect', async () => {
      const deps = fakeDeps();
      vi.mocked(deps.fetchKlines).mockResolvedValue([c(1), c(2)]);
      const result = await expectSaga(chartSaga, deps)
        .withReducer(rootReducer, readyStart())
        .dispatch(connectionStatusChanged({ status: 'live', attempt: 0 }))
        .silentRun(50);
      const puts = putsOf(result);
      expect(puts.some(candlesLoading.match)).toBe(false);
      expect(deps.fetchKlines).toHaveBeenCalledTimes(1);
      expect(puts.filter(candlesLoaded.match)).toHaveLength(1);
      expect(result.storeState.candles.candles).toEqual([c(1), c(2)]);
    });

    it('leaves the state untouched when a silent refresh fails', async () => {
      const deps = fakeDeps();
      vi.mocked(deps.fetchKlines).mockRejectedValue(new Error('klines unavailable'));
      const result = await expectSaga(chartSaga, deps)
        .withReducer(rootReducer, readyStart())
        .dispatch(connectionStatusChanged({ status: 'live', attempt: 0 }))
        .silentRun(50);
      const puts = putsOf(result);
      expect(puts.some(candlesLoading.match)).toBe(false);
      expect(puts.some(candlesUnavailable.match)).toBe(false);
      expect(result.storeState.candles.status).toBe('ready');
      expect(result.storeState.candles.candles).toEqual([c(1)]);
    });

    it('still shows loading on a pair switch', async () => {
      const deps = fakeDeps();
      const result = await expectSaga(chartSaga, deps)
        .withReducer(rootReducer, readyStart())
        .dispatch(pairSelected('ETHUSDT'))
        .silentRun(50);
      expect(putsOf(result).some(candlesLoading.match)).toBe(true);
    });
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
