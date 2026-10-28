import { describe, expect, it } from 'vitest';
import { orderCancelled, orderFilled, orderPlaced, portfolioReset } from '../../domain/actions';
import { mul, sub } from '../../domain/money';
import { fill, order } from '../../test/fixtures';
import portfolioReducer, {
  INITIAL_QUOTE,
  MAX_TRADES,
  initialPortfolioState,
  type PortfolioState,
} from './portfolioSlice';
import { selectAvailableBase } from './selectors';
import type { Action } from '@reduxjs/toolkit';

function reduce(action: Action, state?: PortfolioState): PortfolioState {
  return portfolioReducer(state, action);
}

describe('portfolioSlice', () => {
  it('starts with the initial quote and nothing else', () => {
    const s = reduce({ type: '@@init' });
    expect(s).toEqual(initialPortfolioState);
    expect(s.quoteBalance).toBe(INITIAL_QUOTE);
  });

  it('market buy moves quote into a position at average cost', () => {
    let s = reduce(
      orderFilled(fill({ side: 'buy', type: 'market', quantity: 0.01, price: 60000 })),
    );
    s = reduce(
      orderFilled(fill({ id: 'f2', side: 'buy', type: 'market', quantity: 0.01, price: 70000 })),
      s,
    );
    expect(s.quoteBalance).toBe(8700);
    expect(s.positions.BTC).toMatchObject({ quantity: 0.02, avgPrice: 65000 });
  });

  it('removes position when fully sold and books realized pnl', () => {
    let s = reduce(
      orderFilled(fill({ side: 'buy', type: 'market', quantity: 0.02, price: 65000 })),
    );
    s = reduce(
      orderFilled(fill({ id: 'f2', side: 'sell', type: 'market', quantity: 0.02, price: 66000 })),
      s,
    );
    expect(s.positions.BTC).toBeUndefined();
    expect(s.quoteBalance).toBe(10020);
    expect(s.realizedPnl).toBe(20);
    expect(s.trades[0].realizedPnl).toBe(20);
    expect(s.trades[0].total).toBe(1320);
  });

  it('keeps avg price on partial sell', () => {
    let s = reduce(orderFilled(fill({ side: 'buy', type: 'market', quantity: 1, price: 100 })));
    s = reduce(
      orderFilled(fill({ id: 'f2', side: 'sell', type: 'market', quantity: 0.4, price: 150 })),
      s,
    );
    expect(s.positions.BTC).toMatchObject({ quantity: 0.6, avgPrice: 100 });
    expect(s.realizedPnl).toBe(20);
  });

  it('clamps an oversell to the held quantity', () => {
    let s = reduce(orderFilled(fill({ side: 'buy', type: 'market', quantity: 1, price: 100 })));
    s = reduce(
      orderFilled(fill({ id: 'f2', side: 'sell', type: 'market', quantity: 2, price: 100 })),
      s,
    );
    expect(s.positions.BTC).toBeUndefined();
    expect(s.quoteBalance).toBe(INITIAL_QUOTE);
  });

  it('reserves quote on limit buy and releases on cancel', () => {
    const o = order({ side: 'buy', price: 50000, quantity: 0.1 });
    let s = reduce(orderPlaced(o));
    expect(s.reservedQuote).toBe(5000);
    s = reduce(orderCancelled(o), s);
    expect(s.reservedQuote).toBe(0);
  });

  it('fill releases exactly the reserved quote', () => {
    const o = order({ side: 'buy', price: 81000.5, quantity: 0.00012345 });
    let s = reduce(orderPlaced(o));
    const reserved = mul(81000.5, 0.00012345);
    expect(s.reservedQuote).toBe(reserved);
    s = reduce(
      orderFilled(fill({ side: 'buy', type: 'limit', quantity: 0.00012345, price: 81000.5 })),
      s,
    );
    expect(s.reservedQuote).toBe(0);
    expect(s.quoteBalance).toBe(sub(INITIAL_QUOTE, reserved));
  });

  it('reserves base on limit sell and releases it on fill', () => {
    const base = reduce(
      orderFilled(
        fill({ symbol: 'ETHUSDT', side: 'buy', type: 'market', quantity: 0.5, price: 100 }),
      ),
    );
    const o = order({ symbol: 'ETHUSDT', side: 'sell', price: 120, quantity: 0.2 });
    let s = reduce(orderPlaced(o), base);
    expect(s.positions.ETH.reservedQuantity).toBe(0.2);
    expect(selectAvailableBase('ETH')({ portfolio: s, tickers: {} })).toBe(0.3);
    s = reduce(
      orderFilled(
        fill({ symbol: 'ETHUSDT', side: 'sell', type: 'limit', quantity: 0.2, price: 120 }),
      ),
      s,
    );
    expect(s.positions.ETH).toMatchObject({ quantity: 0.3, reservedQuantity: 0 });
  });

  it('releases base reservation on cancel', () => {
    const base = reduce(
      orderFilled(
        fill({ symbol: 'ETHUSDT', side: 'buy', type: 'market', quantity: 0.5, price: 100 }),
      ),
    );
    const o = order({ symbol: 'ETHUSDT', side: 'sell', price: 120, quantity: 0.2 });
    const s = reduce(orderCancelled(o), reduce(orderPlaced(o), base));
    expect(s.positions.ETH.reservedQuantity).toBe(0);
  });

  it('ignores sell placement/cancel without a position and unknown symbols', () => {
    const o = order({ side: 'sell', quantity: 1 });
    expect(reduce(orderPlaced(o))).toEqual(initialPortfolioState);
    expect(reduce(orderCancelled(o))).toEqual(initialPortfolioState);
    expect(reduce(orderFilled(fill({ symbol: 'NOPEUSDT' })))).toEqual(initialPortfolioState);
  });

  it('caps trade history at 500, newest first', () => {
    let s = reduce({ type: '@@init' });
    for (let i = 0; i < MAX_TRADES + 1; i++) {
      s = reduce(
        orderFilled(fill({ id: `f${i}`, side: 'buy', type: 'market', quantity: 0.001, price: 1 })),
        s,
      );
    }
    expect(s.trades).toHaveLength(MAX_TRADES);
    expect(s.trades[0].id).toBe(`f${MAX_TRADES}`);
  });

  it('resets to initial state', () => {
    const s = reduce(orderFilled(fill({ side: 'buy', type: 'market' })));
    expect(reduce(portfolioReset(), s)).toEqual(initialPortfolioState);
  });
});
