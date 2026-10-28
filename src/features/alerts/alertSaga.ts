import type { Action, PayloadAction } from '@reduxjs/toolkit';
import type { SagaIterator } from 'redux-saga';
import { call, fork, put, race, select, take, takeEvery } from 'redux-saga/effects';
import type { SagaDeps } from '../../app/store';
import { portfolioReset } from '../../domain/actions';
import { findPair } from '../../domain/pairs';
import type { Alert, AlertRequest, Ticker } from '../../domain/types';
import { selectTicker } from '../market/selectors';
import { tickersUpdated } from '../market/tickersSlice';
import {
  alertCreated,
  alertDeleted,
  alertRejected,
  alertRequested,
  alertTriggered,
  selectActiveAlerts,
} from './alertsSlice';
import { alertHit, validateAlert } from './validation';

type AlertDeps = Pick<SagaDeps, 'now' | 'newId'>;

/** Validates an alert request against the current price, then creates it. */
export function* handleAlertRequest(
  { now, newId }: AlertDeps,
  action: PayloadAction<AlertRequest>,
): SagaIterator {
  const req = action.payload;
  const pair = findPair(req.symbol);
  if (!pair) {
    yield put(alertRejected({ request: req, reason: 'Unknown pair' }));
    return;
  }
  const ticker: Ticker | undefined = yield select(selectTicker(req.symbol));
  const error = validateAlert(req, pair, ticker?.last);
  if (error) {
    yield put(alertRejected({ request: req, reason: error }));
    return;
  }
  yield put(alertCreated({ ...req, id: newId(), createdAt: now() }));
}

/**
 * Blocks until a live tick for the alert's symbol reaches its level. Only ticks arriving after
 * the watcher starts count, so a restored alert fires on the first live tick, never from stale state.
 */
export function* waitForAlert(alert: Alert): SagaIterator<{ price: number; at: number }> {
  while (true) {
    const action: PayloadAction<Parameters<typeof tickersUpdated>[0]> = yield take(
      tickersUpdated.type,
    );
    const tick = action.payload.find((t) => t.symbol === alert.symbol);
    if (tick && alertHit(alert, tick.last)) return { price: tick.last, at: tick.receivedAt };
  }
}

/** One watcher per active alert: the level being hit, deletion and portfolio reset race each other. */
export function* watchAlert(alert: Alert): SagaIterator {
  const outcome: { hit?: { price: number; at: number } } = yield race({
    hit: call(waitForAlert, alert),
    deleted: take((a: Action) => alertDeleted.match(a) && a.payload === alert.id),
    reset: take(portfolioReset.type),
  });
  if (outcome.hit) {
    yield put(alertTriggered({ id: alert.id, price: outcome.hit.price, at: outcome.hit.at }));
  }
}

export function* alertSaga(deps: AlertDeps): SagaIterator {
  const restored: Alert[] = yield select(selectActiveAlerts);
  for (const alert of restored) yield fork(watchAlert, alert);
  yield takeEvery(alertRequested.type, handleAlertRequest, deps);
  yield takeEvery(alertCreated.type, function* spawn(action: PayloadAction<Alert>): SagaIterator {
    yield fork(watchAlert, action.payload);
  });
}
