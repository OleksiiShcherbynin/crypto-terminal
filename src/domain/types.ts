export type Interval = '1m' | '15m' | '1h';
export const INTERVALS: readonly Interval[] = ['1m', '15m', '1h'];

export interface Pair {
  symbol: string;
  base: string;
  quote: string;
  pricePrecision: number;
  qtyPrecision: number;
}

export interface Ticker {
  symbol: string;
  last: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  changePct: number;
  receivedAt: number;
}

/** time: unix seconds */
export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type Side = 'buy' | 'sell';
export type OrderType = 'market' | 'limit';

export interface OrderRequest {
  symbol: string;
  side: Side;
  type: OrderType;
  quantity: number;
  price?: number;
}

/** Resting order; always limit. */
export interface Order {
  id: string;
  symbol: string;
  side: Side;
  price: number;
  quantity: number;
  createdAt: number;
}

export interface Fill {
  id: string;
  orderId?: string;
  symbol: string;
  side: Side;
  type: OrderType;
  quantity: number;
  price: number;
  executedAt: number;
}

export interface Trade extends Fill {
  total: number;
  realizedPnl: number;
}

export interface Position {
  asset: string;
  quantity: number;
  avgPrice: number;
  reservedQuantity: number;
}

export type AlertDirection = 'above' | 'below';

export interface AlertRequest {
  symbol: string;
  direction: AlertDirection;
  price: number;
}

export interface Alert extends AlertRequest {
  id: string;
  createdAt: number;
  triggeredAt?: number;
  triggeredPrice?: number;
}

export type ToastKind = 'info' | 'success' | 'warning' | 'error';

export interface Toast {
  id: string;
  kind: ToastKind;
  title: string;
  message?: string;
}

export type ConnectionStatus = 'connecting' | 'live' | 'reconnecting' | 'offline';
