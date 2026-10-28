import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { it, expect, vi } from 'vitest';
import { AlertsPanel } from './AlertsPanel';
import { alertDeleted, alertRequested } from '../alertsSlice';
import { renderWithStore } from '../../../test/renderWithStore';
import { alert, t } from '../../../test/fixtures';
import { tickersUpdated } from '../../market/tickersSlice';
import { spyOnDispatch, tradeState } from '../../../test/uiFixtures';

const priceInput = () => screen.getByLabelText('Price');

const addButton = () => screen.getByRole('button', { name: 'Add alert' });

it('alert form opens 1 % above the last price with no error', () => {
  renderWithStore(<AlertsPanel />, { preloadedState: tradeState() });
  expect(priceInput()).toHaveValue('101.00');
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(addButton()).toBeEnabled();
});

it('an untouched prefill follows the market once the market reaches it', () => {
  const { store } = renderWithStore(<AlertsPanel />, { preloadedState: tradeState() });
  act(() => {
    store.dispatch(tickersUpdated([t('BTCUSDT', 100.5)]));
  });
  expect(priceInput()).toHaveValue('101.00');
  act(() => {
    store.dispatch(tickersUpdated([t('BTCUSDT', 102)]));
  });
  expect(priceInput()).toHaveValue('103.02');
  expect(addButton()).toBeEnabled();
});

it('switching direction moves the untouched prefill to the other side', async () => {
  renderWithStore(<AlertsPanel />, { preloadedState: tradeState() });
  await userEvent.click(screen.getByRole('button', { name: 'Below' }));
  expect(priceInput()).toHaveValue('99.00');
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Above' }));
  expect(priceInput()).toHaveValue('101.00');
});

it('keeps a hand-edited price when the direction changes', async () => {
  renderWithStore(<AlertsPanel />, { preloadedState: tradeState() });
  await userEvent.clear(priceInput());
  await userEvent.type(priceInput(), '150');
  await userEvent.click(screen.getByRole('button', { name: 'Below' }));
  expect(priceInput()).toHaveValue('150');
  expect(screen.getByText('Price is already below 150.00')).toBeInTheDocument();
  expect(addButton()).toBeDisabled();
});

it('alert form rejects an already-true condition inline', async () => {
  const { store } = renderWithStore(<AlertsPanel />, { preloadedState: tradeState() });
  const spy = vi.spyOn(store, 'dispatch');
  await userEvent.clear(priceInput());
  await userEvent.type(priceInput(), '90,5');
  expect(screen.getByText('Price is already above 90.50')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Add alert' }));
  expect(spy).not.toHaveBeenCalled();
});

it('submits a valid alert and dispatches alertRequested', async () => {
  const { store } = renderWithStore(<AlertsPanel />, { preloadedState: tradeState() });
  const spy = vi.spyOn(store, 'dispatch');
  await userEvent.click(screen.getByRole('button', { name: 'Below' }));
  await userEvent.clear(priceInput());
  await userEvent.type(priceInput(), '95,5');
  await userEvent.click(screen.getByRole('button', { name: 'Add alert' }));
  expect(spy).toHaveBeenCalledWith(
    alertRequested({ symbol: 'BTCUSDT', direction: 'below', price: 95.5 }),
  );
  // The form starts over from a fresh prefill for the chosen direction.
  expect(priceInput()).toHaveValue('99.00');
});

it('lists waiting and triggered alerts', () => {
  renderWithStore(<AlertsPanel />, {
    preloadedState: {
      ...tradeState(),
      alerts: {
        items: [alert({ id: 'a1' }), alert({ id: 'a2', triggeredAt: 0, triggeredPrice: 70012.1 })],
      },
    },
  });
  expect(screen.getByText('Waiting')).toBeInTheDocument();
  expect(screen.getByText(/Triggered \d\d:\d\d:\d\d @ 70,012\.10/)).toBeInTheDocument();
});

it('delete dispatches alertDeleted', async () => {
  const view = renderWithStore(<AlertsPanel />, {
    preloadedState: { ...tradeState(), alerts: { items: [alert({ id: 'a1' })] } },
  });
  const spy = spyOnDispatch(view, <AlertsPanel />);
  await userEvent.click(screen.getByRole('button', { name: /Delete alert/ }));
  expect(spy).toHaveBeenCalledWith(alertDeleted('a1'));
});
