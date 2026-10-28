import { screen } from '@testing-library/react';
import { it, expect } from 'vitest';
import App from './App';
import { renderWithStore } from './test/renderWithStore';

it('renders the title', () => {
  renderWithStore(<App />);
  expect(screen.getByText('Crypto Terminal')).toBeInTheDocument();
});
