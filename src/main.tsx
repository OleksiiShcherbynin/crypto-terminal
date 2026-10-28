import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import './index.css';
import App from './App.tsx';
import { createAppStore } from './app/store';
import { loadPersistedState } from './app/persistence';
import { createSocketClient } from './services/binance/socketClient';
import { fetchKlines } from './services/binance/rest';
import { WS_HOSTS } from './services/binance/hosts';

const deps = {
  client: createSocketClient(),
  fetchKlines,
  storage: localStorage,
  now: Date.now,
  newId: () => crypto.randomUUID(),
  wsHosts: WS_HOSTS,
};

const { store } = createAppStore({ preloadedState: loadPersistedState(localStorage), deps });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Provider store={store}>
      <App />
    </Provider>
  </StrictMode>,
);
