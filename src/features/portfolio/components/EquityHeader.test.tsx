import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { it, expect } from 'vitest';
import { EquityHeader } from './EquityHeader';
import { renderWithStore } from '../../../test/renderWithStore';
import { equityState } from '../../../test/uiFixtures';

it('equity sums quote and positions', () => {
  renderWithStore(<EquityHeader />, { preloadedState: equityState() });
  expect(screen.getByText('10,120.00')).toBeInTheDocument();
  expect(screen.getByText('+20.00')).toHaveClass('text-up');
  expect(screen.getByText('Crypto Terminal')).toBeInTheDocument();
});

it('reset asks for confirmation then restores the portfolio', async () => {
  const { store } = renderWithStore(<EquityHeader />, { preloadedState: equityState() });
  await userEvent.click(screen.getByRole('button', { name: 'Reset portfolio' }));
  expect(screen.getByText('Reset to 10,000 USDT?')).toBeInTheDocument();
  expect(store.getState().portfolio.quoteBalance).toBe(9_000);
  await userEvent.click(screen.getByRole('button', { name: 'Confirm' }));
  const s = store.getState();
  expect(s.portfolio.quoteBalance).toBe(10_000);
  expect(s.portfolio.realizedPnl).toBe(0);
  expect(s.portfolio.positions).toEqual({});
  expect(s.portfolio.trades).toEqual([]);
  expect(screen.getByRole('button', { name: 'Reset portfolio' })).toBeInTheDocument();
});

it('cancel and Escape leave the portfolio untouched', async () => {
  const { store } = renderWithStore(<EquityHeader />, { preloadedState: equityState() });
  await userEvent.click(screen.getByRole('button', { name: 'Reset portfolio' }));
  await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(screen.getByRole('button', { name: 'Reset portfolio' })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Reset portfolio' }));
  await userEvent.keyboard('{Escape}');
  expect(screen.getByRole('button', { name: 'Reset portfolio' })).toBeInTheDocument();
  expect(store.getState().portfolio.quoteBalance).toBe(9_000);
});
