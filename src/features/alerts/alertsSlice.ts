import { createSelector, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { portfolioReset } from '../../domain/actions';
import type { Alert, AlertRequest } from '../../domain/types';

export interface AlertsState {
  items: Alert[];
}

const initialState: AlertsState = { items: [] };

const alertsSlice = createSlice({
  name: 'alerts',
  initialState,
  reducers: {
    alertRequested: (_state, _action: PayloadAction<AlertRequest>) => {},
    alertCreated: (state, { payload }: PayloadAction<Alert>) => {
      state.items.push(payload);
    },
    alertDeleted: (state, { payload: id }: PayloadAction<string>) => {
      state.items = state.items.filter((a) => a.id !== id);
    },
    alertTriggered: (
      state,
      { payload }: PayloadAction<{ id: string; price: number; at: number }>,
    ) => {
      const alert = state.items.find((a) => a.id === payload.id);
      if (!alert) return;
      alert.triggeredAt = payload.at;
      alert.triggeredPrice = payload.price;
    },
    alertRejected: (
      _state,
      _action: PayloadAction<{ request: AlertRequest; reason: string }>,
    ) => {},
  },
  extraReducers: (builder) => {
    builder.addCase(portfolioReset, () => initialState);
  },
});

export const { alertRequested, alertCreated, alertDeleted, alertTriggered, alertRejected } =
  alertsSlice.actions;

export const selectAlerts = (s: { alerts: AlertsState }): Alert[] => s.alerts.items;

export const selectActiveAlerts = createSelector([selectAlerts], (alerts) =>
  alerts.filter((a) => a.triggeredAt === undefined),
);

export const selectAlertById =
  (id: string) =>
  (s: { alerts: AlertsState }): Alert | undefined =>
    s.alerts.items.find((a) => a.id === id);

export default alertsSlice.reducer;
