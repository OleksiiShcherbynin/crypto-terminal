import type { PayloadAction } from '@reduxjs/toolkit';
import type { SagaIterator } from 'redux-saga';
import { put, select, takeEvery } from 'redux-saga/effects';
import type { SagaDeps } from '../../app/store';
import { orderFilled, orderRejected } from '../../domain/actions';
import { formatPrice, formatQuantity } from '../../domain/format';
import { findPair } from '../../domain/pairs';
import type { Alert, AlertRequest, Fill, OrderRequest, Pair, Toast } from '../../domain/types';
import { alertRejected, alertTriggered, selectAlertById } from '../alerts/alertsSlice';
import { toastPushed } from './toastsSlice';

type NewToast = Omit<Toast, 'id'>;

export function toastForFill(fill: Fill, pair: Pair): NewToast {
  const verb = fill.side === 'buy' ? 'Bought' : 'Sold';
  const qty = formatQuantity(fill.quantity, pair.qtyPrecision);
  const price = formatPrice(fill.price, pair.pricePrecision);
  return {
    kind: 'success',
    title: `${verb} ${qty} ${pair.base} @ ${price}`,
    message: fill.type === 'limit' ? 'Limit order filled' : 'Market order',
  };
}

export function toastForAlert(alert: Alert, price: number, pair: Pair): NewToast {
  return {
    kind: 'warning',
    title: `${pair.base}/${pair.quote} is ${alert.direction} ${formatPrice(alert.price, pair.pricePrecision)}`,
    message: `Now ${formatPrice(price, pair.pricePrecision)}`,
  };
}

export function toastForRejection(reason: string, title = 'Order rejected'): NewToast {
  return { kind: 'error', title, message: reason };
}

type Trigger =
  | ReturnType<typeof orderFilled>
  | ReturnType<typeof alertTriggered>
  | PayloadAction<{ request: OrderRequest; reason: string }>
  | PayloadAction<{ request: AlertRequest; reason: string }>;

export function* notificationsSaga({ newId }: Pick<SagaDeps, 'newId'>): SagaIterator {
  yield takeEvery(
    [orderFilled.type, alertTriggered.type, orderRejected.type, alertRejected.type],
    function* notify(action: Trigger): SagaIterator {
      let toast: NewToast | undefined;
      if (orderFilled.match(action)) {
        const pair = findPair(action.payload.symbol);
        if (pair) toast = toastForFill(action.payload, pair);
      } else if (alertTriggered.match(action)) {
        // The reducer has already marked the alert triggered; it is still in the list.
        const alert: Alert | undefined = yield select(selectAlertById(action.payload.id));
        const pair = alert && findPair(alert.symbol);
        if (alert && pair) toast = toastForAlert(alert, action.payload.price, pair);
      } else if (alertRejected.match(action)) {
        toast = toastForRejection(action.payload.reason, 'Alert rejected');
      } else if (orderRejected.match(action)) {
        toast = toastForRejection(action.payload.reason);
      }
      if (toast) yield put(toastPushed({ id: newId(), ...toast }));
    },
  );
}
