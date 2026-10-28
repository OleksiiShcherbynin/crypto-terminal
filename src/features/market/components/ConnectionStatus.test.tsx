import { screen } from '@testing-library/react';
import { it, expect } from 'vitest';
import { ConnectionStatus } from './ConnectionStatus';
import { renderWithStore } from '../../../test/renderWithStore';
import { marketState } from '../../../test/uiFixtures';

it('status shows attempt number', () => {
  renderWithStore(<ConnectionStatus />, { preloadedState: marketState('reconnecting', 3) });
  expect(screen.getByRole('status')).toHaveTextContent('Reconnecting (attempt 3)');
});

it.each([
  ['live', 'Live'],
  ['offline', 'Offline'],
  ['connecting', 'Connecting'],
] as const)('shows %s', (status, label) => {
  renderWithStore(<ConnectionStatus />, { preloadedState: marketState(status) });
  expect(screen.getByRole('status')).toHaveTextContent(label);
});
