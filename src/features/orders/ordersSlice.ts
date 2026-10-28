import { createSlice } from '@reduxjs/toolkit';
import { orderCancelled, orderFilled, orderPlaced, portfolioReset } from '../../domain/actions';
import type { Order } from '../../domain/types';

export interface OrdersState {
  items: Order[];
}

const initialState: OrdersState = { items: [] };

const ordersSlice = createSlice({
  name: 'orders',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(orderPlaced, (state, { payload }) => {
        state.items.push(payload);
      })
      .addCase(orderCancelled, (state, { payload }) => {
        state.items = state.items.filter((o) => o.id !== payload.id);
      })
      .addCase(orderFilled, (state, { payload: fill }) => {
        if (fill.orderId === undefined) return;
        state.items = state.items.filter((o) => o.id !== fill.orderId);
      })
      .addCase(portfolioReset, () => initialState);
  },
});

export const selectOpenOrders = (s: { orders: OrdersState }): Order[] => s.orders.items;

export default ordersSlice.reducer;
