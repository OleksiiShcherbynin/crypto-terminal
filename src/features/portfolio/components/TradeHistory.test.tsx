import { screen, within } from '@testing-library/react';
import { it, expect } from 'vitest';
import { TradeHistory } from './TradeHistory';
import { renderWithStore } from '../../../test/renderWithStore';
import { historyState } from '../../../test/uiFixtures';

it('history shows newest first', () => {
  renderWithStore(<TradeHistory />, { preloadedState: historyState() });
  const rows = screen.getAllByRole('row').slice(1);
  expect(rows).toHaveLength(2);
  expect(within(rows[0]!).getByText('Sell')).toBeInTheDocument();
  expect(within(rows[1]!).getByText('Buy')).toBeInTheDocument();
});

it('shows an empty state', () => {
  renderWithStore(<TradeHistory />);
  expect(screen.getByText('No trades yet')).toBeInTheDocument();
});
