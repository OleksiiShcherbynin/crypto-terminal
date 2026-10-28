import { expectSaga } from 'redux-saga-test-plan';
import type { Action } from '@reduxjs/toolkit';
import type { PutEffect } from 'redux-saga/effects';
import { describe, expect, it, vi } from 'vitest';
import { rootReducer } from '../../app/store';
import type { Candle } from '../../domain/types';
import { c, fakeDeps } from '../../test/fixtures';
import { connectionStatusChanged } from '../market/connectionSlice';
import { intervalChanged, pairSelected } from '../market/selectionSlice';
import { candlesLoaded, candlesLoading, candlesUnavailable } from './candlesSlice';
import { HISTORY_LIMIT, MIN_SWITCH_GAP_MS, SWITCH_DEBOUNCE_MS, chartSaga } from './chartSaga';

const initial = () => rootReducer(undefined, { type: '@@init' });
// Pair/interval switches are debounced; most tests only need the debounce to be short.
const FAST = { switchDebounceMs: 1, minSwitchGapMs: 0 };
const withSignal = expect.objectContaining({ signal: expect.any(AbortSignal) });

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
    expect(deps.fetchKlines).toHaveBeenCalledWith('BTCUSDT', '1m', HISTORY_LIMIT, withSignal);
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
    setTimeout(() => resolveEth([c(9)]), 80);
    const result = await expectSaga(chartSaga, deps, FAST)
      .withReducer(rootReducer, initial())
      .dispatch(pairSelected('ETHUSDT'))
      .delay(20)
      .dispatch(pairSelected('BTCUSDT'))
      .silentRun(250);
    expect(deps.fetchKlines).toHaveBeenCalledTimes(2);
    const loaded = result.allEffects
      .filter((e): e is PutEffect => e.type === 'PUT')
      .map((e) => e.payload.action)
      .filter(candlesLoaded.match);
    expect(loaded).toEqual([candlesLoaded({ symbol: 'BTCUSDT', interval: '1m', candles: [c(2)] })]);
    expect(loaded.some((a) => a.payload.symbol === 'ETHUSDT')).toBe(false);
    expect(deps.client.streams.has('ethusdt@kline_1m')).toBe(false);
    expect(deps.client.streams.has('btcusdt@kline_1m')).toBe(true);
  });

  it('debounces rapid switches into one resubscribe and one fetch for the final pair', async () => {
    const deps = fakeDeps();
    deps.client.subscribe(['btcusdt@kline_1m']);
    const subscribe = vi.spyOn(deps.client, 'subscribe');
    const unsubscribe = vi.spyOn(deps.client, 'unsubscribe');
    const result = await expectSaga(chartSaga, deps)
      .withReducer(rootReducer, initial())
      .dispatch(pairSelected('ETHUSDT'))
      .delay(50)
      .dispatch(intervalChanged('15m'))
      .delay(50)
      .dispatch(pairSelected('SOLUSDT'))
      .silentRun(SWITCH_DEBOUNCE_MS + 250);
    expect(unsubscribe.mock.calls).toEqual([[['btcusdt@kline_1m']]]);
    expect(subscribe.mock.calls).toEqual([[['solusdt@kline_15m']]]);
    expect(deps.fetchKlines).toHaveBeenCalledTimes(1);
    expect(deps.fetchKlines).toHaveBeenCalledWith('SOLUSDT', '15m', HISTORY_LIMIT, withSignal);
    // Every switch still shows loading right away.
    const loading = result.allEffects
      .filter((e): e is PutEffect => e.type === 'PUT')
      .map((e) => e.payload.action)
      .filter(candlesLoading.match)
      .map((a) => a.payload.symbol);
    expect(loading).toEqual(['ETHUSDT', 'ETHUSDT', 'SOLUSDT']);
  });

  it('spaces socket switches so control messages stay under the Binance limit', async () => {
    const deps = fakeDeps();
    deps.client.subscribe(['btcusdt@kline_1m']);
    const sentAt: number[] = [];
    const original = deps.client.unsubscribe.bind(deps.client);
    vi.spyOn(deps.client, 'unsubscribe').mockImplementation((streams) => {
      sentAt.push(Date.now());
      original(streams);
    });
    await expectSaga(chartSaga, deps, { switchDebounceMs: 1, minSwitchGapMs: 200 })
      .withReducer(rootReducer, initial())
      .dispatch(pairSelected('ETHUSDT'))
      .delay(30)
      .dispatch(pairSelected('SOLUSDT'))
      .silentRun(400);
    expect(sentAt).toHaveLength(2);
    expect(sentAt[1] - sentAt[0]).toBeGreaterThanOrEqual(195);
    expect(deps.client.streams.has('solusdt@kline_1m')).toBe(true);
    expect(deps.client.streams.has('ethusdt@kline_1m')).toBe(false);
  });

  it('keeps the default switch gap wide enough for two switches per second at most', () => {
    // Each switch sends UNSUBSCRIBE + SUBSCRIBE; > 500 ms apart means ≤ 4 messages in any second.
    expect(MIN_SWITCH_GAP_MS).toBeGreaterThan(500);
  });

  it('aborts the request of a superseded load', async () => {
    const deps = fakeDeps();
    const signals: Record<string, AbortSignal | undefined> = {};
    vi.mocked(deps.fetchKlines).mockImplementation((symbol, _interval, _limit, opts) => {
      signals[symbol] = opts?.signal;
      return symbol === 'ETHUSDT' ? new Promise<Candle[]>(() => {}) : Promise.resolve([c(2)]);
    });
    await expectSaga(chartSaga, deps, FAST)
      .withReducer(rootReducer, initial())
      .dispatch(pairSelected('ETHUSDT'))
      .delay(20)
      .dispatch(pairSelected('BTCUSDT'))
      .silentRun(200);
    expect(signals.ETHUSDT?.aborted).toBe(true);
    expect(signals.BTCUSDT?.aborted).toBe(false);
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
