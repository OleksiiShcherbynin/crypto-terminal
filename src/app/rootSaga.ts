import type { SagaIterator } from 'redux-saga';
import { all, fork, put } from 'redux-saga/effects';
import { appStarted } from '../domain/actions';
import { chartSaga } from '../features/chart/chartSaga';
import { alertSaga } from '../features/alerts/alertSaga';
import { marketStreamSaga } from '../features/market/marketStreamSaga';
import { notificationsSaga } from '../features/notifications/notificationsSaga';
import { toastSaga } from '../features/notifications/toastSaga';
import { orderWatcherSaga } from '../features/orders/orderWatcherSaga';
import { tradeSaga } from '../features/orders/tradeSaga';
import { persistenceSaga } from './persistenceSaga';
import type { SagaDeps } from './store';

export function* rootSaga(deps: SagaDeps): SagaIterator {
  yield all([
    fork(marketStreamSaga, deps),
    fork(chartSaga, deps),
    fork(tradeSaga, deps),
    fork(orderWatcherSaga, deps),
    fork(alertSaga, deps),
    fork(toastSaga),
    fork(notificationsSaga, deps),
    fork(persistenceSaga, deps),
  ]);
  yield put(appStarted());
}
