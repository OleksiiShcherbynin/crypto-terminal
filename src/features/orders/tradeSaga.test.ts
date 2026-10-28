import { expectSaga } from 'redux-saga-test-plan';
import { describe, expect, it } from 'vitest';
import { rootReducer } from '../../app/store';
import {
  orderCancelRequested,
  orderCancelled,
  orderFilled,
  orderPlaced,
  orderRejected,
  orderRequested,
} from '../../domain/actions';
import { fakeDeps, fill, order, t } from '../../test/fixtures';
import { connectionStatusChanged } from '../market/connectionSlice';
import { tickersUpdated } from '../market/tickersSlice';
import { tradeSaga } from './tradeSaga';

const stateWith = (status: 'live' | 'reconnecting' = 'live') => {
  let s = rootReducer(undefined, { type: '@@init' });
  s = rootReducer(s, tickersUpdated([t('BTCUSDT', 100)]));
  return rootReducer(s, connectionStatusChanged({ status, attempt: 0 }));
};

describe('tradeSaga', () => {
  it('fills a market buy at the last price', async () => {
    const result = await expectSaga(tradeSaga, fakeDeps())
      .withReducer(rootReducer, stateWith())
      .put(
        orderFilled({
          id: 'id-1',
          symbol: 'BTCUSDT',
          side: 'buy',
          type: 'market',
          quantity: 0.1,
          price: 100,
          executedAt: 1_700_000_000_000,
        }),
      )
      .dispatch(orderRequested({ symbol: 'BTCUSDT', side: 'buy', type: 'market', quantity: 0.1 }))
      .silentRun(50);
    expect(result.storeState.portfolio.quoteBalance).toBe(9990);
  });

  it('rejects market order while not live', async () => {
    const request = { symbol: 'BTCUSDT', side: 'buy', type: 'market', quantity: 0.1 } as const;
    const result = await expectSaga(tradeSaga, fakeDeps())
      .withReducer(rootReducer, stateWith('reconnecting'))
      .put(orderRejected({ request, reason: 'Market orders need a live connection' }))
      .dispatch(orderRequested(request))
      .silentRun(50);
    expect(result.allEffects.some((e) => JSON.stringify(e).includes(orderFilled.type))).toBe(false);
  });

  it('places a limit buy below market and reserves quote', async () => {
    const result = await expectSaga(tradeSaga, fakeDeps())
      .withReducer(rootReducer, stateWith())
      .put(
        orderPlaced({
          id: 'id-1',
          symbol: 'BTCUSDT',
          side: 'buy',
          price: 90,
          quantity: 0.1,
          createdAt: 1_700_000_000_000,
        }),
      )
      .dispatch(
        orderRequested({ symbol: 'BTCUSDT', side: 'buy', type: 'limit', quantity: 0.1, price: 90 }),
      )
      .silentRun(50);
    expect(result.storeState.orders.items).toHaveLength(1);
    expect(result.storeState.portfolio.reservedQuote).toBe(9);
  });

  it('rejects a limit buy above market', async () => {
    const request = {
      symbol: 'BTCUSDT',
      side: 'buy',
      type: 'limit',
      quantity: 0.1,
      price: 110,
    } as const;
    const result = await expectSaga(tradeSaga, fakeDeps())
      .withReducer(rootReducer, stateWith())
      .put(orderRejected({ request, reason: 'Buy limit must be below the current price' }))
      .dispatch(orderRequested(request))
      .silentRun(50);
    expect(result.storeState.orders.items).toHaveLength(0);
  });

  it('rejects an unknown pair', async () => {
    const request = { symbol: 'FOOUSDT', side: 'buy', type: 'market', quantity: 1 } as const;
    await expectSaga(tradeSaga, fakeDeps())
      .withReducer(rootReducer, stateWith())
      .put(orderRejected({ request, reason: 'Unknown pair' }))
      .dispatch(orderRequested(request))
      .silentRun(50);
  });

  describe('cancel requests', () => {
    const a = order({ id: 'a', price: 90, quantity: 0.1 });
    const b = order({ id: 'b', price: 80, quantity: 0.1 });

    it('cancels an open limit buy and releases its reservation', async () => {
      const state = rootReducer(stateWith(), orderPlaced(a));
      expect(state.portfolio.reservedQuote).toBe(9);
      const result = await expectSaga(tradeSaga, fakeDeps())
        .withReducer(rootReducer, state)
        .put(orderCancelled(a))
        .dispatch(orderCancelRequested('a'))
        .silentRun(50);
      expect(result.storeState.portfolio.reservedQuote).toBe(0);
      expect(result.storeState.orders.items).toHaveLength(0);
    });

    it('ignores a stale cancel for an already filled order', async () => {
      let state = rootReducer(stateWith(), orderPlaced(a));
      state = rootReducer(state, orderPlaced(b));
      state = rootReducer(
        state,
        orderFilled(fill({ id: 'f', orderId: 'a', price: 90, quantity: 0.1 })),
      );
      const reserved = state.portfolio.reservedQuote;
      expect(reserved).toBe(8);
      const result = await expectSaga(tradeSaga, fakeDeps())
        .withReducer(rootReducer, state)
        .not.put(orderCancelled(a))
        .dispatch(orderCancelRequested('a'))
        .silentRun(50);
      expect(result.storeState.portfolio.reservedQuote).toBe(reserved);
      expect(result.storeState.orders.items.map((o: { id: string }) => o.id)).toEqual(['b']);
    });
  });
});
