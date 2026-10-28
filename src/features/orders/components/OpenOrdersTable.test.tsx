import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { it, expect } from 'vitest';
import { OpenOrdersTable } from './OpenOrdersTable';
import { orderCancelRequested } from '../../../domain/actions';
import { renderWithStore } from '../../../test/renderWithStore';
import { spyOnDispatch } from '../../../test/uiFixtures';
import { order } from '../../../test/fixtures';

it('cancel button dispatches orderCancelRequested with the order id', async () => {
  const o = order({ price: 90 });
  const view = renderWithStore(<OpenOrdersTable />, {
    preloadedState: { orders: { items: [o] } },
  });
  const spy = spyOnDispatch(view, <OpenOrdersTable />);
  expect(screen.getByText('90.00')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: /Cancel/ }));
  expect(spy).toHaveBeenCalledWith(orderCancelRequested(o.id));
});

it('shows an empty state', () => {
  renderWithStore(<OpenOrdersTable />);
  expect(screen.getByText('No open orders')).toBeInTheDocument();
});
