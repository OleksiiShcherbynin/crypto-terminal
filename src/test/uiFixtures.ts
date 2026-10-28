import type { RootState } from '../app/store';
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
