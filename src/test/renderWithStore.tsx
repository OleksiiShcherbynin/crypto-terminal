import type { ReactElement } from 'react';
import { render, type RenderResult } from '@testing-library/react';
import { Provider } from 'react-redux';
import { createAppStore, type AppStore, type RootState } from '../app/store';
import type { createFakeSocketClient } from '../services/binance/testing';
import { fakeDeps } from './fixtures';

export function renderWithStore(
  ui: ReactElement,
  opts: { preloadedState?: Partial<RootState> } = {},
): RenderResult & { store: AppStore; client: ReturnType<typeof createFakeSocketClient> } {
  const deps = fakeDeps();
  const { store } = createAppStore({ preloadedState: opts.preloadedState, deps, runSaga: false });
  const result = render(<Provider store={store}>{ui}</Provider>);
  return { ...result, store, client: deps.client };
}
