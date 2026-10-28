import { expectSaga } from 'redux-saga-test-plan';
import { describe, expect, it } from 'vitest';
import { rootReducer } from '../../app/store';
import { orderFilled, orderRejected } from '../../domain/actions';
import { findPair } from '../../domain/pairs';
import { alert, fakeDeps, fill } from '../../test/fixtures';
import { alertRejected, alertTriggered } from '../alerts/alertsSlice';
import {
  notificationsSaga,
  toastForAlert,
  toastForFill,
  toastForRejection,
} from './notificationsSaga';
import { toastPushed } from './toastsSlice';

const initial = () => rootReducer(undefined, { type: '@@init' });
const btc = () => {
  const pair = findPair('BTCUSDT');
  if (!pair) throw new Error('BTCUSDT missing');
  return pair;
};

describe('toast builders', () => {
  it('describes a limit buy fill', () => {
    expect(toastForFill(fill({ quantity: 0.01, price: 67412.5 }), btc())).toEqual({
      kind: 'success',
      title: 'Bought 0.01000 BTC @ 67,412.50',
      message: 'Limit order filled',
    });
  });

  it('describes a market sell fill', () => {
    const toast = toastForFill(
      fill({ side: 'sell', type: 'market', quantity: 1, price: 2 }),
      btc(),
    );
    expect(toast.title).toBe('Sold 1.00000 BTC @ 2.00');
    expect(toast.message).toBe('Market order');
  });

  it('describes a triggered alert', () => {
    expect(toastForAlert(alert({ price: 70000 }), 70012.1, btc())).toEqual({
      kind: 'warning',
      title: 'BTC/USDT is above 70,000.00',
      message: 'Now 70,012.10',
    });
  });

  it('describes a rejection with a default and a custom title', () => {
    expect(toastForRejection('No funds')).toEqual({
      kind: 'error',
      title: 'Order rejected',
      message: 'No funds',
    });
    expect(toastForRejection('x', 'Alert rejected').title).toBe('Alert rejected');
  });
});

describe('notificationsSaga', () => {
  it('pushes a success toast on orderFilled', async () => {
    await expectSaga(notificationsSaga, fakeDeps())
      .withReducer(rootReducer, initial())
      .put(
        toastPushed({
          id: 'id-1',
          kind: 'success',
          title: 'Bought 0.01000 BTC @ 67,412.50',
          message: 'Limit order filled',
        }),
      )
      .dispatch(orderFilled(fill({ quantity: 0.01, price: 67412.5 })))
      .silentRun(50);
  });

  it('pushes a warning toast on alertTriggered with the alert looked up by id', async () => {
    const start = { ...initial(), alerts: { items: [alert({ id: 'a1', price: 70000 })] } };
    await expectSaga(notificationsSaga, fakeDeps())
      .withReducer(rootReducer, start)
      .put(
        toastPushed({
          id: 'id-1',
          kind: 'warning',
          title: 'BTC/USDT is above 70,000.00',
          message: 'Now 70,012.10',
        }),
      )
      .dispatch(alertTriggered({ id: 'a1', price: 70012.1, at: 5 }))
      .silentRun(50);
  });

  it('pushes no toast for an unknown alert or pair', async () => {
    const result = await expectSaga(notificationsSaga, fakeDeps())
      .withReducer(rootReducer, initial())
      .dispatch(alertTriggered({ id: 'missing', price: 1, at: 5 }))
      .dispatch(orderFilled(fill({ symbol: 'NOPEUSDT' })))
      .silentRun(50);
    expect(result.storeState.toasts.items).toHaveLength(0);
  });

  it('pushes an error toast on orderRejected', async () => {
    const request = {
      symbol: 'BTCUSDT',
      side: 'buy' as const,
      type: 'market' as const,
      quantity: 1,
    };
    await expectSaga(notificationsSaga, fakeDeps())
      .withReducer(rootReducer, initial())
      .put(toastPushed({ id: 'id-1', kind: 'error', title: 'Order rejected', message: 'No funds' }))
      .dispatch(orderRejected({ request, reason: 'No funds' }))
      .silentRun(50);
  });

  it('pushes an error toast on alertRejected', async () => {
    const request = { symbol: 'BTCUSDT', direction: 'above' as const, price: 1 };
    await expectSaga(notificationsSaga, fakeDeps())
      .withReducer(rootReducer, initial())
      .put(
        toastPushed({
          id: 'id-1',
          kind: 'error',
          title: 'Alert rejected',
          message: 'Price is already above 1.00',
        }),
      )
      .dispatch(alertRejected({ request, reason: 'Price is already above 1.00' }))
      .silentRun(50);
  });
});
