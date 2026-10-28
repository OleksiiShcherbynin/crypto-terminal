import { describe, expect, it } from 'vitest';
import { portfolioReset } from '../../domain/actions';
import { alert } from '../../test/fixtures';
import reducer, {
  alertCreated,
  alertDeleted,
  alertRejected,
  alertRequested,
  alertTriggered,
  selectActiveAlerts,
  selectAlertById,
  selectAlerts,
  type AlertsState,
} from './alertsSlice';

const init = (items: AlertsState['items'] = []): AlertsState => ({ items });

describe('alertsSlice', () => {
  it('adds a created alert and deletes by id', () => {
    let state = reducer(init(), alertCreated(alert()));
    expect(selectAlerts({ alerts: state })).toEqual([alert()]);
    state = reducer(state, alertDeleted('a1'));
    expect(state.items).toEqual([]);
  });

  it('marks alert triggered', () => {
    const state = reducer(init([alert()]), alertTriggered({ id: 'a1', price: 101, at: 5 }));
    expect(state.items[0]).toMatchObject({ triggeredAt: 5, triggeredPrice: 101 });
    expect(selectActiveAlerts({ alerts: state })).toEqual([]);
    expect(selectAlertById('a1')({ alerts: state })?.id).toBe('a1');
  });

  it('leaves state unchanged on requested and rejected', () => {
    const state = init([alert()]);
    const req = { symbol: 'BTCUSDT', direction: 'above' as const, price: 1 };
    expect(reducer(state, alertRequested(req))).toBe(state);
    expect(reducer(state, alertRejected({ request: req, reason: 'x' }))).toBe(state);
  });

  it('clears on portfolioReset', () => {
    expect(reducer(init([alert()]), portfolioReset()).items).toEqual([]);
  });
});
