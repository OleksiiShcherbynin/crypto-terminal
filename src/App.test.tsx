import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { it, expect } from 'vitest';
import App from './App';
import { renderWithStore } from './test/renderWithStore';

it('renders the title', () => {
  renderWithStore(<App />);
  expect(screen.getByText('Crypto Terminal')).toBeInTheDocument();
});

it('renders the four regions', () => {
  renderWithStore(<App />);
  for (const name of ['Market', 'Chart', 'Trade', 'Portfolio']) {
    expect(screen.getByRole('region', { name })).toBeInTheDocument();
  }
});

it('switches bottom panel tabs and shows the empty state', async () => {
  renderWithStore(<App />);
  expect(screen.getByRole('tabpanel')).toHaveTextContent('Nothing here yet');
  await userEvent.click(screen.getByRole('tab', { name: 'History' }));
  expect(screen.getByRole('tab', { name: 'History' })).toHaveAttribute('aria-selected', 'true');
});
