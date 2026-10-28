import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { it, expect } from 'vitest';
import { ToastStack } from './ToastStack';
import { renderWithStore } from '../../../test/renderWithStore';

it('renders toasts and the close button dismisses one', async () => {
  const { store } = renderWithStore(<ToastStack />, {
    preloadedState: {
      toasts: {
        items: [
          { id: 'a', kind: 'success', title: 'Order filled', message: 'Bought 1 BTC' },
          { id: 'b', kind: 'info', title: 'Hello' },
        ],
      },
    },
  });
  expect(screen.getAllByRole('status')).toHaveLength(2);
  expect(screen.getByText('Bought 1 BTC')).toBeInTheDocument();
  await userEvent.click(screen.getAllByRole('button', { name: 'Dismiss notification' })[0]);
  expect(screen.queryByText('Order filled')).not.toBeInTheDocument();
  expect(store.getState().toasts.items.map((x) => x.id)).toEqual(['b']);
});

it('renders nothing when there are no toasts', () => {
  renderWithStore(<ToastStack />);
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});
