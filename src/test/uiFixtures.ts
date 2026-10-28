import { createElement, type ReactElement } from 'react';
import { Provider } from 'react-redux';
import { vi } from 'vitest';
import type { AppStore, RootState } from '../app/store';
import type { ConnectionStatus } from '../domain/types';
import type { Candle } from '../domain/types';
import { c, t } from './fixtures';

export function marketState(status: ConnectionStatus = 'live', attempt = 0): Partial<RootState> {
  return {
    connection: { status, attempt },
    tickers: {
      BTCUSDT: t('BTCUSDT', 67123.456, { changePct: 1.234, volume: 12_345_678 }),
      ETHUSDT: t('ETHUSDT', 3210.5, { changePct: -0.5, volume: 4_321_000 }),
    },
  };
}

export function chartState(
  status: 'idle' | 'loading' | 'ready' | 'unavailable' = 'ready',
  candles: Candle[] = [c(60), c(120, 101)],
): Partial<RootState> {
  return {
    ...marketState(),
    candles: { symbol: 'BTCUSDT', interval: '1m', status, candles },
  };
}

export function tradeState(status: ConnectionStatus = 'live'): Partial<RootState> {
  return {
    connection: { status, attempt: 0 },
    tickers: { BTCUSDT: t('BTCUSDT', 100) },
  };
}

export function positionsState(): Partial<RootState> {
  return {
    ...tradeState(),
    tickers: { BTCUSDT: t('BTCUSDT', 101) },
    portfolio: {
      quoteBalance: 9_900,
      reservedQuote: 0,
      realizedPnl: 0,
      trades: [],
      positions: {
        BTC: { asset: 'BTC', quantity: 1, avgPrice: 100, reservedQuantity: 0 },
      },
    },
  };
}

export function historyState(): Partial<RootState> {
  const base = { orderId: undefined, symbol: 'BTCUSDT', quantity: 1, price: 100, total: 100 };
  return {
    portfolio: {
      quoteBalance: 10_000,
      reservedQuote: 0,
      realizedPnl: 0,
      positions: {},
      // Stored newest first, as the reducer produces it.
      trades: [
        { ...base, id: 't2', side: 'sell', type: 'market', executedAt: 5_000, realizedPnl: 5 },
        { ...base, id: 't1', side: 'buy', type: 'limit', executedAt: 1_000, realizedPnl: 0 },
      ],
    },
  };
}

/**
 * Spies on store.dispatch and re-renders so hooks pick up the spy
 * (useDispatch captures store.dispatch at render time).
 */
export function spyOnDispatch(
  view: { store: AppStore; rerender: (ui: ReactElement) => void },
  ui: ReactElement,
) {
  const spy = vi.spyOn(view.store, 'dispatch');
  // oxlint-disable-next-line react/no-children-prop
  view.rerender(createElement(Provider, { store: view.store, children: ui }));
  return spy;
}

/** Equity 10,120.00 (9,000 cash + 1 BTC at 1,120), realized +20, one open order, one alert. */
export function equityState(): Partial<RootState> {
  return {
    tickers: { BTCUSDT: t('BTCUSDT', 1_120) },
    portfolio: {
      quoteBalance: 9_000,
      reservedQuote: 0,
      realizedPnl: 20,
      trades: [],
      positions: { BTC: { asset: 'BTC', quantity: 1, avgPrice: 100, reservedQuantity: 0 } },
    },
  };
}
