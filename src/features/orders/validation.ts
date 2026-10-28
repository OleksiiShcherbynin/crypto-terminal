import { mul } from '../../domain/money';
import type { ConnectionStatus, OrderRequest, Pair } from '../../domain/types';

export interface OrderContext {
  pair: Pair;
  lastPrice?: number;
  connectionStatus: ConnectionStatus;
  availableQuote: number;
  availableBase: number;
}

export interface OrderError {
  field: 'quantity' | 'price' | 'connection' | 'funds';
  message: string;
}

export function orderCost(req: OrderRequest, lastPrice: number): number {
  return mul(req.quantity, req.price ?? lastPrice);
}

export function validateOrder(req: OrderRequest, ctx: OrderContext): OrderError | null {
  if (!Number.isFinite(req.quantity) || req.quantity <= 0) {
    return { field: 'quantity', message: 'Enter a quantity greater than zero' };
  }
  if (req.type === 'market' && ctx.connectionStatus !== 'live') {
    return { field: 'connection', message: 'Market orders need a live connection' };
  }
  const { lastPrice } = ctx;
  if (lastPrice === undefined) {
    return { field: 'price', message: 'No price for this pair yet' };
  }
  if (req.type === 'limit') {
    const { price } = req;
    if (price === undefined || !Number.isFinite(price) || price <= 0) {
      return { field: 'price', message: 'Enter a limit price greater than zero' };
    }
    if (req.side === 'buy' && price >= lastPrice) {
      return { field: 'price', message: 'Buy limit must be below the current price' };
    }
    if (req.side === 'sell' && price <= lastPrice) {
      return { field: 'price', message: 'Sell limit must be above the current price' };
    }
  }
  if (req.side === 'buy') {
    if (orderCost(req, lastPrice) > ctx.availableQuote) {
      return { field: 'funds', message: 'Insufficient USDT' };
    }
  } else if (req.quantity > ctx.availableBase) {
    return { field: 'funds', message: `Insufficient ${ctx.pair.base}` };
  }
  return null;
}
