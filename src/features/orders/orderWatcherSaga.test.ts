import { expectSaga } from 'redux-saga-test-plan';
import { describe, expect, it } from 'vitest';
import { rootReducer } from '../../app/store';
import { orderCancelled, orderFilled, orderPlaced, portfolioReset } from '../../domain/actions';
import { fakeDeps, order, t } from '../../test/fixtures';
import { tickersUpdated } from '../market/tickersSlice';
import { crosses, orderWatcherSaga } from './orderWatcherSaga';

const initial = () => rootReducer(undefined, { type: '@@init' });
const buy90 = () => order({ id: 'o1', side: 'buy', price: 90, quantity: 0.1 });

const fillCount = (result: { allEffects: unknown[] }) =>
  (result.allEffects as Array<{ type: string; payload: { action?: { type?: string } } }>).filter(
    (e) => e.type === 'PUT' && e.payload.action?.type === orderFilled.type,
  ).length;

describe('crosses', () => {
  it('uses inclusive comparison', () => {
    expect(crosses({ side: 'buy', price: 90 }, 90)).toBe(true);
    expect(crosses({ side: 'buy', price: 90 }, 90.01)).toBe(false);
    expect(crosses({ side: 'sell', price: 110 }, 110)).toBe(true);
    expect(crosses({ side: 'sell', price: 110 }, 109.99)).toBe(false);
  });
});

describe('orderWatcherSaga', () => {
  it('fills a buy limit when price falls to the limit', async () => {
    await expectSaga(orderWatcherSaga, fakeDeps())
      .withReducer(rootReducer, initial())
      .put(
        orderFilled({
          id: 'id-1',
          orderId: 'o1',
          symbol: 'BTCUSDT',
          side: 'buy',
          type: 'limit',
          quantity: 0.1,
          price: 90,
          executedAt: 5_000,
        }),
      )
      .dispatch(orderPlaced(buy90()))
      .dispatch(tickersUpdated([t('BTCUSDT', 95, { receivedAt: 4_000 })]))
      .dispatch(tickersUpdated([t('BTCUSDT', 90, { receivedAt: 5_000 })]))
      .silentRun(50);
  });

  it('does not fill while the price has not crossed', async () => {
    const result = await expectSaga(orderWatcherSaga, fakeDeps())
      .withReducer(rootReducer, initial())
      .dispatch(orderPlaced(buy90()))
      .dispatch(tickersUpdated([t('BTCUSDT', 95)]))
      .silentRun(50);
    expect(fillCount(result)).toBe(0);
    expect(result.storeState.orders.items).toHaveLength(1);
  });

  it('ignores other symbols in the same batch', async () => {
    const result = await expectSaga(orderWatcherSaga, fakeDeps())
      .withReducer(rootReducer, initial())
      .dispatch(orderPlaced(buy90()))
      .dispatch(tickersUpdated([t('ETHUSDT', 10), t('BTCUSDT', 95)]))
      .silentRun(50);
    expect(fillCount(result)).toBe(0);
  });

  it('does not fill after cancellation', async () => {
    const o = buy90();
    const result = await expectSaga(orderWatcherSaga, fakeDeps())
      .withReducer(rootReducer, initial())
      .dispatch(orderPlaced(o))
      .dispatch(orderCancelled(o))
      .dispatch(tickersUpdated([t('BTCUSDT', 10)]))
      .silentRun(50);
    expect(fillCount(result)).toBe(0);
  });

  it('cancelling one order leaves other watchers running', async () => {
    const a = order({ id: 'a', side: 'buy', price: 90 });
    const b = order({ id: 'b', side: 'buy', price: 80 });
    const result = await expectSaga(orderWatcherSaga, fakeDeps())
      .withReducer(rootReducer, initial())
      .dispatch(orderPlaced(a))
      .dispatch(orderPlaced(b))
      .dispatch(orderCancelled(a))
      .dispatch(tickersUpdated([t('BTCUSDT', 70)]))
      .silentRun(50);
    expect(fillCount(result)).toBe(1);
    expect(result.storeState.orders.items).toHaveLength(0);
  });

  it('fills two orders that cross on the same tick', async () => {
    const result = await expectSaga(orderWatcherSaga, fakeDeps())
      .withReducer(rootReducer, initial())
      .dispatch(orderPlaced(order({ id: 'a', price: 90 })))
      .dispatch(orderPlaced(order({ id: 'b', price: 95 })))
      .dispatch(tickersUpdated([t('BTCUSDT', 85)]))
      .silentRun(50);
    expect(fillCount(result)).toBe(2);
  });

  it('fills an order once when several crossing ticks arrive', async () => {
    const result = await expectSaga(orderWatcherSaga, fakeDeps())
      .withReducer(rootReducer, initial())
      .dispatch(orderPlaced(buy90()))
      .dispatch(tickersUpdated([t('BTCUSDT', 85)]))
      .dispatch(tickersUpdated([t('BTCUSDT', 80)]))
      .silentRun(50);
    expect(fillCount(result)).toBe(1);
  });

  it('re-spawns watchers for restored orders on start', async () => {
    const start = initial();
    const restored = {
      ...start,
      orders: { items: [order({ id: 'r1', side: 'sell', price: 110 })] },
    };
    const result = await expectSaga(orderWatcherSaga, fakeDeps())
      .withReducer(rootReducer, restored)
      .dispatch(tickersUpdated([t('BTCUSDT', 110)]))
      .silentRun(50);
    expect(fillCount(result)).toBe(1);
  });

  it('does not fill restored orders from stale ticker state', async () => {
    const start = initial();
    const restored = {
      ...start,
      tickers: { BTCUSDT: t('BTCUSDT', 120) },
      orders: { items: [order({ id: 'r1', side: 'sell', price: 110 })] },
    };
    const result = await expectSaga(orderWatcherSaga, fakeDeps())
      .withReducer(rootReducer, restored)
      .silentRun(50);
    expect(fillCount(result)).toBe(0);
  });

  it('stops all watchers on portfolioReset', async () => {
    const result = await expectSaga(orderWatcherSaga, fakeDeps())
      .withReducer(rootReducer, initial())
      .dispatch(orderPlaced(buy90()))
      .dispatch(portfolioReset())
      .dispatch(tickersUpdated([t('BTCUSDT', 10)]))
      .silentRun(50);
    expect(fillCount(result)).toBe(0);
  });
});
