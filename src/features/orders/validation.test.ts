import { describe, expect, it } from 'vitest';
import type { OrderRequest } from '../../domain/types';
import { findPair } from '../../domain/pairs';
import { limitPricePrefill, orderCost, validateOrder, type OrderContext } from './validation';

const pair = findPair('BTCUSDT')!;
const ctx = (partial: Partial<OrderContext> = {}): OrderContext => ({
  pair,
  lastPrice: 100,
  connectionStatus: 'live',
  availableQuote: 1000,
  availableBase: 5,
  ...partial,
});
const req = (partial: Partial<OrderRequest> = {}): OrderRequest => ({
  symbol: 'BTCUSDT',
  side: 'buy',
  type: 'market',
  quantity: 1,
  ...partial,
});

describe('orderCost', () => {
  it('uses the limit price when present, else the last price', () => {
    expect(orderCost(req({ type: 'limit', price: 50, quantity: 2 }), 100)).toBe(100);
    expect(orderCost(req({ quantity: 0.1 }), 0.3)).toBe(0.03);
  });
});

describe('validateOrder', () => {
  it('rejects a non-positive or non-finite quantity', () => {
    const error = { field: 'quantity', message: 'Enter a quantity greater than zero' };
    expect(validateOrder(req({ quantity: 0 }), ctx())).toEqual(error);
    expect(validateOrder(req({ quantity: NaN }), ctx())).toEqual(error);
  });

  it('rejects a market order without a live connection', () => {
    expect(validateOrder(req(), ctx({ connectionStatus: 'reconnecting' }))).toEqual({
      field: 'connection',
      message: 'Market orders need a live connection',
    });
  });

  it('rejects when there is no price for the pair', () => {
    expect(validateOrder(req(), ctx({ lastPrice: undefined }))).toEqual({
      field: 'price',
      message: 'No price for this pair yet',
    });
  });

  it('rejects a limit order with an invalid price', () => {
    const error = { field: 'price', message: 'Enter a limit price greater than zero' };
    expect(validateOrder(req({ type: 'limit', price: 0 }), ctx())).toEqual(error);
    expect(validateOrder(req({ type: 'limit' }), ctx())).toEqual(error);
  });

  it('rejects a buy limit at or above the current price', () => {
    expect(validateOrder(req({ type: 'limit', price: 100 }), ctx())).toEqual({
      field: 'price',
      message: 'Buy limit must be below the current price',
    });
  });

  it('rejects a sell limit at or below the current price', () => {
    expect(validateOrder(req({ type: 'limit', side: 'sell', price: 100 }), ctx())).toEqual({
      field: 'price',
      message: 'Sell limit must be above the current price',
    });
  });

  it('rejects a buy that costs more than the available quote', () => {
    expect(validateOrder(req({ quantity: 11 }), ctx())).toEqual({
      field: 'funds',
      message: 'Insufficient USDT',
    });
  });

  it('rejects a sell larger than the available base', () => {
    expect(validateOrder(req({ side: 'sell', quantity: 6 }), ctx())).toEqual({
      field: 'funds',
      message: 'Insufficient BTC',
    });
  });

  it('returns null for a valid market buy', () => {
    expect(validateOrder(req(), ctx())).toBeNull();
  });

  it('returns null for a valid limit sell above market', () => {
    expect(validateOrder(req({ side: 'sell', type: 'limit', price: 110 }), ctx())).toBeNull();
  });
});

describe('limitPricePrefill', () => {
  it('prefills a buy limit 0.5 % below the last price, rounded down', () => {
    expect(limitPricePrefill('buy', 100, 2)).toBe('99.50');
    expect(limitPricePrefill('buy', 80_674.57, 2)).toBe('80271.19');
  });
  it('prefills a sell limit 0.5 % above the last price, rounded up', () => {
    expect(limitPricePrefill('sell', 100, 2)).toBe('100.50');
    expect(limitPricePrefill('sell', 80_674.57, 2)).toBe('81077.95');
  });
  it('lands on the valid side of the last price', () => {
    const last = 0.00001234;
    const buy = Number(limitPricePrefill('buy', last, 8));
    const sell = Number(limitPricePrefill('sell', last, 8));
    expect(validateOrder(req({ type: 'limit', price: buy }), ctx({ lastPrice: last }))).toBeNull();
    expect(
      validateOrder(req({ side: 'sell', type: 'limit', price: sell }), ctx({ lastPrice: last })),
    ).toBeNull();
  });
});
