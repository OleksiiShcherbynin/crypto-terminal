import { vi } from 'vitest';
import type { SagaDeps } from '../app/store';
import { WS_HOSTS } from '../services/binance/hosts';
import { createFakeSocketClient } from '../services/binance/testing';
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

export function fakeStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key) => map.get(key) ?? null,
    key: (index) => Array.from(map.keys())[index] ?? null,
    removeItem: (key) => {
      map.delete(key);
    },
    setItem: (key, value) => {
      map.set(key, String(value));
    },
  };
}

export function fakeDeps(
  overrides: Partial<SagaDeps> = {},
): SagaDeps & { client: ReturnType<typeof createFakeSocketClient> } {
  let n = 0;
  return {
    client: createFakeSocketClient(),
    fetchKlines: vi.fn().mockResolvedValue([]),
    storage: fakeStorage(),
    now: () => 1_700_000_000_000,
    newId: () => `id-${++n}`,
    wsHosts: WS_HOSTS,
    ...overrides,
  } as SagaDeps & { client: ReturnType<typeof createFakeSocketClient> };
}
