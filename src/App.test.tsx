import { render, screen } from '@testing-library/react';
import { it, expect } from 'vitest';
import App from './App';

it('renders the title', () => {
  render(<App />);
  expect(screen.getByText('Crypto Terminal')).toBeInTheDocument();
});
