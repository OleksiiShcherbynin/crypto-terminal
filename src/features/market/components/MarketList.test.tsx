import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { it, expect } from 'vitest';
import { MarketList } from './MarketList';
import { renderWithStore } from '../../../test/renderWithStore';
import { marketState } from '../../../test/uiFixtures';

it('filters pairs by typed text', async () => {
  renderWithStore(<MarketList />, { preloadedState: marketState() });
  expect(screen.getAllByRole('option').length).toBeGreaterThan(1);
  await userEvent.type(screen.getByRole('searchbox', { name: 'Filter pairs' }), 'eth');
  const options = screen.getAllByRole('option');
  expect(options).toHaveLength(1);
  expect(options[0]).toHaveTextContent('ETH/USDT');
});

it('clicking a row dispatches pairSelected', async () => {
  const { store } = renderWithStore(<MarketList />, { preloadedState: marketState() });
  await userEvent.click(screen.getByRole('option', { name: /ETH\/USDT/ }));
  expect(store.getState().selection.symbol).toBe('ETHUSDT');
});

it('Enter on a focused row selects it', async () => {
  const { store } = renderWithStore(<MarketList />, { preloadedState: marketState() });
  screen.getByRole('option', { name: /ETH\/USDT/ }).focus();
  await userEvent.keyboard('{Enter}');
  expect(store.getState().selection.symbol).toBe('ETHUSDT');
});

it('marks the selected row', () => {
  renderWithStore(<MarketList />, { preloadedState: marketState() });
  const list = screen.getByRole('listbox', { name: 'Pairs' });
  expect(within(list).getByRole('option', { name: /BTC\/USDT/ })).toHaveAttribute(
    'aria-selected',
    'true',
  );
});
