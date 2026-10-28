import { combineReducers, configureStore, type EnhancedStore } from '@reduxjs/toolkit';
import createSagaMiddleware, { type Task } from 'redux-saga';
import tickers from '../features/market/tickersSlice';
import connection from '../features/market/connectionSlice';
import selection from '../features/market/selectionSlice';
import candles from '../features/chart/candlesSlice';
import portfolio from '../features/portfolio/portfolioSlice';
import orders from '../features/orders/ordersSlice';
import alerts from '../features/alerts/alertsSlice';
import toasts from '../features/notifications/toastsSlice';
import app from './appSlice';
import { rootSaga } from './rootSaga';
import type { SocketClient } from '../services/binance/socketClient';
import type { fetchKlines } from '../services/binance/rest';

export const rootReducer = combineReducers({
  tickers,
  connection,
  selection,
  candles,
  portfolio,
  orders,
  alerts,
  toasts,
  app,
});

export type RootState = ReturnType<typeof rootReducer>;

export interface SagaDeps {
  client: SocketClient;
  fetchKlines: typeof fetchKlines;
  storage: Storage;
  now: () => number;
  newId: () => string;
  wsHosts: readonly string[];
}

export type AppStore = EnhancedStore<RootState>;
export type AppDispatch = AppStore['dispatch'];

export function createAppStore(opts: {
  preloadedState?: Partial<RootState>;
  deps: SagaDeps;
  runSaga?: boolean;
}): { store: AppStore; sagaTask?: Task } {
  const sagaMiddleware = createSagaMiddleware();
  const store: AppStore = configureStore({
    reducer: rootReducer,
    preloadedState: opts.preloadedState,
    middleware: (getDefault) => getDefault().concat(sagaMiddleware),
  });
  const sagaTask = opts.runSaga === false ? undefined : sagaMiddleware.run(rootSaga, opts.deps);
  return { store, sagaTask };
}
