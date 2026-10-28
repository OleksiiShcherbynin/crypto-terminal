import type { PayloadAction } from '@reduxjs/toolkit';
import type { SagaIterator } from 'redux-saga';
import { put, select, takeEvery } from 'redux-saga/effects';
import type { SagaDeps } from '../../app/store';
import { orderFilled, orderPlaced, orderRejected, orderRequested } from '../../domain/actions';
import { findPair } from '../../domain/pairs';
import type { OrderRequest, Ticker } from '../../domain/types';
import { selectConnection, selectTicker } from '../market/selectors';
import { selectAvailableBase, selectAvailableQuote } from '../portfolio/selectors';
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

export function* tradeSaga(deps: TradeDeps): SagaIterator {
  yield takeEvery(orderRequested.type, handleOrderRequest, deps);
}
