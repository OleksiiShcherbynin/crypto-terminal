import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import type { Task } from 'redux-saga';
import { afterEach, expect, it, vi } from 'vitest';
import App from './App';
import { createAppStore } from './app/store';
import { fakeDeps, t } from './test/fixtures';

// jsdom has no canvas; the real chart cannot render here.
vi.mock('lightweight-charts', () => ({
  CandlestickSeries: 'Candlestick',
  createChart: () => ({
    addSeries: () => ({ setData: vi.fn(), update: vi.fn(), applyOptions: vi.fn() }),
    applyOptions: vi.fn(),
    remove: vi.fn(),
    timeScale: () => ({ fitContent: vi.fn() }),
  }),
}));

let sagaTask: Task | undefined;

afterEach(() => {
  sagaTask?.cancel();
  sagaTask = undefined;
});

/** Boots the real store with every saga running against a fake socket and REST client. */
function boot() {
  const deps = fakeDeps();
  const created = createAppStore({ deps });
  sagaTask = created.sagaTask;
  render(
    <Provider store={created.store}>
      <App />
    </Provider>,
  );
  const tick = (symbol: string, last: number) =>
    act(() => {
      deps.client.emit({ type: 'message', event: { kind: 'ticker', ticker: t(symbol, last) } });
    });
  return { ...created, deps, tick };
}

it('streams a price, fills a market buy and shows it everywhere', async () => {
  const { deps, tick } = boot();
  act(() => deps.client.emit({ type: 'open' }));
  tick('BTCUSDT', 100);

  // Market row, chart header and trade form all read the same batched ticker.
  expect((await screen.findAllByText('100.00')).length).toBeGreaterThanOrEqual(2);
  expect(screen.getByText('Live')).toBeInTheDocument();

  await userEvent.type(screen.getByLabelText('Quantity'), '0.1');
  await userEvent.click(screen.getByRole('button', { name: 'Buy BTC' }));

  expect(await screen.findByText(/Bought 0.10000 BTC/)).toBeInTheDocument();
  expect(within(screen.getByRole('banner')).getByText('10,000.00')).toBeInTheDocument();
  expect(deps.client.streams.has('btcusdt@miniTicker')).toBe(true);
  expect(deps.client.openedHosts).toHaveLength(1);
});

it('cancels a resting limit order through the saga, so a later cross does not fill it', async () => {
  const { deps, store, tick } = boot();
  act(() => deps.client.emit({ type: 'open' }));
  tick('BTCUSDT', 100);
  await screen.findAllByText('100.00');

  await userEvent.click(screen.getByRole('button', { name: 'Limit' }));
  await userEvent.clear(screen.getByLabelText('Price'));
  await userEvent.type(screen.getByLabelText('Price'), '90');
  await userEvent.type(screen.getByLabelText('Quantity'), '1');
  await userEvent.click(screen.getByRole('button', { name: 'Buy BTC' }));

  await userEvent.click(await screen.findByRole('tab', { name: /Open orders/ }));
  await userEvent.click(await screen.findByRole('button', { name: /Cancel buy order BTC\/USDT/ }));
  expect(await screen.findByText('No open orders')).toBeInTheDocument();

  tick('BTCUSDT', 80);
  await screen.findAllByText('80.00');
  expect(store.getState().portfolio.trades).toHaveLength(0);
  expect(screen.queryByText(/Limit order filled/)).not.toBeInTheDocument();
});
