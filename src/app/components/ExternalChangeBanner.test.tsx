import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { act } from 'react';
import { it, expect, vi, afterEach } from 'vitest';
import { ExternalChangeBanner } from './ExternalChangeBanner';
import { externalChangeDetected } from '../appSlice';
import { renderWithStore } from '../../test/renderWithStore';

afterEach(() => vi.unstubAllGlobals());

it('banner appears only after externalChangeDetected', () => {
  const { store } = renderWithStore(<ExternalChangeBanner />);
  expect(screen.queryByText(/changed in another tab/)).not.toBeInTheDocument();
  act(() => {
    store.dispatch(externalChangeDetected());
  });
  expect(
    screen.getByText('This terminal was changed in another tab. Reload to sync.'),
  ).toBeInTheDocument();
});

it('Reload button reloads the page', async () => {
  const reload = vi.fn();
  vi.stubGlobal('location', { ...window.location, reload });
  renderWithStore(<ExternalChangeBanner />, { preloadedState: { app: { externalChange: true } } });
  await userEvent.click(screen.getByRole('button', { name: 'Reload' }));
  expect(reload).toHaveBeenCalledOnce();
});
