import { expectSaga } from 'redux-saga-test-plan';
import { describe, expect, it } from 'vitest';
import { rootReducer } from '../../app/store';
import { portfolioReset } from '../../domain/actions';
import { alert, fakeDeps, t } from '../../test/fixtures';
import { tickersUpdated } from '../market/tickersSlice';
import { alertSaga } from './alertSaga';
import {
  alertCreated,
  alertDeleted,
  alertRejected,
  alertRequested,
  alertTriggered,
} from './alertsSlice';

const initial = () => rootReducer(undefined, { type: '@@init' });
const withTicker = (last: number) => ({ ...initial(), tickers: { BTCUSDT: t('BTCUSDT', last) } });

const triggerCount = (result: { allEffects: unknown[] }) =>
  (result.allEffects as Array<{ type: string; payload: { action?: { type?: string } } }>).filter(
    (e) => e.type === 'PUT' && e.payload.action?.type === alertTriggered.type,
  ).length;

describe('alertSaga', () => {
  it('creates an alert when its condition is not yet true', async () => {
    const req = { symbol: 'BTCUSDT', direction: 'above' as const, price: 100 };
    const deps = fakeDeps();
    await expectSaga(alertSaga, deps)
      .withReducer(rootReducer, withTicker(90))
      .put(alertCreated({ ...req, id: 'id-1', createdAt: deps.now() }))
      .dispatch(alertRequested(req))
      .silentRun(50);
  });

  it('rejects an alert whose condition is already true', async () => {
    const req = { symbol: 'BTCUSDT', direction: 'above' as const, price: 100 };
    const result = await expectSaga(alertSaga, fakeDeps())
      .withReducer(rootReducer, withTicker(120))
      .put(alertRejected({ request: req, reason: 'Price is already above 100.00' }))
      .dispatch(alertRequested(req))
      .silentRun(50);
    expect(result.storeState.alerts.items).toHaveLength(0);
  });

  it('rejects an unknown pair', async () => {
    const req = { symbol: 'NOPEUSDT', direction: 'above' as const, price: 100 };
    await expectSaga(alertSaga, fakeDeps())
      .withReducer(rootReducer, initial())
      .put(alertRejected({ request: req, reason: 'Unknown pair' }))
      .dispatch(alertRequested(req))
      .silentRun(50);
  });

  it('triggers once when the level is reached', async () => {
    const req = { symbol: 'BTCUSDT', direction: 'above' as const, price: 100 };
    const result = await expectSaga(alertSaga, fakeDeps())
      .withReducer(rootReducer, withTicker(90))
      .dispatch(alertRequested(req))
      .dispatch(tickersUpdated([t('BTCUSDT', 95)]))
      .dispatch(tickersUpdated([t('ETHUSDT', 500)]))
      .dispatch(tickersUpdated([t('BTCUSDT', 101, { receivedAt: 7_000 })]))
      .dispatch(tickersUpdated([t('BTCUSDT', 105)]))
      .silentRun(50);
    expect(triggerCount(result)).toBe(1);
    const [stored] = result.storeState.alerts.items;
    expect(stored?.triggeredAt).toBe(7_000);
    expect(stored?.triggeredPrice).toBe(101);
  });

  it('does not trigger after deletion', async () => {
    const result = await expectSaga(alertSaga, fakeDeps())
      .withReducer(rootReducer, initial())
      .dispatch(alertCreated(alert({ id: 'a1' })))
      .dispatch(alertDeleted('a1'))
      .dispatch(tickersUpdated([t('BTCUSDT', 200)]))
      .silentRun(50);
    expect(triggerCount(result)).toBe(0);
  });

  it('stops watchers on portfolioReset', async () => {
    const result = await expectSaga(alertSaga, fakeDeps())
      .withReducer(rootReducer, initial())
      .dispatch(alertCreated(alert()))
      .dispatch(portfolioReset())
      .dispatch(tickersUpdated([t('BTCUSDT', 200)]))
      .silentRun(50);
    expect(triggerCount(result)).toBe(0);
  });

  it('restored alert fires on first live tick past the level', async () => {
    const restored = {
      ...initial(),
      tickers: { BTCUSDT: t('BTCUSDT', 120) },
      alerts: { items: [alert({ id: 'r1', price: 100 })] },
    };
    const result = await expectSaga(alertSaga, fakeDeps())
      .withReducer(rootReducer, restored)
      .dispatch(tickersUpdated([t('BTCUSDT', 121, { receivedAt: 9_000 })]))
      .silentRun(50);
    expect(triggerCount(result)).toBe(1);
    expect(result.storeState.alerts.items[0]?.triggeredAt).toBe(9_000);
  });

  it('does not re-watch restored alerts that already triggered', async () => {
    const restored = {
      ...initial(),
      alerts: { items: [alert({ id: 'r1', triggeredAt: 5, triggeredPrice: 101 })] },
    };
    const result = await expectSaga(alertSaga, fakeDeps())
      .withReducer(rootReducer, restored)
      .dispatch(tickersUpdated([t('BTCUSDT', 500)]))
      .silentRun(50);
    expect(triggerCount(result)).toBe(0);
  });
});
