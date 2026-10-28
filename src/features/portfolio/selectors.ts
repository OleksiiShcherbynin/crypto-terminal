import { createSelector } from '@reduxjs/toolkit';
import { add, div, mul, sub } from '../../domain/money';
import type { Ticker } from '../../domain/types';
import type { PortfolioState } from './portfolioSlice';

// Task 8 switches this to RootState.
export type PortfolioRootState = { portfolio: PortfolioState; tickers: Record<string, Ticker> };

export interface PositionRow {
  asset: string;
  symbol: string;
  quantity: number;
  avgPrice: number;
  lastPrice?: number;
  value: number;
  unrealizedPnl: number;
  unrealizedPct: number;
}

const QUOTE = 'USDT';

export const selectPortfolio = (s: PortfolioRootState) => s.portfolio;
export const selectQuoteBalance = (s: PortfolioRootState) => s.portfolio.quoteBalance;
export const selectRealizedPnl = (s: PortfolioRootState) => s.portfolio.realizedPnl;
export const selectTrades = (s: PortfolioRootState) => s.portfolio.trades;

export const selectAvailableQuote = (s: PortfolioRootState): number =>
  sub(s.portfolio.quoteBalance, s.portfolio.reservedQuote);

export const selectAvailableBase =
  (asset: string) =>
  (s: PortfolioRootState): number => {
    const position = s.portfolio.positions[asset];
    return position ? sub(position.quantity, position.reservedQuantity) : 0;
  };

export const selectPositionRows = createSelector(
  [(s: PortfolioRootState) => s.portfolio.positions, (s: PortfolioRootState) => s.tickers],
  (positions, tickers): PositionRow[] =>
    Object.values(positions)
      .map((p): PositionRow => {
        const symbol = `${p.asset}${QUOTE}`;
        const lastPrice = tickers[symbol]?.last;
        const price = lastPrice ?? p.avgPrice;
        const cost = mul(p.quantity, p.avgPrice);
        const value = mul(p.quantity, price);
        const unrealizedPnl = sub(value, cost);
        const unrealizedPct = cost === 0 ? 0 : mul(div(unrealizedPnl, cost), 100);
        return {
          asset: p.asset,
          symbol,
          quantity: p.quantity,
          avgPrice: p.avgPrice,
          lastPrice,
          value,
          unrealizedPnl,
          unrealizedPct,
        };
      })
      .sort((a, b) => b.value - a.value),
);

export const selectEquity = createSelector(
  [selectQuoteBalance, selectPositionRows],
  (quote, rows) => rows.reduce((sum, r) => add(sum, r.value), quote),
);
