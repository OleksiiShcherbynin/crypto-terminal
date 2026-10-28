import type { Action } from '@reduxjs/toolkit';
import type { SagaIterator } from 'redux-saga';
import { call, cancelled, delay, put, select, takeLatest } from 'redux-saga/effects';
import type { RootState, SagaDeps } from '../../app/store';
import { appStarted } from '../../domain/actions';
import { isKlineStream, klineStream } from '../../domain/pairs';
import type { Candle } from '../../domain/types';
import { connectionStatusChanged } from '../market/connectionSlice';
import { intervalChanged, pairSelected } from '../market/selectionSlice';
import { selectSelection } from '../market/selectors';
import { candlesLoaded, candlesLoading, candlesUnavailable } from './candlesSlice';

export const HISTORY_LIMIT = 300;
/**
 * Pair/interval switches wait this long before touching the socket: each switch costs an
 * UNSUBSCRIBE and a SUBSCRIBE, and Binance drops connections above 5 control messages/second.
 */
export const SWITCH_DEBOUNCE_MS = 350;

const selectCandles = (s: RootState) => s.candles;

type ChartDeps = Pick<SagaDeps, 'client' | 'fetchKlines'>;
export interface ChartOptions {
  switchDebounceMs: number;
}

/** Anything that changes which candles should be on screen, or that may have left a gap. */
export const chartTriggers = (a: Action): boolean =>
  pairSelected.match(a) ||
  intervalChanged.match(a) ||
  appStarted.match(a) ||
  (connectionStatusChanged.match(a) && a.payload.status === 'live');

/**
 * Points the shared socket at the selected pair/interval and loads its history.
 * A user switch shows loading at once, then waits out the debounce (takeLatest restarts the wait
 * on every new switch). The new stream is subscribed first so no live candle is missed while
 * history is in flight; a superseded load aborts its request.
 */
export function* loadChart(
  { client, fetchKlines }: ChartDeps,
  opts: ChartOptions,
  trigger: Action,
): SagaIterator {
  const { symbol, interval }: ReturnType<typeof selectSelection> = yield select(selectSelection);
  const current: ReturnType<typeof selectCandles> = yield select(selectCandles);
  // Same pair and interval already on screen (e.g. after a reconnect): refresh silently so the
  // chart keeps its candles instead of blanking; a failed refresh leaves the state untouched.
  const silent =
    current.symbol === symbol &&
    current.interval === interval &&
    (current.status === 'ready' || current.status === 'unavailable');
  if (!silent) yield put(candlesLoading({ symbol, interval }));
  if (pairSelected.match(trigger) || intervalChanged.match(trigger)) {
    yield delay(opts.switchDebounceMs);
  }

  const stream = klineStream(symbol, interval);
  const stale = [...client.streams].filter((s) => isKlineStream(s) && s !== stream);
  if (stale.length > 0) yield call([client, client.unsubscribe], stale);
  yield call([client, client.subscribe], [stream]);
  const controller = new AbortController();
  try {
    const candles: Candle[] = yield call(fetchKlines, symbol, interval, HISTORY_LIMIT, {
      signal: controller.signal,
    });
    yield put(candlesLoaded({ symbol, interval, candles }));
  } catch {
    if (!silent) yield put(candlesUnavailable({ symbol, interval }));
  } finally {
    // Superseded by a newer trigger: that run owns the streams and the candles state.
    if (yield cancelled()) controller.abort();
  }
}

export function* chartSaga(deps: ChartDeps, opts: Partial<ChartOptions> = {}): SagaIterator {
  const options: ChartOptions = { switchDebounceMs: SWITCH_DEBOUNCE_MS, ...opts };
  yield takeLatest(chartTriggers, loadChart, deps, options);
}
