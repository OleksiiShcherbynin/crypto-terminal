import type { Action } from '@reduxjs/toolkit';
import type { SagaIterator } from 'redux-saga';
import { call, cancelled, put, select, takeLatest } from 'redux-saga/effects';
import type { SagaDeps } from '../../app/store';
import { appStarted } from '../../domain/actions';
import { isKlineStream, klineStream } from '../../domain/pairs';
import type { Candle } from '../../domain/types';
import { connectionStatusChanged } from '../market/connectionSlice';
import { intervalChanged, pairSelected } from '../market/selectionSlice';
import { selectSelection } from '../market/selectors';
import { candlesLoaded, candlesLoading, candlesUnavailable } from './candlesSlice';

export const HISTORY_LIMIT = 300;

type ChartDeps = Pick<SagaDeps, 'client' | 'fetchKlines'>;

/** Anything that changes which candles should be on screen, or that may have left a gap. */
export const chartTriggers = (a: Action): boolean =>
  pairSelected.match(a) ||
  intervalChanged.match(a) ||
  appStarted.match(a) ||
  (connectionStatusChanged.match(a) && a.payload.status === 'live');

/**
 * Points the shared socket at the selected pair/interval and loads its history.
 * The new stream is subscribed first so no live candle is missed while history is in flight.
 */
export function* loadChart({ client, fetchKlines }: ChartDeps): SagaIterator {
  const { symbol, interval }: ReturnType<typeof selectSelection> = yield select(selectSelection);
  const stream = klineStream(symbol, interval);
  const stale = [...client.streams].filter((s) => isKlineStream(s) && s !== stream);
  if (stale.length > 0) yield call([client, client.unsubscribe], stale);
  yield call([client, client.subscribe], [stream]);
  yield put(candlesLoading({ symbol, interval }));
  try {
    const candles: Candle[] = yield call(fetchKlines, symbol, interval, HISTORY_LIMIT);
    yield put(candlesLoaded({ symbol, interval, candles }));
  } catch {
    yield put(candlesUnavailable({ symbol, interval }));
  } finally {
    if (yield cancelled()) {
      // Superseded by a newer trigger: that run owns the streams and the candles state.
    }
  }
}

export function* chartSaga(deps: ChartDeps): SagaIterator {
  yield takeLatest(chartTriggers, loadChart, deps);
}
