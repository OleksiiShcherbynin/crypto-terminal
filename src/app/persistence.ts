import type { RootState } from './store';
import type { PortfolioState } from '../features/portfolio/portfolioSlice';
import type { OrdersState } from '../features/orders/ordersSlice';
import type { AlertsState } from '../features/alerts/alertsSlice';
import type { SelectionState } from '../features/market/selectionSlice';

export const STORAGE_KEY = 'crypto-terminal:v1';
export const SCHEMA_VERSION = 1;

export interface PersistedState {
  version: 1;
  portfolio: PortfolioState;
  orders: OrdersState;
  alerts: AlertsState;
  selection: SelectionState;
}

export function pickPersisted(state: RootState): PersistedState {
  return {
    version: SCHEMA_VERSION,
    portfolio: state.portfolio,
    orders: state.orders,
    alerts: state.alerts,
    selection: state.selection,
  };
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function loadPersistedState(storage: Storage): Partial<RootState> | undefined {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (raw === null) return undefined;
    const parsed: unknown = JSON.parse(raw);
    if (!isObject(parsed) || parsed.version !== SCHEMA_VERSION) return undefined;
    const { portfolio, orders, alerts, selection } = parsed;
    if (!isObject(portfolio) || !isObject(orders) || !isObject(alerts) || !isObject(selection)) {
      return undefined;
    }
    return {
      portfolio: portfolio as unknown as PortfolioState,
      orders: orders as unknown as OrdersState,
      alerts: alerts as unknown as AlertsState,
      selection: selection as unknown as SelectionState,
    };
  } catch {
    return undefined;
  }
}

export function savePersistedState(storage: Storage, state: RootState): void {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(pickPersisted(state)));
  } catch {
    // Storage may be full or unavailable (private mode); persistence is best-effort.
  }
}
