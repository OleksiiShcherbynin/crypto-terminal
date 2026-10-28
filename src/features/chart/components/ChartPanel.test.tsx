import { cleanup, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act } from '@testing-library/react';
import { candlesLoaded, candlesLoading, candleReceived } from '../candlesSlice';
import { pairSelected } from '../../market/selectionSlice';
import { c } from '../../../test/fixtures';
import { chartState } from '../../../test/uiFixtures';
import { renderWithStore } from '../../../test/renderWithStore';

const setData = vi.fn();
const update = vi.fn();
const fitContent = vi.fn();
const remove = vi.fn();
const applyOptions = vi.fn();
const chartApplyOptions = vi.fn();
const createChart = vi.fn();

type Formatter = (price: number) => string;
const formatterOf = (options: unknown): Formatter =>
  (options as { localization: { priceFormatter: Formatter } }).localization.priceFormatter;

vi.mock('lightweight-charts', () => ({
  CandlestickSeries: 'Candlestick',
  createChart: (...args: unknown[]) => createChart(...args),
}));

beforeEach(() => {
  createChart.mockImplementation(() => ({
    addSeries: () => ({ setData, update, applyOptions }),
    applyOptions: chartApplyOptions,
    remove,
    timeScale: () => ({ fitContent }),
  }));
});

import { ChartPanel } from './ChartPanel';

beforeEach(() => {
  setData.mockClear();
  update.mockClear();
  fitContent.mockClear();
  remove.mockClear();
  applyOptions.mockClear();
  chartApplyOptions.mockClear();
});
afterEach(cleanup);

it('shows selected pair header with price and change', () => {
  renderWithStore(<ChartPanel />, { preloadedState: chartState() });
  expect(screen.getByText('BTC/USDT')).toBeInTheDocument();
  expect(screen.getByText('67,123.46')).toBeInTheDocument();
  expect(screen.getByText('+1.23%')).toBeInTheDocument();
});

it('interval buttons dispatch intervalChanged', async () => {
  const { store } = renderWithStore(<ChartPanel />, { preloadedState: chartState() });
  await userEvent.click(screen.getByRole('button', { name: '15m' }));
  expect(store.getState().selection.interval).toBe('15m');
});

it('shows unavailable note', () => {
  renderWithStore(<ChartPanel />, { preloadedState: chartState('unavailable', []) });
  expect(screen.getByText('History unavailable — showing live candles')).toBeInTheDocument();
});

it('shows loading text', () => {
  renderWithStore(<ChartPanel />, { preloadedState: chartState('loading', []) });
  expect(screen.getByText('Loading…')).toBeInTheDocument();
});

it('calls setData with candles on mount', () => {
  renderWithStore(<ChartPanel />, { preloadedState: chartState() });
  expect(setData).toHaveBeenCalledWith([
    { time: 60, open: 100, high: 100, low: 100, close: 100 },
    { time: 120, open: 101, high: 101, low: 101, close: 101 },
  ]);
  expect(fitContent).toHaveBeenCalled();
});

it('removes the chart on unmount', () => {
  const { unmount } = renderWithStore(<ChartPanel />, { preloadedState: chartState() });
  unmount();
  expect(remove).toHaveBeenCalled();
});

const BTC = { symbol: 'BTCUSDT', interval: '1m' } as const;
const ETH = { symbol: 'ETHUSDT', interval: '1m' } as const;

it('appending a newer candle calls update, not setData', () => {
  const { store } = renderWithStore(<ChartPanel />, { preloadedState: chartState() });
  setData.mockClear();
  act(() => {
    store.dispatch(candleReceived({ ...BTC, candle: c(180, 102) }));
  });
  expect(setData).not.toHaveBeenCalled();
  expect(update).toHaveBeenCalledWith({ time: 180, open: 102, high: 102, low: 102, close: 102 });
});

it('replacing the last candle in place calls update', () => {
  const { store } = renderWithStore(<ChartPanel />, { preloadedState: chartState() });
  setData.mockClear();
  act(() => {
    store.dispatch(candleReceived({ ...BTC, candle: c(120, 105) }));
  });
  expect(setData).not.toHaveBeenCalled();
  expect(update).toHaveBeenCalledWith({ time: 120, open: 105, high: 105, low: 105, close: 105 });
});

it('pair switch clears the series then reloads with setData', () => {
  const { store } = renderWithStore(<ChartPanel />, { preloadedState: chartState() });
  setData.mockClear();
  update.mockClear();
  const next = [c(60, 5), c(120, 6)];
  act(() => {
    store.dispatch(candlesLoading(ETH));
  });
  expect(setData).toHaveBeenLastCalledWith([]);
  act(() => {
    store.dispatch(candlesLoaded({ ...ETH, candles: next }));
  });
  expect(setData).toHaveBeenCalledTimes(2);
  expect(setData).toHaveBeenLastCalledWith(
    next.map(({ time, open, high, low, close }) => ({ time, open, high, low, close })),
  );
  expect(update).not.toHaveBeenCalled();
});

it('history load replacing live-only candles calls setData', () => {
  const { store } = renderWithStore(<ChartPanel />, {
    preloadedState: chartState('unavailable', [c(120, 101)]),
  });
  setData.mockClear();
  act(() => {
    store.dispatch(candlesLoaded({ ...BTC, candles: [c(60), c(120, 101), c(180, 102)] }));
  });
  expect(setData).toHaveBeenCalledTimes(1);
  expect(setData.mock.calls[0][0]).toHaveLength(3);
});

it('pair change re-applies priceFormat with the new precision', () => {
  const { store } = renderWithStore(<ChartPanel />, { preloadedState: chartState() });
  applyOptions.mockClear();
  act(() => {
    store.dispatch(pairSelected('PEPEUSDT'));
  });
  expect(applyOptions).toHaveBeenCalledWith({
    priceFormat: { type: 'price', precision: 8, minMove: 1e-8 },
  });
});

it('price scale labels use the app price format with grouping and pair precision', () => {
  const { store } = renderWithStore(<ChartPanel />, { preloadedState: chartState() });
  const created = createChart.mock.calls.at(-1)?.[1];
  expect(formatterOf(created)(80_674.5612)).toBe('80,674.56');
  act(() => {
    store.dispatch(pairSelected('PEPEUSDT'));
  });
  const applied = chartApplyOptions.mock.calls.at(-1)?.[0];
  expect(formatterOf(applied)(0.0000123)).toBe('0.00001230');
});
