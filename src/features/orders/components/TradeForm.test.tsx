import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { it, expect, vi } from 'vitest';
import { TradeForm } from './TradeForm';
import { orderRequested } from '../../../domain/actions';
import { renderWithStore } from '../../../test/renderWithStore';
import { t } from '../../../test/fixtures';
import { tradeState } from '../../../test/uiFixtures';
import { tickersUpdated } from '../../market/tickersSlice';

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
  // Market buys keep a 0.1 % buffer: 10,000 USDT × 25 % × 0.999 / 100.
  await userEvent.click(screen.getByRole('button', { name: '25%' }));
  expect(qty()).toHaveValue('24.975');
  await userEvent.click(screen.getByRole('button', { name: '100%' }));
  expect(qty()).toHaveValue('99.9');
  expect(submit()).toBeEnabled();
});

it('a 100 % market buy stays sendable after an up-tick', async () => {
  const { store } = renderWithStore(<TradeForm />, { preloadedState: tradeState() });
  await userEvent.click(screen.getByRole('button', { name: '100%' }));
  act(() => {
    store.dispatch(tickersUpdated([t('BTCUSDT', 101)]));
  });
  // Recomputed from the new price: floor(9,990 / 101, 5).
  expect(qty()).toHaveValue('98.91089');
  expect(screen.queryByText('Insufficient USDT')).not.toBeInTheDocument();
  expect(submit()).toBeEnabled();
});

it('typing in the quantity forgets the selected percent', async () => {
  const { store } = renderWithStore(<TradeForm />, { preloadedState: tradeState() });
  await userEvent.click(screen.getByRole('button', { name: '100%' }));
  await userEvent.type(qty(), '5');
  expect(qty()).toHaveValue('99.95');
  act(() => {
    store.dispatch(tickersUpdated([t('BTCUSDT', 101)]));
  });
  expect(qty()).toHaveValue('99.95');
  expect(screen.getByText('Insufficient USDT')).toBeInTheDocument();
});

it('dispatches orderRequested for a market buy (comma decimal) and clears the quantity', async () => {
  const { store } = renderWithStore(<TradeForm />, { preloadedState: tradeState() });
  const spy = vi.spyOn(store, 'dispatch');
  await userEvent.type(qty(), '2,5');
  await userEvent.click(submit());
  expect(spy).toHaveBeenCalledWith(
    orderRequested({
      symbol: 'BTCUSDT',
      side: 'buy',
      type: 'market',
      quantity: 2.5,
      price: undefined,
    }),
  );
  expect(qty()).toHaveValue('');
});

it('shows connection message and disables submit when reconnecting', async () => {
  renderWithStore(<TradeForm />, { preloadedState: tradeState('reconnecting') });
  await userEvent.type(qty(), '1');
  expect(screen.getByText('Market orders need a live connection')).toBeInTheDocument();
  expect(screen.getByText('Last known price — feed reconnecting')).toBeInTheDocument();
  expect(submit()).toBeDisabled();
});

it('says the feed is offline, and says nothing about a price it never had', () => {
  const view = renderWithStore(<TradeForm />, { preloadedState: tradeState('offline') });
  expect(screen.getByText('Last known price — feed offline')).toBeInTheDocument();
  view.unmount();
  renderWithStore(<TradeForm />, {
    preloadedState: { ...tradeState('connecting'), tickers: {} },
  });
  expect(screen.queryByText(/Last known price/)).not.toBeInTheDocument();
});

it('opens Limit with a buy price below the last price and no error', async () => {
  renderWithStore(<TradeForm />, { preloadedState: tradeState() });
  await userEvent.click(screen.getByRole('button', { name: 'Limit' }));
  expect(screen.getByLabelText('Price')).toHaveValue('99.50');
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  await userEvent.type(qty(), '1');
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(submit()).toBeEnabled();
});

it('an untouched limit price follows the market once the market moves through it', async () => {
  const { store } = renderWithStore(<TradeForm />, { preloadedState: tradeState() });
  await userEvent.click(screen.getByRole('button', { name: 'Limit' }));
  act(() => {
    store.dispatch(tickersUpdated([t('BTCUSDT', 99.8)]));
  });
  expect(screen.getByLabelText('Price')).toHaveValue('99.50');
  act(() => {
    store.dispatch(tickersUpdated([t('BTCUSDT', 99)]));
  });
  expect(screen.getByLabelText('Price')).toHaveValue('98.50');
});

it('a re-anchored limit price holds still when the market drifts back', async () => {
  const { store } = renderWithStore(<TradeForm />, { preloadedState: tradeState() });
  await userEvent.click(screen.getByRole('button', { name: 'Limit' }));
  act(() => {
    store.dispatch(tickersUpdated([t('BTCUSDT', 99)]));
  });
  expect(screen.getByLabelText('Price')).toHaveValue('98.50');
  // Back above the old 99.50 prefill: the field must not jump back and forth with the market.
  for (const last of [99.7, 99.2, 99.8]) {
    act(() => {
      store.dispatch(tickersUpdated([t('BTCUSDT', last)]));
    });
    expect(screen.getByLabelText('Price')).toHaveValue('98.50');
  }
});

it('moves the untouched limit prefill to the other side when the side changes', async () => {
  renderWithStore(<TradeForm />, { preloadedState: tradeState() });
  await userEvent.click(screen.getByRole('button', { name: 'Limit' }));
  await userEvent.click(screen.getByRole('button', { name: 'Sell' }));
  expect(screen.getByLabelText('Price')).toHaveValue('100.50');
  await userEvent.click(screen.getByRole('button', { name: 'Buy' }));
  expect(screen.getByLabelText('Price')).toHaveValue('99.50');
});

it('keeps a hand-edited limit price when the side changes', async () => {
  renderWithStore(<TradeForm />, { preloadedState: tradeState() });
  await userEvent.click(screen.getByRole('button', { name: 'Limit' }));
  await userEvent.clear(screen.getByLabelText('Price'));
  await userEvent.type(screen.getByLabelText('Price'), '97');
  await userEvent.click(screen.getByRole('button', { name: 'Sell' }));
  expect(screen.getByLabelText('Price')).toHaveValue('97');
});

it('shows "Buy limit must be below the current price" once the price was edited', async () => {
  renderWithStore(<TradeForm />, { preloadedState: tradeState() });
  await userEvent.click(screen.getByRole('button', { name: 'Limit' }));
  await userEvent.clear(screen.getByLabelText('Price'));
  await userEvent.type(screen.getByLabelText('Price'), '100');
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
