import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { it, expect, vi } from 'vitest';
import { TradeForm } from './TradeForm';
import { orderRequested } from '../../../domain/actions';
import { renderWithStore } from '../../../test/renderWithStore';
import { tradeState } from '../../../test/uiFixtures';

const submit = () => screen.getByRole('button', { name: /^(Buy|Sell) BTC$/ });
const qty = () => screen.getByLabelText('Quantity');

it('submit is disabled with an empty quantity and hides the quantity error', () => {
  renderWithStore(<TradeForm />, { preloadedState: tradeState() });
  expect(submit()).toBeDisabled();
  expect(screen.queryByText('Enter a quantity greater than zero')).not.toBeInTheDocument();
});

it('shows the quantity error once the field was edited', async () => {
  renderWithStore(<TradeForm />, { preloadedState: tradeState() });
  await userEvent.type(qty(), '1');
  await userEvent.clear(qty());
  expect(screen.getByText('Enter a quantity greater than zero')).toBeInTheDocument();
});

it('shows "Insufficient USDT" when cost exceeds available', async () => {
  renderWithStore(<TradeForm />, { preloadedState: tradeState() });
  await userEvent.type(qty(), '1000');
  expect(screen.getByText('Insufficient USDT')).toBeInTheDocument();
  expect(submit()).toBeDisabled();
});

it('percent buttons fill the quantity, flooring to the pair precision', async () => {
  renderWithStore(<TradeForm />, { preloadedState: tradeState() });
  await userEvent.click(screen.getByRole('button', { name: '25%' }));
  expect(qty()).toHaveValue('25');
  await userEvent.click(screen.getByRole('button', { name: '100%' }));
  expect(qty()).toHaveValue('100');
  expect(submit()).toBeEnabled();
});

it('dispatches orderRequested for a market buy and clears the quantity', async () => {
  const { store } = renderWithStore(<TradeForm />, { preloadedState: tradeState() });
  const spy = vi.spyOn(store, 'dispatch');
  await userEvent.type(qty(), '2');
  await userEvent.click(submit());
  expect(spy).toHaveBeenCalledWith(
    orderRequested({
      symbol: 'BTCUSDT',
      side: 'buy',
      type: 'market',
      quantity: 2,
      price: undefined,
    }),
  );
  expect(qty()).toHaveValue('');
});

it('shows connection message and disables submit when reconnecting', async () => {
  renderWithStore(<TradeForm />, { preloadedState: tradeState('reconnecting') });
  await userEvent.type(qty(), '1');
  expect(screen.getByText('Market orders need a live connection')).toBeInTheDocument();
  expect(screen.getByText('Price is stale while offline')).toBeInTheDocument();
  expect(submit()).toBeDisabled();
});

it('shows "Buy limit must be below the current price"', async () => {
  renderWithStore(<TradeForm />, { preloadedState: tradeState() });
  await userEvent.click(screen.getByRole('button', { name: 'Limit' }));
  expect(screen.getByLabelText('Price')).toHaveValue('100.00');
  await userEvent.type(qty(), '1');
  expect(screen.getByText('Buy limit must be below the current price')).toBeInTheDocument();
  expect(submit()).toBeDisabled();
});

it('places a limit order while offline using the last known price', async () => {
  const { store } = renderWithStore(<TradeForm />, { preloadedState: tradeState('offline') });
  const spy = vi.spyOn(store, 'dispatch');
  await userEvent.click(screen.getByRole('button', { name: 'Limit' }));
  const price = screen.getByLabelText('Price');
  await userEvent.clear(price);
  await userEvent.type(price, '90');
  await userEvent.type(qty(), '1');
  expect(submit()).toBeEnabled();
  await userEvent.click(submit());
  expect(spy).toHaveBeenCalledWith(
    orderRequested({ symbol: 'BTCUSDT', side: 'buy', type: 'limit', quantity: 1, price: 90 }),
  );
});

it('switching side clears the quantity and relabels the button', async () => {
  renderWithStore(<TradeForm />, { preloadedState: tradeState() });
  await userEvent.type(qty(), '1');
  await userEvent.click(screen.getByRole('button', { name: 'Sell' }));
  expect(qty()).toHaveValue('');
  expect(screen.getByRole('button', { name: 'Sell BTC' })).toBeInTheDocument();
  expect(screen.getByText('0.00000 BTC')).toBeInTheDocument();
});
