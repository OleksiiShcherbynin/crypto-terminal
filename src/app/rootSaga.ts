import type { SagaIterator } from 'redux-saga';
import { put } from 'redux-saga/effects';
import { appStarted } from '../domain/actions';
import type { SagaDeps } from './store';

export function* rootSaga(_deps: SagaDeps): SagaIterator {
  yield put(appStarted());
}
