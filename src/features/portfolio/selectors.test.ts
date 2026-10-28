import { describe, expect, it } from 'vitest';
import { t } from '../../test/fixtures';
import { initialPortfolioState } from './portfolioSlice';
import {
  selectAvailableQuote,
  selectEquity,
  selectPositionRows,
  type PortfolioRootState,
} from './selectors';

function state(tickers: PortfolioRootState['tickers']): PortfolioRootState {
  return {
    portfolio: {
      ...initialPortfolioState,
      quoteBalance: 8700,
      reservedQuote: 200,
      positions: {
        BTC: { asset: 'BTC', quantity: 0.02, avgPrice: 65000, reservedQuantity: 0 },
      },
    },
    tickers,
  };
}

describe('portfolio selectors', () => {
  it('computes position rows and equity from tickers', () => {
    const s = state({ BTCUSDT: t('BTCUSDT', 66000) });
    const [row] = selectPositionRows(s);
    expect(row).toMatchObject({ asset: 'BTC', symbol: 'BTCUSDT', value: 1320, unrealizedPnl: 20 });
    expect(row.unrealizedPct).toBeCloseTo(1.538, 3);
    expect(selectEquity(s)).toBe(10020);
    expect(selectAvailableQuote(s)).toBe(8500);
  });

  it('falls back to avg price when the ticker is missing', () => {
    const s = state({});
    const [row] = selectPositionRows(s);
    expect(row).toMatchObject({
      lastPrice: undefined,
      value: 1300,
      unrealizedPnl: 0,
      unrealizedPct: 0,
    });
    expect(selectEquity(s)).toBe(10000);
  });
});
