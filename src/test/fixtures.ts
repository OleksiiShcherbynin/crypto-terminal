import type { Alert, Candle, Fill, Order, Ticker } from '../domain/types';

export function t(symbol: string, last: number, partial: Partial<Ticker> = {}): Ticker {
  return {
    symbol,
    last,
    open: last,
    high: last,
    low: last,
    volume: 0,
    changePct: 0,
    receivedAt: 1_000,
    ...partial,
  };
}

export function c(time: number, close = 100): Candle {
  return { time, open: close, high: close, low: close, close, volume: 1 };
}

export function order(partial: Partial<Order> = {}): Order {
  return {
    id: 'o1',
    symbol: 'BTCUSDT',
    side: 'buy',
    price: 100,
    quantity: 1,
    createdAt: 1_000,
    ...partial,
  };
}

export function alert(partial: Partial<Alert> = {}): Alert {
  return {
    id: 'a1',
    symbol: 'BTCUSDT',
    direction: 'above',
    price: 100,
    createdAt: 1_000,
    ...partial,
  };
}

export function fill(partial: Partial<Fill> = {}): Fill {
  return {
    id: 'f1',
    orderId: 'o1',
    symbol: 'BTCUSDT',
    side: 'buy',
    type: 'limit',
    quantity: 1,
    price: 100,
    executedAt: 2_000,
    ...partial,
  };
}
