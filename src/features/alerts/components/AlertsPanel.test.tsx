import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { it, expect, vi } from 'vitest';
import { AlertsPanel } from './AlertsPanel';
import { alertDeleted, alertRequested } from '../alertsSlice';
import { renderWithStore } from '../../../test/renderWithStore';
import { alert } from '../../../test/fixtures';
import { spyOnDispatch, tradeState } from '../../../test/uiFixtures';

const priceInput = () => screen.getByLabelText('Price');

it('alert form rejects an already-true condition inline', async () => {
  const { store } = renderWithStore(<AlertsPanel />, { preloadedState: tradeState() });
  const spy = vi.spyOn(store, 'dispatch');
  expect(priceInput()).toHaveValue('100.00');
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
