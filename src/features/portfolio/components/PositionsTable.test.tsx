import { screen } from '@testing-library/react';
import { it, expect } from 'vitest';
import { PositionsTable } from './PositionsTable';
import { renderWithStore } from '../../../test/renderWithStore';
import { positionsState } from '../../../test/uiFixtures';

it('renders a position row with pnl from the ticker', () => {
  renderWithStore(<PositionsTable />, { preloadedState: positionsState() });
  const row = screen.getByRole('row', { name: /BTC/ });
  expect(row).toHaveTextContent('1.00000');
  expect(row).toHaveTextContent('100.00');
  expect(row).toHaveTextContent('101.00');
  expect(screen.getByText('+1.00 (+1.00%)')).toHaveClass('text-up');
});

it('shows an empty state', () => {
  renderWithStore(<PositionsTable />);
  expect(screen.getByText('No positions yet')).toBeInTheDocument();
});
