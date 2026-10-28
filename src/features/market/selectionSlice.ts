import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Interval } from '../../domain/types';

export interface SelectionState {
  symbol: string;
  interval: Interval;
}

const initialState: SelectionState = { symbol: 'BTCUSDT', interval: '1m' };

const selectionSlice = createSlice({
  name: 'selection',
  initialState,
  reducers: {
    pairSelected(state, action: PayloadAction<string>) {
      state.symbol = action.payload;
    },
    intervalChanged(state, action: PayloadAction<Interval>) {
      state.interval = action.payload;
    },
  },
});

export const { pairSelected, intervalChanged } = selectionSlice.actions;
export default selectionSlice.reducer;
