import { createSlice } from '@reduxjs/toolkit';
import { orderCancelled, orderFilled, orderPlaced, portfolioReset } from '../../domain/actions';
import { add, div, isZero, mul, sub } from '../../domain/money';
import { findPair } from '../../domain/pairs';
import type { Position, Trade } from '../../domain/types';

export interface PortfolioState {
  quoteBalance: number;
  reservedQuote: number;
  positions: Record<string, Position>;
  trades: Trade[];
  realizedPnl: number;
}

export const INITIAL_QUOTE = 10_000;
export const MAX_TRADES = 500;

export const initialPortfolioState: PortfolioState = {
  quoteBalance: INITIAL_QUOTE,
  reservedQuote: 0,
  positions: {},
  trades: [],
  realizedPnl: 0,
};

function nonNegative(value: number): number {
  return value < 0 || isZero(value) ? 0 : value;
}

const portfolioSlice = createSlice({
  name: 'portfolio',
  initialState: initialPortfolioState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(orderPlaced, (state, { payload: order }) => {
        const pair = findPair(order.symbol);
        if (!pair) return;
        if (order.side === 'buy') {
          state.reservedQuote = add(state.reservedQuote, mul(order.price, order.quantity));
        } else {
          const position = state.positions[pair.base];
          if (position) position.reservedQuantity = add(position.reservedQuantity, order.quantity);
        }
      })
      .addCase(orderCancelled, (state, { payload: order }) => {
        const pair = findPair(order.symbol);
        if (!pair) return;
        if (order.side === 'buy') {
          state.reservedQuote = nonNegative(
            sub(state.reservedQuote, mul(order.price, order.quantity)),
          );
        } else {
          const position = state.positions[pair.base];
          if (position) {
            position.reservedQuantity = nonNegative(sub(position.reservedQuantity, order.quantity));
          }
        }
      })
      .addCase(orderFilled, (state, { payload: fill }) => {
        const pair = findPair(fill.symbol);
        if (!pair) return;
        const base = pair.base;
        const position = state.positions[base];
        let quantity = fill.quantity;
        let realized = 0;

        if (fill.side === 'sell') {
          if (!position) return;
          quantity = Math.min(quantity, position.quantity);
        }
        const total = mul(fill.price, quantity);

        if (fill.type === 'limit') {
          if (fill.side === 'buy') {
            state.reservedQuote = nonNegative(
              sub(state.reservedQuote, mul(fill.price, fill.quantity)),
            );
          } else if (position) {
            position.reservedQuantity = nonNegative(sub(position.reservedQuantity, fill.quantity));
          }
        }

        if (fill.side === 'buy') {
          state.quoteBalance = sub(state.quoteBalance, total);
          if (position) {
            position.avgPrice = div(
              add(mul(position.quantity, position.avgPrice), total),
              add(position.quantity, quantity),
            );
            position.quantity = add(position.quantity, quantity);
          } else {
            state.positions[base] = {
              asset: base,
              quantity,
              avgPrice: fill.price,
              reservedQuantity: 0,
            };
          }
        } else if (position) {
          state.quoteBalance = add(state.quoteBalance, total);
          realized = mul(sub(fill.price, position.avgPrice), quantity);
          position.quantity = sub(position.quantity, quantity);
          if (isZero(position.quantity)) delete state.positions[base];
        }

        state.realizedPnl = add(state.realizedPnl, realized);
        state.trades.unshift({ ...fill, quantity, total, realizedPnl: realized });
        if (state.trades.length > MAX_TRADES) state.trades.length = MAX_TRADES;
      })
      .addCase(portfolioReset, () => initialPortfolioState);
  },
});

export default portfolioSlice.reducer;
