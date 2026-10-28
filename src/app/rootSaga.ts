import type { SagaIterator } from 'redux-saga';
import { all, fork, put, type ForkEffect } from 'redux-saga/effects';
import { appStarted } from '../domain/actions';
import { chartSaga } from '../features/chart/chartSaga';
import { alertSaga } from '../features/alerts/alertSaga';
import { marketStreamSaga } from '../features/market/marketStreamSaga';
import { notificationsSaga } from '../features/notifications/notificationsSaga';
import { toastSaga } from '../features/notifications/toastSaga';
import { orderWatcherSaga } from '../features/orders/orderWatcherSaga';
import { tradeSaga } from '../features/orders/tradeSaga';
import { persistenceSaga } from './persistenceSaga';
import { supervise } from './supervise';
import type { SagaDeps } from './store';

function sup<A extends unknown[]>(
  name: string,
  saga: (...args: A) => SagaIterator,
  ...args: A
): ForkEffect {
  return fork(supervise<A>, name, saga, ...args);
}

export function* rootSaga(deps: SagaDeps): SagaIterator {
  yield all([
    sup('market', marketStreamSaga, deps),
    sup('chart', chartSaga, deps),
    sup('trade', tradeSaga, deps),
    sup('orderWatcher', orderWatcherSaga, deps),
    sup('alerts', alertSaga, deps),
    sup('toast', toastSaga),
    sup('notifications', notificationsSaga, deps),
    sup('persistence', persistenceSaga, deps),
  ]);
  yield put(appStarted());
}
