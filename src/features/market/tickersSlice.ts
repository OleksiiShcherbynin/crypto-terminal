import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Ticker } from '../../domain/types';

export type TickersState = Record<string, Ticker>;

const initialState: TickersState = {};

const tickersSlice = createSlice({
  name: 'tickers',
  initialState,
  reducers: {
    tickersUpdated(state, action: PayloadAction<Ticker[]>) {
      for (const ticker of action.payload) state[ticker.symbol] = ticker;
    },
  },
});

export const { tickersUpdated } = tickersSlice.actions;
export default tickersSlice.reducer;
