import type { Action, PayloadAction } from '@reduxjs/toolkit';
import type { SagaIterator } from 'redux-saga';
import { delay, put, race, take, takeEvery } from 'redux-saga/effects';
import type { Toast } from '../../domain/types';
import { toastDismissed, toastPushed } from './toastsSlice';

export const TOAST_MS = 6000;

/** Dismisses a toast after the timeout unless the user closes it first. */
export function* autoDismiss(
  { toastMs }: { toastMs: number },
  action: PayloadAction<Toast>,
): SagaIterator {
  const id = action.payload.id;
  const outcome: { timeout?: true } = yield race({
    timeout: delay(toastMs, true),
    closed: take((a: Action) => toastDismissed.match(a) && a.payload === id),
  });
  if (outcome.timeout) yield put(toastDismissed(id));
}

export function* toastSaga(opts: { toastMs: number } = { toastMs: TOAST_MS }): SagaIterator {
  yield takeEvery(toastPushed.type, autoDismiss, opts);
}
