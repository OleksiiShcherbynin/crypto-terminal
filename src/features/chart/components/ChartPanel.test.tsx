import { cleanup, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { chartState } from '../../../test/uiFixtures';
import { renderWithStore } from '../../../test/renderWithStore';

const setData = vi.fn();
const update = vi.fn();
const fitContent = vi.fn();
const remove = vi.fn();

vi.mock('lightweight-charts', () => ({
  CandlestickSeries: 'Candlestick',
  createChart: () => ({
    addSeries: () => ({ setData, update, applyOptions: vi.fn() }),
    applyOptions: vi.fn(),
    remove,
    timeScale: () => ({ fitContent }),
  }),
}));

import { ChartPanel } from './ChartPanel';

beforeEach(() => {
  setData.mockClear();
  update.mockClear();
  fitContent.mockClear();
  remove.mockClear();
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
