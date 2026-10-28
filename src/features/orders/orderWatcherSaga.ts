import type { PayloadAction } from '@reduxjs/toolkit';
import type { Action } from '@reduxjs/toolkit';
import type { SagaIterator } from 'redux-saga';
import { call, fork, put, race, select, take, takeEvery } from 'redux-saga/effects';
import type { SagaDeps } from '../../app/store';
import { orderCancelled, orderFilled, orderPlaced, portfolioReset } from '../../domain/actions';
import type { Order } from '../../domain/types';
import { tickersUpdated } from '../market/tickersSlice';
import { selectOpenOrders } from './ordersSlice';

type WatcherDeps = Pick<SagaDeps, 'newId'>;

/** Buy limits fill at or below the limit price, sell limits at or above it. */
export function crosses(order: Pick<Order, 'side' | 'price'>, last: number): boolean {
  return order.side === 'buy' ? last <= order.price : last >= order.price;
}

/**
 * Blocks until a live tick for the order's symbol crosses its limit; resolves with that tick's
 * receipt time. Only ticks arriving after the watcher starts count, never restored state.
 */
export function* waitForCross(order: Order): SagaIterator<{ at: number }> {
  while (true) {
    const action: PayloadAction<Parameters<typeof tickersUpdated>[0]> = yield take(
      tickersUpdated.type,
    );
    const tick = action.payload.find((t) => t.symbol === order.symbol);
    if (tick && crosses(order, tick.last)) return { at: tick.receivedAt };
  }
}

/** One watcher per open limit order: fill, cancellation and portfolio reset race each other. */
export function* watchOrder({ newId }: WatcherDeps, order: Order): SagaIterator {
  const outcome: { fill?: { at: number } } = yield race({
    fill: call(waitForCross, order),
    cancel: take((a: Action) => orderCancelled.match(a) && a.payload.id === order.id),
    reset: take(portfolioReset.type),
  });
  if (outcome.fill) {
    yield put(
      orderFilled({
        id: newId(),
        orderId: order.id,
        symbol: order.symbol,
        side: order.side,
        type: 'limit',
        quantity: order.quantity,
        price: order.price,
        executedAt: outcome.fill.at,
      }),
    );
  }
}

export function* orderWatcherSaga(deps: WatcherDeps): SagaIterator {
  const restored: Order[] = yield select(selectOpenOrders);
  for (const order of restored) yield fork(watchOrder, deps, order);
  yield takeEvery(orderPlaced.type, function* spawn(action: PayloadAction<Order>): SagaIterator {
    yield fork(watchOrder, deps, action.payload);
  });
}
