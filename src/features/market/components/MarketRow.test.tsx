import { screen } from '@testing-library/react';
import { it, expect } from 'vitest';
import { MarketRow } from './MarketRow';
import { renderWithStore } from '../../../test/renderWithStore';
import { marketState } from '../../../test/uiFixtures';

it('row shows price with pair precision and signed change', () => {
  renderWithStore(<MarketRow symbol="BTCUSDT" />, { preloadedState: marketState() });
  const row = screen.getByRole('option');
  expect(row).toHaveTextContent('BTC/USDT');
  expect(row).toHaveTextContent('67,123.46');
  expect(row).toHaveTextContent('+1.23%');
  expect(row).toHaveTextContent('12.3M');
});

it('colours negative change as down', () => {
  renderWithStore(<MarketRow symbol="ETHUSDT" />, { preloadedState: marketState() });
  expect(screen.getByText('-0.50%')).toHaveClass('text-down');
});

it('rows are dimmed when reconnecting', () => {
  renderWithStore(<MarketRow symbol="BTCUSDT" />, {
    preloadedState: marketState('reconnecting', 2),
  });
  expect(screen.getByRole('option')).toHaveClass('opacity-50');
});

it('rows are not dimmed when live', () => {
  renderWithStore(<MarketRow symbol="BTCUSDT" />, { preloadedState: marketState('live') });
  expect(screen.getByRole('option')).not.toHaveClass('opacity-50');
});

it('shows a placeholder before the first tick', () => {
  renderWithStore(<MarketRow symbol="BTCUSDT" />, { preloadedState: { tickers: {} } });
  expect(screen.getByRole('option')).toHaveTextContent('--');
});
