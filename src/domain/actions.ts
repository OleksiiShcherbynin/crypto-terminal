import { createAction } from '@reduxjs/toolkit';
import type { Fill, Order, OrderRequest } from './types';

export const appStarted = createAction('app/started');
export const portfolioReset = createAction('portfolio/reset');
export const orderRequested = createAction<OrderRequest>('orders/requested');
export const orderPlaced = createAction<Order>('orders/placed');
export const orderCancelled = createAction<Order>('orders/cancelled');
export const orderFilled = createAction<Fill>('orders/filled');
export const orderRejected = createAction<{ request: OrderRequest; reason: string }>(
  'orders/rejected',
);
export const orderCancelRequested = createAction<string>('orders/cancelRequested');
