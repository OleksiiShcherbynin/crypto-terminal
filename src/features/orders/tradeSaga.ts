import type { PayloadAction } from '@reduxjs/toolkit';
import type { SagaIterator } from 'redux-saga';
import { all, put, select, takeEvery } from 'redux-saga/effects';
import type { SagaDeps } from '../../app/store';
import {
  orderCancelRequested,
  orderCancelled,
  orderFilled,
  orderPlaced,
  orderRejected,
  orderRequested,
} from '../../domain/actions';
import { findPair } from '../../domain/pairs';
import type { Order, OrderRequest, Ticker } from '../../domain/types';
import { selectConnection, selectTicker } from '../market/selectors';
import { selectAvailableBase, selectAvailableQuote } from '../portfolio/selectors';
import { selectOpenOrders } from './ordersSlice';
import { validateOrder, type OrderError } from './validation';

type TradeDeps = Pick<SagaDeps, 'now' | 'newId'>;

/** Validates an order request against live state, then fills it (market) or rests it (limit). */
export function* handleOrderRequest(
  { now, newId }: TradeDeps,
  action: PayloadAction<OrderRequest>,
): SagaIterator {
  const req = action.payload;
  const pair = findPair(req.symbol);
  if (!pair) {
    yield put(orderRejected({ request: req, reason: 'Unknown pair' }));
    return;
  }
  const ticker: Ticker | undefined = yield select(selectTicker(req.symbol));
  const connection: ReturnType<typeof selectConnection> = yield select(selectConnection);
  const availableQuote: number = yield select(selectAvailableQuote);
  const availableBase: number = yield select(selectAvailableBase(pair.base));
  const error: OrderError | null = validateOrder(req, {
    pair,
    lastPrice: ticker?.last,
    connectionStatus: connection.status,
    availableQuote,
    availableBase,
  });
  if (error) {
    yield put(orderRejected({ request: req, reason: error.message }));
    return;
  }
  if (req.type === 'market') {
    // validateOrder guarantees a price exists here.
    const price = ticker?.last ?? 0;
    yield put(
      orderFilled({
        id: newId(),
        symbol: req.symbol,
        side: req.side,
        type: 'market',
        quantity: req.quantity,
        price,
        executedAt: now(),
      }),
    );
    return;
  }
  yield put(
    orderPlaced({
      id: newId(),
      symbol: req.symbol,
      side: req.side,
      price: req.price ?? 0,
      quantity: req.quantity,
      createdAt: now(),
    }),
  );
}

/** Cancels only an order that is still open, so a stale cancel after a fill cannot release funds twice. */
export function* handleCancelRequest(action: PayloadAction<string>): SagaIterator {
  const open: Order[] = yield select(selectOpenOrders);
  const found = open.find((o) => o.id === action.payload);
  if (found) yield put(orderCancelled(found));
}

export function* tradeSaga(deps: TradeDeps): SagaIterator {
  yield all([
    takeEvery(orderRequested.type, handleOrderRequest, deps),
    takeEvery(orderCancelRequested.type, handleCancelRequest),
  ]);
}
