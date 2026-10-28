import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Candle, Interval } from '../../domain/types';

export interface CandlesState {
  symbol: string;
  interval: Interval;
  status: 'idle' | 'loading' | 'ready' | 'unavailable';
  candles: Candle[];
}

interface Target {
  symbol: string;
  interval: Interval;
}

const initialState: CandlesState = {
  symbol: 'BTCUSDT',
  interval: '1m',
  status: 'idle',
  candles: [],
};

const matches = (state: CandlesState, t: Target): boolean =>
  state.symbol === t.symbol && state.interval === t.interval;

const candlesSlice = createSlice({
  name: 'candles',
  initialState,
  reducers: {
    candlesLoading(state, action: PayloadAction<Target>) {
      state.symbol = action.payload.symbol;
      state.interval = action.payload.interval;
      state.status = 'loading';
      state.candles = [];
    },
    candlesLoaded(state, action: PayloadAction<Target & { candles: Candle[] }>) {
      if (!matches(state, action.payload)) return;
      state.status = 'ready';
      state.candles = action.payload.candles;
    },
    candlesUnavailable(state, action: PayloadAction<Target>) {
      if (!matches(state, action.payload)) return;
      state.status = 'unavailable';
    },
    candleReceived(state, action: PayloadAction<Target & { candle: Candle }>) {
      if (!matches(state, action.payload)) return;
      if (state.status !== 'ready' && state.status !== 'unavailable') return;
      const { candle } = action.payload;
      const last = state.candles[state.candles.length - 1];
      if (!last || candle.time > last.time) state.candles.push(candle);
      else if (candle.time === last.time) state.candles[state.candles.length - 1] = candle;
    },
  },
});

export const { candlesLoading, candlesLoaded, candlesUnavailable, candleReceived } =
  candlesSlice.actions;
export default candlesSlice.reducer;
