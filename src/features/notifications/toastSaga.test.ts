import { expectSaga } from 'redux-saga-test-plan';
import { describe, expect, it } from 'vitest';
import { rootReducer } from '../../app/store';
import type { Toast } from '../../domain/types';
import { TOAST_MS, toastSaga } from './toastSaga';
import { toastDismissed, toastPushed } from './toastsSlice';

const initial = () => rootReducer(undefined, { type: '@@init' });
const toast = (id = 'x1'): Toast => ({ id, kind: 'info', title: 'Hello' });

const dismissCount = (result: { allEffects: unknown[] }) =>
  (result.allEffects as Array<{ type: string; payload: { action?: { type?: string } } }>).filter(
    (e) => e.type === 'PUT' && e.payload.action?.type === toastDismissed.type,
  ).length;

describe('toastSaga', () => {
  it('uses a six second default', () => {
    expect(TOAST_MS).toBe(6000);
  });

  it('dismisses after the timeout', async () => {
    const result = await expectSaga(toastSaga, { toastMs: 5 })
      .withReducer(rootReducer, initial())
      .put(toastDismissed('x1'))
      .dispatch(toastPushed(toast()))
      .silentRun(50);
    expect(result.storeState.toasts.items).toHaveLength(0);
  });

  it('does not dismiss twice when closed manually', async () => {
    const result = await expectSaga(toastSaga, { toastMs: 20 })
      .withReducer(rootReducer, initial())
      .dispatch(toastPushed(toast()))
      .dispatch(toastDismissed('x1'))
      .silentRun(80);
    expect(dismissCount(result)).toBe(0);
  });

  it('keeps timing other toasts independently', async () => {
    const result = await expectSaga(toastSaga, { toastMs: 20 })
      .withReducer(rootReducer, initial())
      .dispatch(toastPushed(toast('a')))
      .dispatch(toastPushed(toast('b')))
      .dispatch(toastDismissed('a'))
      .silentRun(80);
    expect(dismissCount(result)).toBe(1);
    expect(result.storeState.toasts.items).toHaveLength(0);
  });
});
