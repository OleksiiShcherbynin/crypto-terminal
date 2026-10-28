import type { RootState } from '../app/store';
import type { ConnectionStatus } from '../domain/types';
import { t } from './fixtures';

export function marketState(status: ConnectionStatus = 'live', attempt = 0): Partial<RootState> {
  return {
    connection: { status, attempt },
    tickers: {
      BTCUSDT: t('BTCUSDT', 67123.456, { changePct: 1.234, volume: 12_345_678 }),
      ETHUSDT: t('ETHUSDT', 3210.5, { changePct: -0.5, volume: 4_321_000 }),
    },
  };
}
