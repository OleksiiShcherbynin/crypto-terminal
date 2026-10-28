# Crypto Terminal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A browser-only paper-trading crypto terminal on live Binance prices that showcases redux-saga, built as a portfolio piece.

**Architecture:** Redux Toolkit slices hold state; every asynchronous or timed behaviour lives in redux-saga (socket event channel with reconnect, chart loading with cancellation, per-order and per-alert watchers, toast timers, debounced persistence). Cross-feature communication is actions only. A thin `services/binance` layer wraps the WebSocket and REST endpoints so sagas and tests inject it.

**Tech Stack:** Vite 8, React 19, TypeScript strict, Redux Toolkit 2.13, react-redux 9, redux-saga 1.5, redux-saga-test-plan 4, Tailwind CSS 4 (`@tailwindcss/vite`), lightweight-charts 5, big.js 7, Vitest 5 + jsdom + React Testing Library 16, ESLint 10 + Prettier 3, GitHub Actions → GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-10-28-crypto-terminal-design.md` (Russian twin: `…-design.ru.md`). Every task below implements a numbered section of the spec; read the spec first.

**Parallelism (spec §8):** Tasks 1–8 are sequential and establish contracts. After Task 8, group **S** (Tasks 9–16, sagas) and group **U** (Tasks 17–22, UI) are independent of each other and may be run by different agents in parallel. Task 23 integrates.

## Global Constraints

- TypeScript `strict: true`; no `any` in product code; sagas typed with `SagaIterator`, the result of `yield select/call/take` annotated on the receiving `const`.
- Node 24, npm 11, Windows 11 / PowerShell 5.1. `&&` inside `package.json` scripts is fine (npm runs them through cmd.exe); never chain with `&&` on the PowerShell command line.
- Keep the TypeScript and ESLint versions the Vite template pins; do not bump TypeScript to 7.x.
- Binance hosts (spec §3): WS `data-stream.binance.vision` then `stream.binance.com:9443`; REST `data-api.binance.vision` then `api.binance.com`. Streams: `<symbol lowercase>@miniTicker`, `<symbol lowercase>@kline_<interval>`. Intervals: `1m`, `15m`, `1h`. History: 300 candles.
- Starting balance 10 000 USDT; no fees, no slippage, long only; limit fills at the limit price; funds reserved at placement (spec §4.4).
- Storage key `crypto-terminal:v1`, schema version 1 (spec §4.8).
- Timing defaults (spec §5.3): tick batch 250 ms; silence timeout 30 000 ms; backoff 1 s doubling to a 30 s cap; status `offline` after 5 consecutive failed attempts; toast auto-dismiss 6 000 ms; persistence debounce 500 ms. All injectable for tests.
- UI copy, code, comments, README in English. Dark theme only.
- Every task ends with `npm run check` (lint + typecheck + tests) passing and a commit. Commit messages: conventional (`feat:`, `test:`, `chore:`), ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Any design doc or plan written during execution gets a Russian `.ru.md` twin (owner's standing rule).

## Review Focus

1. **Socket blocked, REST fine:** chart history loads, status goes `connecting → reconnecting → offline` after 5 attempts, Buy/Sell for market orders is disabled with the connection message. Pinned in Task 9 (`reaches offline after five failed attempts`) and Task 11 (`rejects market order while not live`).
2. **Sell 100 % leaves no dust:** after selling the whole position the position entry is gone and USDT balance is exact. Pinned in Task 5 (`removes position when fully sold`).
3. **Reserved funds never go negative:** a limit buy reserves `price × qty`; its fill releases exactly that amount even with 8-decimal quantities. Pinned in Task 5 (`fill releases exactly the reserved quote`).
4. **Corrupt or old storage:** garbage JSON or `version: 0` yields a clean default state, not a crash. Pinned in Task 8 (`loadPersistedState` tests).
5. **Rapid pair switching:** a history response for a pair that is no longer selected is dropped. Pinned in Task 4 (`ignores candlesLoaded for another symbol`) and Task 10 (`takeLatest cancels the previous load`).

---

## File structure

```
.github/workflows/deploy.yml
index.html, vite.config.ts, tsconfig*.json, eslint.config.js, .prettierrc, package.json
src/
  main.tsx                     boot: load persisted state, build deps, create store, render
  App.tsx                      layout grid (market | chart+trade | bottom panel), banner, toasts
  index.css                    Tailwind import + @theme tokens
  domain/
    types.ts                   all domain types (Ticker, Candle, Order, Fill, Trade, Position, Alert, Toast …)
    actions.ts                 cross-feature actions (appStarted, portfolioReset, order* actions)
    pairs.ts                   WATCHED_PAIRS, findPair, stream-name helpers
    money.ts                   big.js arithmetic helpers
    format.ts                  number formatting for the UI
  services/binance/
    hosts.ts                   WS_HOSTS, REST_HOSTS, pickHost
    types.ts                   raw Binance message shapes
    parse.ts                   parseStreamMessage → MarketEvent | null
    socketClient.ts            createSocketClient
    rest.ts                    fetchKlines
    testing.ts                 FakeWebSocket, createFakeSocketClient (test-only helpers)
  app/
    store.ts                   rootReducer, RootState, SagaDeps, createAppStore
    rootSaga.ts
    hooks.ts                   useAppDispatch, useAppSelector
    appSlice.ts                externalChange flag
    persistence.ts             STORAGE_KEY, pick/load/save
    persistenceSaga.ts
    components/BottomPanel.tsx, ExternalChangeBanner.tsx
  features/
    market/      tickersSlice.ts, connectionSlice.ts, selectionSlice.ts, selectors.ts,
                 marketStreamSaga.ts, components/{MarketList,MarketRow,MarketFilter,ConnectionStatus}.tsx, usePriceFlash.ts
    chart/       candlesSlice.ts, chartSaga.ts, components/{ChartPanel,CandleChart,IntervalPicker}.tsx
    portfolio/   portfolioSlice.ts, selectors.ts, components/{EquityHeader,PositionsTable,TradeHistory,ResetPortfolioButton}.tsx
    orders/      ordersSlice.ts, validation.ts, tradeSaga.ts, orderWatcherSaga.ts, components/{TradeForm,OpenOrdersTable}.tsx
    alerts/      alertsSlice.ts, validation.ts, alertSaga.ts, components/{AlertsPanel,AlertForm}.tsx
    notifications/ toastsSlice.ts, toastSaga.ts, notificationsSaga.ts, components/ToastStack.tsx
  ui/            Button.tsx, Input.tsx, Panel.tsx, Tabs.tsx, Segmented.tsx
  test/          setup.ts, fixtures.ts, renderWithStore.tsx
```

Tests live next to the file they test as `<name>.test.ts(x)`.

---

### Task 1: Scaffold, tooling, first commit

**Files:**
- Create: project via `npm create vite@latest . -- --template react-ts`, then `vite.config.ts`, `.prettierrc`, `src/test/setup.ts`, `src/index.css`, `src/App.test.tsx`, `.gitignore` (template), `README.md` (one-line placeholder)

**Interfaces:**
- Produces: `npm run check` = `run-s lint typecheck test`; `npm run test` = `vitest run`; `npm run dev`, `npm run build` (template); Vite `base: '/crypto-terminal/'`; Vitest with jsdom, `setupFiles: ['src/test/setup.ts']` importing `@testing-library/jest-dom/vitest`.

- [ ] **Step 1: Scaffold** — in the project folder run `npm create vite@latest . -- --template react-ts` (answer "ignore files and continue" if asked), then `git init`, then install:

```
npm i @reduxjs/toolkit react-redux redux-saga lightweight-charts big.js
npm i -D tailwindcss @tailwindcss/vite vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event redux-saga-test-plan @types/big.js npm-run-all2 prettier
```

- [ ] **Step 2: Configure** — `vite.config.ts`: plugins `react()`, `tailwindcss()`; `base: '/crypto-terminal/'`; `test: { environment: 'jsdom', setupFiles: ['src/test/setup.ts'] }` (add `/// <reference types="vitest/config" />`). `src/index.css`: `@import "tailwindcss";`. `.prettierrc`: `{ "singleQuote": true, "printWidth": 100 }`. Scripts in `package.json`: `"test": "vitest run"`, `"typecheck": "tsc -b"` (the template's `tsconfig.app.json` already sets `noEmit`), `"check": "run-s lint typecheck test"`, `"format": "prettier --write src"`. Replace template `App.tsx` with `<main>Crypto Terminal</main>`.

- [ ] **Step 3: Write the smoke test** `src/App.test.tsx`:

```tsx
it('renders the title', () => {
  render(<App />);
  expect(screen.getByText('Crypto Terminal')).toBeInTheDocument();
});
```

- [ ] **Step 4: Run** `npm run check` — Expected: lint clean, typecheck clean, 1 test passed.

- [ ] **Step 5: Commit** — `git add -A` and `git commit -m "chore: scaffold Vite + React + TS + Tailwind + Vitest"`.

---

### Task 2: Domain types, pairs, money, format

**Files:**
- Create: `src/domain/types.ts`, `src/domain/pairs.ts`, `src/domain/money.ts`, `src/domain/format.ts`
- Test: `src/domain/pairs.test.ts`, `src/domain/money.test.ts`, `src/domain/format.test.ts`

**Interfaces:**
- Produces (`types.ts`):

```ts
export type Interval = '1m' | '15m' | '1h';
export const INTERVALS: readonly Interval[] = ['1m', '15m', '1h'];
export interface Pair { symbol: string; base: string; quote: string; pricePrecision: number; qtyPrecision: number }
export interface Ticker { symbol: string; last: number; open: number; high: number; low: number; volume: number; changePct: number; receivedAt: number }
export interface Candle { time: number; open: number; high: number; low: number; close: number; volume: number } // time: unix seconds
export type Side = 'buy' | 'sell';
export type OrderType = 'market' | 'limit';
export interface OrderRequest { symbol: string; side: Side; type: OrderType; quantity: number; price?: number }
export interface Order { id: string; symbol: string; side: Side; price: number; quantity: number; createdAt: number } // always limit
export interface Fill { id: string; orderId?: string; symbol: string; side: Side; type: OrderType; quantity: number; price: number; executedAt: number }
export interface Trade extends Fill { total: number; realizedPnl: number }
export interface Position { asset: string; quantity: number; avgPrice: number; reservedQuantity: number }
export type AlertDirection = 'above' | 'below';
export interface AlertRequest { symbol: string; direction: AlertDirection; price: number }
export interface Alert extends AlertRequest { id: string; createdAt: number; triggeredAt?: number; triggeredPrice?: number }
export type ToastKind = 'info' | 'success' | 'warning' | 'error';
export interface Toast { id: string; kind: ToastKind; title: string; message?: string }
export type ConnectionStatus = 'connecting' | 'live' | 'reconnecting' | 'offline';
```

- Produces (`pairs.ts`): `WATCHED_PAIRS: readonly Pair[]` (the 25 USDT pairs from spec §4.2, `pricePrecision` 2 for BTC/ETH/BNB/SOL/LTC, 4 for the rest, 8 for PEPE; `qtyPrecision` 5 for BTC, 4 for ETH, 2 otherwise); `findPair(symbol: string): Pair | undefined`; `miniTickerStream(symbol: string): string` → `btcusdt@miniTicker`; `klineStream(symbol: string, interval: Interval): string` → `btcusdt@kline_1m`; `isKlineStream(stream: string): boolean`.
- Produces (`money.ts`, all `(a: number, b: number) => number` via big.js, rounded to 8 dp): `add`, `sub`, `mul`, `div`; `roundTo(value: number, dp: number): number`; `isZero(value: number): boolean` (|value| < 1e-8).
- Produces (`format.ts`): `formatPrice(value: number, precision: number): string` → `67,412.50`; `formatQuantity(value: number, precision: number): string`; `formatPct(pct: number): string` → `+1.84%` / `-0.30%`; `formatCompact(value: number): string` → `1.2B`, `845.3M`, `12.5K`; `formatUsd(value: number): string` → `8,765.00`; `formatTime(ms: number): string` → `14:05:32`.

- [ ] **Step 1: Write failing tests**

```ts
// pairs.test.ts
it('has 25 unique USDT pairs', () => { expect(new Set(WATCHED_PAIRS.map(p => p.symbol)).size).toBe(25); WATCHED_PAIRS.forEach(p => expect(p.quote).toBe('USDT')); });
it('builds stream names in lowercase', () => { expect(miniTickerStream('BTCUSDT')).toBe('btcusdt@miniTicker'); expect(klineStream('BTCUSDT', '15m')).toBe('btcusdt@kline_15m'); expect(isKlineStream('btcusdt@kline_1m')).toBe(true); expect(isKlineStream('btcusdt@miniTicker')).toBe(false); });
// money.test.ts
it('adds without float drift', () => expect(add(0.1, 0.2)).toBe(0.3));
it('multiplies price by quantity', () => expect(mul(0.015, 66900)).toBe(1003.5));
it('treats tiny remainders as zero', () => expect(isZero(sub(0.3, add(0.1, 0.2)))).toBe(true));
// format.test.ts
it('formats price with grouping and fixed decimals', () => expect(formatPrice(67412.5, 2)).toBe('67,412.50'));
it('formats signed percent', () => { expect(formatPct(1.84)).toBe('+1.84%'); expect(formatPct(-0.3)).toBe('-0.30%'); });
it('formats compact volume', () => { expect(formatCompact(1_234_000_000)).toBe('1.2B'); expect(formatCompact(12_500)).toBe('12.5K'); });
```

- [ ] **Step 2: Run** `npm test -- src/domain` — Expected: FAIL (modules not found).
- [ ] **Step 3: Implement** the four files with the signatures above. `format.ts` uses `Intl.NumberFormat('en-US', …)`; `formatCompact` uses `notation: 'compact', maximumFractionDigits: 1`.
- [ ] **Step 4: Run** `npm test -- src/domain` — Expected: PASS.
- [ ] **Step 5: Commit** `feat: domain types, pairs, money and format helpers`.

---

### Task 3: Binance service layer

**Files:**
- Create: `src/services/binance/hosts.ts`, `types.ts`, `parse.ts`, `socketClient.ts`, `rest.ts`, `testing.ts`
- Test: `hosts.test.ts`, `parse.test.ts`, `socketClient.test.ts`, `rest.test.ts`

**Interfaces:**
- Consumes: Task 2 types, `miniTickerStream`/`klineStream`.
- Produces:

```ts
// hosts.ts
export const WS_HOSTS = ['data-stream.binance.vision', 'stream.binance.com:9443'] as const;
export const REST_HOSTS = ['data-api.binance.vision', 'api.binance.com'] as const;
export function pickHost(hosts: readonly string[], attempt: number): string; // attempt < 2 → hosts[0]; else hosts[(attempt - 1) % hosts.length]
// types.ts — raw shapes, all numeric fields are strings
export interface RawMiniTicker { e: '24hrMiniTicker'; E: number; s: string; c: string; o: string; h: string; l: string; v: string; q: string }
export interface RawKline { e: 'kline'; E: number; s: string; k: { t: number; T: number; s: string; i: string; o: string; c: string; h: string; l: string; v: string; x: boolean } }
export interface RawCombined { stream: string; data: RawMiniTicker | RawKline }
// parse.ts
export type MarketEvent = { kind: 'ticker'; ticker: Ticker } | { kind: 'candle'; symbol: string; interval: Interval; candle: Candle };
export function parseStreamMessage(raw: string, now: () => number = Date.now): MarketEvent | null; // null for acks {result,id}, unknown events, bad JSON
// socketClient.ts
export type SocketEvent = { type: 'open' } | { type: 'message'; event: MarketEvent } | { type: 'close'; code: number } | { type: 'error' };
export interface SocketClient {
  readonly streams: ReadonlySet<string>;
  open(host: string): void;              // url = `wss://${host}/stream?streams=${[...streams].join('/')}`; closes any previous socket first
  close(): void;
  subscribe(streams: string[]): void;    // adds; if open, sends {method:'SUBSCRIBE', params, id}
  unsubscribe(streams: string[]): void;  // removes; if open, sends {method:'UNSUBSCRIBE', params, id}; unknown streams ignored
  listen(listener: (e: SocketEvent) => void): () => void;
}
export function createSocketClient(deps?: { WebSocketImpl?: typeof WebSocket; now?: () => number }): SocketClient;
// rest.ts
export async function fetchKlines(symbol: string, interval: Interval, limit: number, deps?: { fetchImpl?: typeof fetch; hosts?: readonly string[] }): Promise<Candle[]>; // tries hosts in order; throws Error('klines unavailable') if all fail
// testing.ts
export class FakeWebSocket { static instances: FakeWebSocket[]; url: string; sent: string[]; readyState: number; constructor(url: string); send(data: string): void; close(): void; emitOpen(): void; emitMessage(raw: string): void; emitClose(code: number): void; emitError(): void }
export function createFakeSocketClient(): SocketClient & { emit(e: SocketEvent): void; openedHosts: string[]; closeCount: number };
```

- [ ] **Step 1: Write failing tests**

```ts
// hosts.test.ts
it('uses primary twice then alternates', () => expect([0,1,2,3,4].map(a => pickHost(WS_HOSTS, a))).toEqual([WS_HOSTS[0], WS_HOSTS[0], WS_HOSTS[1], WS_HOSTS[0], WS_HOSTS[1]]));
// parse.test.ts
it('parses miniTicker into Ticker with changePct', () => {
  const raw = JSON.stringify({ stream: 'btcusdt@miniTicker', data: { e: '24hrMiniTicker', E: 1, s: 'BTCUSDT', c: '101', o: '100', h: '102', l: '99', v: '10', q: '1000' } });
  expect(parseStreamMessage(raw, () => 5)).toEqual({ kind: 'ticker', ticker: { symbol: 'BTCUSDT', last: 101, open: 100, high: 102, low: 99, volume: 10, changePct: 1, receivedAt: 5 } });
});
it('parses kline into Candle with seconds time', () => { /* k.t = 1700000000000 → candle.time 1700000000, interval '1m' */ });
it('returns null for subscribe acks and garbage', () => { expect(parseStreamMessage('{"result":null,"id":1}')).toBeNull(); expect(parseStreamMessage('nope')).toBeNull(); });
// socketClient.test.ts (uses FakeWebSocket)
it('opens a combined-stream url from held streams', () => { client.subscribe(['btcusdt@miniTicker', 'ethusdt@miniTicker']); client.open('h'); expect(FakeWebSocket.instances[0].url).toBe('wss://h/stream?streams=btcusdt@miniTicker/ethusdt@miniTicker'); });
it('sends SUBSCRIBE when subscribing while open', () => { /* open, emitOpen, subscribe(['btcusdt@kline_1m']) → sent[0] parses to {method:'SUBSCRIBE', params:[…], id: 1} */ });
it('forwards parsed messages and close to listeners', () => { /* emitMessage(ticker raw) → listener got {type:'message', event:{kind:'ticker'…}}; emitClose(1006) → {type:'close', code:1006} */ });
it('re-opening closes the previous socket and resubscribes all streams', () => { /* open('a'); open('b') → instances[0] closed, instances[1].url contains all streams */ });
// rest.test.ts
it('maps kline rows to candles', async () => { const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify([[1700000000000, '1', '2', '0.5', '1.5', '10', 0]]))); expect(await fetchKlines('BTCUSDT', '1m', 1, { fetchImpl, hosts: ['h'] })).toEqual([{ time: 1700000000, open: 1, high: 2, low: 0.5, close: 1.5, volume: 10 }]); expect(fetchImpl.mock.calls[0][0]).toBe('https://h/api/v3/klines?symbol=BTCUSDT&interval=1m&limit=1'); });
it('falls back to the second host and throws when all fail', async () => { /* first rejects, second ok → result; both reject → rejects 'klines unavailable' */ });
```

- [ ] **Step 2: Run** `npm test -- src/services` — Expected: FAIL.
- [ ] **Step 3: Implement** the files. `socketClient` keeps a `Set<string>`, a listener array, an incrementing message id, and the current `WebSocket`; it parses each `message` with `parseStreamMessage` and drops nulls. `FakeWebSocket` pushes itself to `instances` in its constructor; tests reset `instances` in `beforeEach`. `createFakeSocketClient` records `openedHosts`, counts `close()`, and `emit` forwards to listeners.
- [ ] **Step 4: Run** `npm test -- src/services` — Expected: PASS.
- [ ] **Step 5: Commit** `feat: Binance socket client, message parser and klines REST`.

---

### Task 4: Simple slices (tickers, connection, selection, candles, toasts, app)

**Files:**
- Create: `src/domain/actions.ts`, `src/features/market/tickersSlice.ts`, `connectionSlice.ts`, `selectionSlice.ts`, `src/features/chart/candlesSlice.ts`, `src/features/notifications/toastsSlice.ts`, `src/app/appSlice.ts`
- Test: one `*.test.ts` per slice

**Interfaces:**
- Produces (`domain/actions.ts`, `createAction`): `appStarted()`, `portfolioReset()`, `orderRequested(req: OrderRequest)`, `orderPlaced(order: Order)`, `orderCancelled(order: Order)`, `orderFilled(fill: Fill)`, `orderRejected({ request: OrderRequest; reason: string })`.
- Produces slices (state → actions):
  - `tickers`: `Record<string, Ticker>` → `tickersUpdated(tickers: Ticker[])` (upsert by symbol).
  - `connection`: `{ status: ConnectionStatus; attempt: number }`, initial `{ status: 'connecting', attempt: 0 }` → `connectionStatusChanged({ status, attempt })`.
  - `selection`: `{ symbol: string; interval: Interval }`, initial `{ symbol: 'BTCUSDT', interval: '1m' }` → `pairSelected(symbol)`, `intervalChanged(interval)`.
  - `candles`: `{ symbol: string; interval: Interval; status: 'idle' | 'loading' | 'ready' | 'unavailable'; candles: Candle[] }` → `candlesLoading({ symbol, interval })` (sets symbol/interval, status loading, clears candles), `candlesLoaded({ symbol, interval, candles })` (ignored unless symbol+interval match current), `candlesUnavailable({ symbol, interval })` (same guard), `candleReceived({ symbol, interval, candle })` (same guard; merge: last.time === candle.time → replace; candle.time > last.time → push; else ignore; applies in `ready` and `unavailable`, not `loading`).
  - `toasts`: `{ items: Toast[] }` → `toastPushed(toast)`, `toastDismissed(id)`.
  - `app`: `{ externalChange: boolean }` → `externalChangeDetected()`.
- Each slice file exports `<name>Reducer` (default export) and its actions; type `<Name>State`.

- [ ] **Step 1: Write failing tests** (one `describe` per slice, reducer-level):

```ts
it('upserts tickers by symbol', () => { const s = tickersReducer({}, tickersUpdated([t('BTCUSDT', 1), t('BTCUSDT', 2)])); expect(s.BTCUSDT.last).toBe(2); });
it('ignores candlesLoaded for another symbol', () => { let s = candlesReducer(undefined, candlesLoading({ symbol: 'ETHUSDT', interval: '1m' })); s = candlesReducer(s, candlesLoaded({ symbol: 'BTCUSDT', interval: '1m', candles: [c(1)] })); expect(s.status).toBe('loading'); expect(s.candles).toEqual([]); });
it('replaces the last candle when time matches and appends when newer', () => { /* ready with [c(1)] → candleReceived c(1,close 9) replaces; c(2) appends; c(0) ignored */ });
it('does not merge live candles while loading', () => { /* status loading + candleReceived → candles still [] */ });
it('dismisses a toast by id', () => { /* push a, push b, dismiss a → [b] */ });
it('maps pairSelected and intervalChanged', () => { /* trivial */ });
it('stores connection status', () => { /* trivial */ });
```
Fixtures `t(symbol, last)` and `c(time, close?)` go in `src/test/fixtures.ts` (also export `order(partial)`, `alert(partial)`, `fill(partial)` builders with sensible defaults for later tasks).

- [ ] **Step 2: Run** `npm test -- src/features src/app` — Expected: FAIL.
- [ ] **Step 3: Implement** the slices with `createSlice`; `candles`/`toasts`/`app` use `extraReducers` for nothing yet.
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** `feat: tickers, connection, selection, candles, toasts and app slices`.

---

### Task 5: Portfolio slice and selectors

**Files:**
- Create: `src/features/portfolio/portfolioSlice.ts`, `src/features/portfolio/selectors.ts`
- Test: `portfolioSlice.test.ts`, `selectors.test.ts`

**Interfaces:**
- Consumes: `domain/actions` (`orderPlaced`, `orderCancelled`, `orderFilled`, `portfolioReset`), `money.ts`.
- Produces:

```ts
export interface PortfolioState { quoteBalance: number; reservedQuote: number; positions: Record<string, Position>; trades: Trade[]; realizedPnl: number }
export const INITIAL_QUOTE = 10_000; export const MAX_TRADES = 500;
// reducer handles, via extraReducers only (no own actions):
//  orderPlaced: buy → reservedQuote += mul(price, qty); sell → positions[base].reservedQuantity += qty
//  orderCancelled: the reverse of orderPlaced
//  orderFilled: type 'limit' releases the reservation first; then buy → quoteBalance -= total, position avg-cost merge;
//               sell → quoteBalance += total, realized = mul(sub(price, avgPrice), qty), quantity -= qty, delete position when isZero(quantity);
//               trades.unshift({...fill, total, realizedPnl}), capped at MAX_TRADES; realizedPnl += realized
//  portfolioReset: initial state
// selectors.ts (RootState-based, memoized with createSelector where derived):
export const selectPortfolio, selectQuoteBalance, selectAvailableQuote /* quoteBalance - reservedQuote */, selectAvailableBase(asset) /* quantity - reservedQuantity, 0 if none */,
  selectPositionRows /* PositionRow[] sorted by value desc */, selectEquity /* quoteBalance + Σ quantity*last */, selectRealizedPnl, selectTrades;
export interface PositionRow { asset: string; symbol: string; quantity: number; avgPrice: number; lastPrice?: number; value: number; unrealizedPnl: number; unrealizedPct: number }
```
`base` for a symbol comes from `findPair(symbol)!.base`. Selectors import `RootState` type from `src/app/store` (type-only import, no cycle at runtime); Task 8 creates that file — until then, declare the selectors against a local `{ portfolio: PortfolioState; tickers: Record<string, Ticker> }` type and switch to `RootState` in Task 8.

- [ ] **Step 1: Write failing tests**

```ts
it('market buy moves quote into a position at average cost', () => { let s = reduce(orderFilled(fill({ side: 'buy', type: 'market', quantity: 0.01, price: 60000 }))); s = reduce(orderFilled(fill({ side: 'buy', type: 'market', quantity: 0.01, price: 70000 })), s); expect(s.quoteBalance).toBe(8700); expect(s.positions.BTC).toMatchObject({ quantity: 0.02, avgPrice: 65000 }); });
it('removes position when fully sold and books realized pnl', () => { /* buy 0.02 @ 65000 then sell 0.02 @ 66000 → positions.BTC undefined, quoteBalance 10020, realizedPnl 20, trades[0].realizedPnl 20 */ });
it('reserves quote on limit buy and releases on cancel', () => { /* orderPlaced buy 0.1 @ 50000 → reservedQuote 5000; orderCancelled → 0 */ });
it('fill releases exactly the reserved quote', () => { /* orderPlaced buy 0.00012345 @ 81000.5 → reservedQuote = mul(...); orderFilled same limit → reservedQuote 0, quoteBalance = 10000 - total */ });
it('reserves base on limit sell', () => { /* position 0.5 ETH, orderPlaced sell 0.2 → reservedQuantity 0.2; selectAvailableBase('ETH') = 0.3 */ });
it('caps trade history at 500', () => { /* 501 fills → trades.length 500, newest first */ });
it('resets to initial state', () => { /* portfolioReset → INITIAL */ });
// selectors.test.ts
it('computes position rows and equity from tickers', () => { /* BTC 0.02 @ 65000, ticker last 66000 → value 1320, unrealizedPnl 20, unrealizedPct ≈ 1.538; equity = quote + 1320 */ });
```

- [ ] **Step 2: Run** `npm test -- src/features/portfolio` — Expected: FAIL.
- [ ] **Step 3: Implement** reducer and selectors as specified.
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** `feat: portfolio slice with reservations, average cost and selectors`.

---

### Task 6: Orders slice and order validation

**Files:**
- Create: `src/features/orders/ordersSlice.ts`, `src/features/orders/validation.ts`
- Test: `ordersSlice.test.ts`, `validation.test.ts`

**Interfaces:**
- Produces:

```ts
export interface OrdersState { items: Order[] }
// reducer: orderPlaced → push; orderCancelled → remove by id; orderFilled → remove by fill.orderId when present; portfolioReset → []
export const selectOpenOrders = (s: { orders: OrdersState }) => s.orders.items;
// validation.ts
export interface OrderContext { pair: Pair; lastPrice?: number; connectionStatus: ConnectionStatus; availableQuote: number; availableBase: number }
export interface OrderError { field: 'quantity' | 'price' | 'connection' | 'funds'; message: string }
export function orderCost(req: OrderRequest, lastPrice: number): number; // mul(quantity, price ?? lastPrice)
export function validateOrder(req: OrderRequest, ctx: OrderContext): OrderError | null;
```
Rules, in this order, first failure wins (exact copy):
1. `quantity` not finite or ≤ 0 → `{ field: 'quantity', message: 'Enter a quantity greater than zero' }`
2. `type === 'market' && connectionStatus !== 'live'` → `{ field: 'connection', message: 'Market orders need a live connection' }`
3. `lastPrice === undefined` → `{ field: 'price', message: 'No price for this pair yet' }`
4. `type === 'limit'` and `price` not finite or ≤ 0 → `{ field: 'price', message: 'Enter a limit price greater than zero' }`
5. `type === 'limit' && side === 'buy' && price >= lastPrice` → `{ field: 'price', message: 'Buy limit must be below the current price' }`; sell and `price <= lastPrice` → `'Sell limit must be above the current price'`
6. buy and `orderCost > availableQuote` → `{ field: 'funds', message: 'Insufficient USDT' }`; sell and `quantity > availableBase` → `{ field: 'funds', message: \`Insufficient ${pair.base}\` }`

- [ ] **Step 1: Write failing tests** — one `it` per rule above with a passing baseline context (`lastPrice: 100, connectionStatus: 'live', availableQuote: 1000, availableBase: 5`), plus `returns null for a valid market buy` and `returns null for a valid limit sell above market`; slice tests: `removes an order when its fill arrives`, `clears on portfolioReset`.
- [ ] **Step 2: Run** `npm test -- src/features/orders` — Expected: FAIL.
- [ ] **Step 3: Implement**.
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** `feat: orders slice and order validation rules`.

---

### Task 7: Alerts slice and alert validation

**Files:**
- Create: `src/features/alerts/alertsSlice.ts`, `src/features/alerts/validation.ts`
- Test: `alertsSlice.test.ts`, `validation.test.ts`

**Interfaces:**
- Produces:

```ts
export interface AlertsState { items: Alert[] }
// actions: alertRequested(req: AlertRequest), alertCreated(alert: Alert), alertDeleted(id: string),
//          alertTriggered({ id: string; price: number; at: number }), alertRejected({ request: AlertRequest; reason: string })
// reducer: created → push; deleted → remove; triggered → set triggeredAt/triggeredPrice; portfolioReset → []; alertRequested/alertRejected → no state change
export const selectAlerts, selectActiveAlerts /* without triggeredAt */, selectAlertById(id);
// validation.ts
export function alertHit(alert: Pick<Alert, 'direction' | 'price'>, last: number): boolean; // above: last >= price; below: last <= price
export function validateAlert(req: AlertRequest, pair: Pair, lastPrice?: number): string | null;
```
Messages: price not finite or ≤ 0 → `'Enter a price greater than zero'`; `lastPrice === undefined` → `'No price for this pair yet'`; `alertHit(req, lastPrice)` → `'Price is already above X'` / `'Price is already below X'` where X is `formatPrice(req.price, pair.pricePrecision)`.

- [ ] **Step 1: Write failing tests** — `alertHit` four cases (above hit/miss, below hit/miss, equality counts as hit); `validateAlert` three messages and a null case; slice: `marks alert triggered`, `clears on portfolioReset`.
- [ ] **Step 2: Run** — Expected: FAIL. **Step 3: Implement.** **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat: alerts slice and alert validation`.

---

### Task 8: Store, persistence boundary, typed hooks, test harness

**Files:**
- Create: `src/app/store.ts`, `src/app/rootSaga.ts` (placeholder that only `put`s `appStarted`), `src/app/hooks.ts`, `src/app/persistence.ts`, `src/features/market/selectors.ts`, `src/test/renderWithStore.tsx`
- Modify: `src/features/portfolio/selectors.ts` (switch to `RootState`), `src/main.tsx`
- Test: `src/app/persistence.test.ts`, `src/app/store.test.ts`

**Interfaces:**
- Produces:

```ts
// store.ts
export const rootReducer = combineReducers({ tickers, connection, selection, candles, portfolio, orders, alerts, toasts, app });
export type RootState = ReturnType<typeof rootReducer>;
export interface SagaDeps { client: SocketClient; fetchKlines: typeof fetchKlines; storage: Storage; now: () => number; newId: () => string; wsHosts: readonly string[] }
export function createAppStore(opts: { preloadedState?: Partial<RootState>; deps: SagaDeps; runSaga?: boolean /* default true */ }): { store: AppStore; sagaTask?: Task };
export type AppStore = EnhancedStore<RootState>; export type AppDispatch = AppStore['dispatch'];
// hooks.ts: useAppDispatch, useAppSelector (withTypes)
// features/market/selectors.ts
export const selectTicker = (symbol: string) => (s: RootState) => s.tickers[symbol] as Ticker | undefined;
export const selectTickers = (s: RootState) => s.tickers; export const selectConnection = (s: RootState) => s.connection; export const selectSelection = (s: RootState) => s.selection;
export const selectFilteredPairs = (query: string) => (): Pair[] => /* pairs whose base or symbol contains query, case-insensitive, WATCHED_PAIRS order */
// persistence.ts
export const STORAGE_KEY = 'crypto-terminal:v1'; export const SCHEMA_VERSION = 1;
export interface PersistedState { version: 1; portfolio: PortfolioState; orders: OrdersState; alerts: AlertsState; selection: SelectionState }
export function pickPersisted(state: RootState): PersistedState;
export function loadPersistedState(storage: Storage): Partial<RootState> | undefined; // undefined on missing key, JSON error, or version !== SCHEMA_VERSION
export function savePersistedState(storage: Storage, state: RootState): void;
// test/renderWithStore.tsx
export function renderWithStore(ui: ReactElement, opts?: { preloadedState?: Partial<RootState> }): RenderResult & { store: AppStore; client: ReturnType<typeof createFakeSocketClient> }; // runSaga: false
```
`main.tsx` builds `deps` (`createSocketClient()`, `fetchKlines`, `localStorage`, `Date.now`, `() => crypto.randomUUID()`, `WS_HOSTS`), calls `createAppStore({ preloadedState: loadPersistedState(localStorage), deps })`, renders `<Provider store={store}><App /></Provider>`. The serializable-check middleware stays on; `SagaDeps` never enter actions.

- [ ] **Step 1: Write failing tests**

```ts
it('round-trips persisted slices', () => { const storage = fakeStorage(); const state = rootReducer(undefined, { type: 'init' }); savePersistedState(storage, state); expect(loadPersistedState(storage)).toEqual({ portfolio: state.portfolio, orders: state.orders, alerts: state.alerts, selection: state.selection }); });
it('returns undefined for garbage and for another version', () => { storage.setItem(STORAGE_KEY, '{nope'); expect(loadPersistedState(storage)).toBeUndefined(); storage.setItem(STORAGE_KEY, JSON.stringify({ version: 0 })); expect(loadPersistedState(storage)).toBeUndefined(); });
it('creates a store with preloaded state and no saga', () => { const { store, sagaTask } = createAppStore({ preloadedState: { selection: { symbol: 'ETHUSDT', interval: '1h' } }, deps: fakeDeps(), runSaga: false }); expect(store.getState().selection.symbol).toBe('ETHUSDT'); expect(sagaTask).toBeUndefined(); });
```
`fakeStorage()` and `fakeDeps()` go in `src/test/fixtures.ts`.

- [ ] **Step 2: Run** `npm test -- src/app` — Expected: FAIL.
- [ ] **Step 3: Implement**; update `portfolio/selectors.ts` to `RootState`; update `App.test.tsx` to use `renderWithStore`.
- [ ] **Step 4: Run** `npm run check` — Expected: PASS.
- [ ] **Step 5: Commit** `feat: store, persistence boundary and test harness`.

---

> **Group S (Tasks 9–16) and Group U (Tasks 17–22) may now run in parallel.**

### Task 9: Market stream saga

**Files:**
- Create: `src/features/market/marketStreamSaga.ts`
- Test: `marketStreamSaga.test.ts`

**Interfaces:**
- Consumes: `SocketClient`, `SocketEvent`, `pickHost`, `tickersUpdated`, `connectionStatusChanged`, `candleReceived`, `miniTickerStream`, `WATCHED_PAIRS`.
- Produces:

```ts
export const BATCH_MS = 250, SILENCE_MS = 30_000, MAX_BACKOFF_MS = 30_000, OFFLINE_AFTER_ATTEMPTS = 5, CHANNEL_BUFFER = 2000;
export const streamStopped = createAction('market/streamStopped');
export function backoffMs(attempt: number): number; // min(1000 * 2^(attempt-1), 30000): 1→1000, 2→2000, 6→30000
export function createSocketChannel(client: SocketClient): EventChannel<SocketEvent>; // buffers.sliding(CHANNEL_BUFFER); unsubscribe = client.listen(...)
export interface StreamOptions { batchMs: number; silenceMs: number; backoff: (attempt: number) => number; now: () => number }
export type StreamOutcome = { outcome: 'closed' | 'silent' | 'stopped'; opened: boolean }; // opened: an 'open' event was seen during this connection
export function* consumeStream(channel: EventChannel<SocketEvent>, opts: StreamOptions): SagaIterator<StreamOutcome>;
export function* marketStreamSaga(deps: Pick<SagaDeps, 'client' | 'wsHosts' | 'now'>, opts?: Partial<StreamOptions>): SagaIterator;
```
Behaviour: `marketStreamSaga` subscribes `WATCHED_PAIRS.map(p => miniTickerStream(p.symbol))` once, then loops: `put(connectionStatusChanged({ status: attempt === 0 ? 'connecting' : attempt >= OFFLINE_AFTER_ATTEMPTS ? 'offline' : 'reconnecting', attempt }))`, `client.open(pickHost(hosts, attempt))`, `consumeStream`; on `'stopped'` close channel and client and return; otherwise `attempt += 1`, `delay(opts.backoff(attempt))`. `consumeStream` loop: `race({ tick: delay(batchMs), stop: take(streamStopped.type) })`; `flush(channel)`; for each event: `open` → `put(connectionStatusChanged({ status: 'live', attempt: 0 }))` and reset `lastMessageAt`; `message` ticker → keep the latest per symbol; `message` candle → `put(candleReceived(...))`; `close`/`error` → return `'closed'`; after the loop body `put(tickersUpdated([...batch]))` if non-empty; return `'silent'` when `now() - lastMessageAt > silenceMs`. In `marketStreamSaga` the `attempt` counter resets to 0 before incrementing when the returned `opened` is true, so a connection that worked and then dropped starts again from attempt 1.

- [ ] **Step 1: Write failing tests** (`expectSaga` with `createFakeSocketClient()`, `opts = { batchMs: 5, silenceMs: 40, backoff: () => 1, now: Date.now }`):

```ts
it('goes live and batches tickers, keeping the latest per symbol', async () => { /* schedule: emit open; emit ticker BTC 1; emit ticker BTC 2; emit ticker ETH 3 → expect put(connectionStatusChanged live) and put(tickersUpdated([BTC last 2, ETH last 3])); run(100) */ });
it('reconnects after close with incremented attempt', async () => { /* emit open then close(1006) → puts connecting(0), live, reconnecting(1); client.openedHosts length ≥ 2 */ });
it('reaches offline after five failed attempts', async () => { /* never emit open; emit close immediately on each open (hook fake client) → expect put(connectionStatusChanged({status:'offline', attempt:5})) */ });
it('treats silence as a dead connection', async () => { /* emit open, nothing else, silenceMs 40 → reconnecting(1) within run(200) */ });
it('forwards candles immediately', async () => { /* emit candle event → put(candleReceived(...)) */ });
it('stops on streamStopped and closes the client', async () => { /* dispatch(streamStopped()) → saga returns; client.closeCount 1 */ });
it('backoffMs doubles to a 30 s cap', () => expect([1, 2, 3, 6].map(backoffMs)).toEqual([1000, 2000, 4000, 30000]));
```

- [ ] **Step 2: Run** `npm test -- marketStreamSaga` — Expected: FAIL.
- [ ] **Step 3: Implement** as specified. Use `try/finally` with `cancelled()` in `marketStreamSaga` to close the channel and client when the root saga is cancelled.
- [ ] **Step 4: Run** — Expected: PASS (use `.run({ timeout })` / `.silentRun()` to avoid timeout warnings).
- [ ] **Step 5: Commit** `feat: market stream saga with batching, silence detection and backoff reconnect`.

---

### Task 10: Chart saga

**Files:**
- Create: `src/features/chart/chartSaga.ts`
- Test: `chartSaga.test.ts`

**Interfaces:**
- Consumes: `SocketClient.subscribe/unsubscribe/streams`, `fetchKlines`, `klineStream`, `isKlineStream`, `candlesLoading/Loaded/Unavailable`, `pairSelected`, `intervalChanged`, `appStarted`, `connectionStatusChanged`, selector `selectSelection`.
- Produces:

```ts
export const HISTORY_LIMIT = 300;
export const chartTriggers = (a: Action) => pairSelected.match(a) || intervalChanged.match(a) || appStarted.match(a) || (connectionStatusChanged.match(a) && a.payload.status === 'live');
export function* loadChart(deps: Pick<SagaDeps, 'client' | 'fetchKlines'>): SagaIterator;
export function* chartSaga(deps: Pick<SagaDeps, 'client' | 'fetchKlines'>): SagaIterator; // takeLatest(chartTriggers, loadChart, deps)
```
`loadChart`: `select(selectSelection)` → stream = `klineStream(symbol, interval)`; unsubscribe every held stream for which `isKlineStream` and `!== stream`; subscribe `[stream]`; `put(candlesLoading)`; `try { candles = call(fetchKlines, symbol, interval, HISTORY_LIMIT); put(candlesLoaded) } catch { put(candlesUnavailable) } finally { if (yield cancelled()) { /* superseded: the newer run owns the streams */ } }`.

- [ ] **Step 1: Write failing tests**

```ts
it('subscribes the kline stream, unsubscribes the old one and loads history', async () => { /* client holds 'ethusdt@kline_1m' + 'btcusdt@miniTicker'; selection BTCUSDT/1m; fetchKlines resolves [c(1)] → client.streams has 'btcusdt@kline_1m', not 'ethusdt@kline_1m', still 'btcusdt@miniTicker'; puts candlesLoading then candlesLoaded */ });
it('marks history unavailable when fetch fails', async () => { /* fetchKlines rejects → put(candlesUnavailable) and stream still subscribed */ });
it('takeLatest cancels the previous load', async () => { /* fetchKlines returns a never-resolving promise for ETH, resolves for BTC; dispatch pairSelected('ETHUSDT') then pairSelected('BTCUSDT') → candlesLoaded only for BTCUSDT */ });
it('reloads when the connection comes back live', async () => { /* dispatch connectionStatusChanged live → fetchKlines called */ });
```
Use `expectSaga(chartSaga, deps).withReducer(rootReducer, state).dispatch(...)`.

- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat: chart saga with takeLatest history load and kline subscription`.

---

### Task 11: Trade saga (market fills and limit placement)

**Files:**
- Create: `src/features/orders/tradeSaga.ts`
- Test: `tradeSaga.test.ts`

**Interfaces:**
- Consumes: `validateOrder`, `orderCost`, `findPair`, `selectTicker(symbol)`, `selectConnection` (Task 8), `selectAvailableQuote`, `selectAvailableBase` (Task 5).
- Produces:

```ts
export function* handleOrderRequest(deps: Pick<SagaDeps, 'now' | 'newId'>, action: PayloadAction<OrderRequest>): SagaIterator;
export function* tradeSaga(deps: Pick<SagaDeps, 'now' | 'newId'>): SagaIterator; // takeEvery(orderRequested.type, handleOrderRequest, deps)
```
`handleOrderRequest`: build `OrderContext` from selects; `error = validateOrder(req, ctx)`; error → `put(orderRejected({ request: req, reason: error.message }))`; market → `put(orderFilled({ id: newId(), symbol, side, type: 'market', quantity, price: lastPrice, executedAt: now() }))`; limit → `put(orderPlaced({ id: newId(), symbol, side, price: req.price!, quantity, createdAt: now() }))`.

- [ ] **Step 1: Write failing tests** (`expectSaga(tradeSaga, deps).withReducer(rootReducer, state).dispatch(orderRequested(...))`):

```ts
it('fills a market buy at the last price', async () => { /* ticker BTC last 100, live → put(orderFilled({ …price: 100, type: 'market' })); resulting state quoteBalance 9990 for qty 0.1 */ });
it('rejects market order while not live', async () => { /* connection reconnecting → put(orderRejected({ reason: 'Market orders need a live connection' })) and no orderFilled */ });
it('places a limit buy below market and reserves quote', async () => { /* limit buy 0.1 @ 90 → put(orderPlaced), state.orders.items length 1, reservedQuote 9 */ });
it('rejects a limit buy above market', async () => { /* reason 'Buy limit must be below the current price' */ });
```

- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat: trade saga validates and executes market and limit requests`.

---

### Task 12: Order watcher saga

**Files:**
- Create: `src/features/orders/orderWatcherSaga.ts`
- Test: `orderWatcherSaga.test.ts`

**Interfaces:**
- Consumes: `tickersUpdated`, `orderPlaced`, `orderCancelled`, `orderFilled`, `portfolioReset`, `selectOpenOrders`.
- Produces:

```ts
export function crosses(order: Pick<Order, 'side' | 'price'>, last: number): boolean; // buy: last <= price; sell: last >= price
export function* waitForCross(order: Order): SagaIterator<{ at: number }>; // take(tickersUpdated) loop until crosses
export function* watchOrder(deps: Pick<SagaDeps, 'newId'>, order: Order): SagaIterator;
export function* orderWatcherSaga(deps: Pick<SagaDeps, 'newId'>): SagaIterator; // fork watchOrder for each selectOpenOrders at start, then takeEvery(orderPlaced, (a) => fork(watchOrder, deps, a.payload))
```
`watchOrder`: `race({ fill: call(waitForCross, order), cancel: take(a => orderCancelled.match(a) && a.payload.id === order.id), reset: take(portfolioReset.type) })`; on `fill` → `put(orderFilled({ id: newId(), orderId: order.id, symbol, side, type: 'limit', quantity, price: order.price, executedAt: fill.at }))`.

- [ ] **Step 1: Write failing tests**

```ts
it('fills a buy limit when price falls to the limit', async () => { /* orderPlaced buy @ 90; tickersUpdated [BTC 95] → nothing; [BTC 90] → put(orderFilled({ orderId, price: 90, type: 'limit' })) */ });
it('does not fill after cancellation', async () => { /* orderPlaced; orderCancelled(order); tickersUpdated [BTC 10] → not.put.actionType(orderFilled.type) */ });
it('re-spawns watchers for restored orders on start', async () => { /* initial state orders.items [sell @ 110]; tickersUpdated [BTC 110] → orderFilled */ });
it('stops all watchers on portfolioReset', async () => { /* orderPlaced; portfolioReset; tick crossing → no fill */ });
it('crosses uses inclusive comparison', () => { expect(crosses({ side: 'buy', price: 90 }, 90)).toBe(true); expect(crosses({ side: 'sell', price: 110 }, 109.99)).toBe(false); });
```

- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat: per-order watcher saga with fill/cancel race`.

---

### Task 13: Alert saga

**Files:**
- Create: `src/features/alerts/alertSaga.ts`
- Test: `alertSaga.test.ts`

**Interfaces:**
- Consumes: `validateAlert`, `alertHit`, alerts actions, `selectActiveAlerts`, `selectTicker`, `tickersUpdated`, `portfolioReset`.
- Produces:

```ts
export function* handleAlertRequest(deps: Pick<SagaDeps, 'now' | 'newId'>, action: PayloadAction<AlertRequest>): SagaIterator; // validate → alertRejected | alertCreated
export function* waitForAlert(alert: Alert): SagaIterator<{ price: number; at: number }>;
export function* watchAlert(alert: Alert): SagaIterator; // race(hit vs alertDeleted(id) vs portfolioReset) → put(alertTriggered({ id, price, at }))
export function* alertSaga(deps: Pick<SagaDeps, 'now' | 'newId'>): SagaIterator; // fork watchers for selectActiveAlerts; takeEvery(alertRequested, handleAlertRequest, deps); takeEvery(alertCreated, a => fork(watchAlert, a.payload))
```

- [ ] **Step 1: Write failing tests** — `creates an alert when its condition is not yet true`; `rejects an alert whose condition is already true` (reason `'Price is already above 100.00'`); `triggers once when the level is reached`; `does not trigger after deletion`; `restored alert fires on first live tick past the level`.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat: alert saga with validation and per-alert watchers`.

---

### Task 14: Notifications (toast timer + triggers)

**Files:**
- Create: `src/features/notifications/toastSaga.ts`, `src/features/notifications/notificationsSaga.ts`
- Test: `toastSaga.test.ts`, `notificationsSaga.test.ts`

**Interfaces:**
- Produces:

```ts
export const TOAST_MS = 6000;
export function* autoDismiss(opts: { toastMs: number }, action: PayloadAction<Toast>): SagaIterator; // race(delay vs toastDismissed(id)); on timeout put(toastDismissed(id))
export function* toastSaga(opts?: { toastMs: number }): SagaIterator; // takeEvery(toastPushed, autoDismiss, opts)
export function toastForFill(fill: Fill, pair: Pair): Omit<Toast, 'id'>;        // kind 'success', title `Bought 0.01000 BTC @ 67,412.50` / `Sold …`, message 'Limit order filled' | 'Market order'
export function toastForAlert(alert: Alert, price: number, pair: Pair): Omit<Toast, 'id'>; // kind 'warning', title `BTC/USDT is above 70,000.00`, message `Now 70,012.10`
export function toastForRejection(reason: string): Omit<Toast, 'id'>;          // kind 'error', title 'Order rejected', message reason
export function* notificationsSaga(deps: Pick<SagaDeps, 'newId'>): SagaIterator; // takeEvery([orderFilled, alertTriggered, orderRejected, alertRejected]) → put(toastPushed({ id: newId(), ...}))
```

- [ ] **Step 1: Write failing tests** — `dismisses after the timeout` (toastMs 5); `does not dismiss twice when closed manually`; `pushes a success toast on orderFilled`; `pushes a warning toast on alertTriggered with the alert looked up by id`; `pushes an error toast on orderRejected`.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat: toast auto-dismiss and notification triggers`.

---

### Task 15: Persistence saga and external-change detection

**Files:**
- Create: `src/app/persistenceSaga.ts`
- Test: `persistenceSaga.test.ts`

**Interfaces:**
- Produces:

```ts
export const PERSIST_DEBOUNCE_MS = 500;
export const PERSISTED_ACTIONS: string[] = [orderPlaced, orderCancelled, orderFilled, alertCreated, alertDeleted, alertTriggered, pairSelected, intervalChanged, portfolioReset].map(a => a.type);
export function* persist(deps: Pick<SagaDeps, 'storage'>): SagaIterator; // if select(selectExternalChange) → return; else call(savePersistedState, storage, select(state))
export function createStorageChannel(target: Pick<Window, 'addEventListener' | 'removeEventListener'>): EventChannel<StorageEvent>;
export function* watchExternalChanges(target): SagaIterator; // take channel; if event.key === STORAGE_KEY → put(externalChangeDetected()) and return
export function* persistenceSaga(deps: Pick<SagaDeps, 'storage'>, opts?: { debounceMs?: number; target?: Window }): SagaIterator; // fork(watchExternalChanges), debounce(debounceMs, PERSISTED_ACTIONS, persist, deps)
```

- [ ] **Step 1: Write failing tests** — `writes once after a burst of actions` (debounceMs 5, three `orderPlaced` → storage has key once, with the orders); `stops persisting after an external change` (dispatch `externalChangeDetected` then `orderPlaced` → storage unchanged); `detects a storage event for our key` (fake target fires `StorageEvent` with key → `put(externalChangeDetected())`), `ignores other keys`.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat: debounced persistence saga with cross-tab change detection`.

---

### Task 16: Root saga and boot wiring

**Files:**
- Modify: `src/app/rootSaga.ts`
- Test: `src/app/rootSaga.test.ts`

**Interfaces:**
- Produces: `export function* rootSaga(deps: SagaDeps): SagaIterator` — `all([fork(marketStreamSaga, deps), fork(chartSaga, deps), fork(tradeSaga, deps), fork(orderWatcherSaga, deps), fork(alertSaga, deps), fork(toastSaga), fork(notificationsSaga, deps), fork(persistenceSaga, deps)])` then `put(appStarted())`.

- [ ] **Step 1: Write failing test** — `boots: subscribes tickers, dispatches appStarted and loads the chart` using `createAppStore({ deps: fakeDeps() })`: after `await` a tick, `deps.client.streams` contains `btcusdt@miniTicker` and `btcusdt@kline_1m`, `fetchKlines` mock called once with `('BTCUSDT', '1m', 300)`, state `candles.status` is `'ready'`.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** `npm run check` — PASS.
- [ ] **Step 5: Commit** `feat: root saga wiring`.

---

### Task 17: Theme, UI primitives, layout shell

**Files:**
- Create: `src/ui/Button.tsx`, `Input.tsx`, `Panel.tsx`, `Tabs.tsx`, `Segmented.tsx`, `src/app/components/BottomPanel.tsx`
- Modify: `src/index.css`, `src/App.tsx`
- Test: `src/ui/Tabs.test.tsx`, `src/App.test.tsx`

**Interfaces:**
- Produces: `@theme` tokens in `index.css`: `--color-bg`, `--color-panel`, `--color-panel-2`, `--color-line`, `--color-text`, `--color-muted`, `--color-accent`, `--color-up`, `--color-down`; `--font-sans`, `--font-mono`. Utilities `tabular` (tabular-nums) and `flash-up` / `flash-down` keyframes (600 ms background fade).
- `Button` props: `variant?: 'primary' | 'ghost' | 'buy' | 'sell'`, `size?: 'sm' | 'md'`, native button props. `Input` props: `label?`, `suffix?` (e.g. `USDT`), `error?: string`, native input props; renders `role="alert"` for the error. `Panel` props: `title?`, `right?: ReactNode`, `children`. `Tabs` props: `tabs: { id: string; label: string; badge?: number }[]`, `active: string`, `onChange(id)`. `Segmented` props: `options: { value: string; label: string }[]`, `value`, `onChange`.
- `App` layout: `xl:grid-cols-[280px_1fr_320px]` with rows `[1fr_240px]`, stacked below `xl`; placeholder slots for Market / Chart / Trade / Bottom. `BottomPanel` holds `Tabs` with ids `positions | orders | history | alerts` and renders the active child (children supplied by Task 21).
- Apply the frontend-design skill when choosing the exact palette and fonts (spec §6): near-black bg, hairline borders, one accent, green/red only for movement.

- [ ] **Step 1: Write failing tests** — `Tabs calls onChange with the clicked id and marks the active tab with aria-selected`; `App renders the four regions` (by `aria-label`: `Market`, `Chart`, `Trade`, `Portfolio`).
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat: theme tokens, UI primitives and layout shell`.

---

### Task 18: Market list, filter, connection status

**Files:**
- Create: `src/features/market/usePriceFlash.ts`, `components/MarketList.tsx`, `MarketRow.tsx`, `MarketFilter.tsx`, `ConnectionStatus.tsx`
- Test: `MarketList.test.tsx`, `MarketRow.test.tsx`, `ConnectionStatus.test.tsx`

**Interfaces:**
- Consumes: `selectTicker`, `selectConnection`, `selectSelection`, `selectFilteredPairs` (Task 8), `pairSelected`.
- `usePriceFlash(last: number | undefined): 'up' | 'down' | null` — compares with the previous value, returns the direction for 600 ms.
- `MarketRow` props `{ symbol: string }`; subscribes to its own ticker with `useAppSelector(selectTicker(symbol))`, memoized with `React.memo`; shows `BTC/USDT`, `formatPrice(last, pricePrecision)`, `formatPct(changePct)` coloured up/down, `formatCompact(volume)`; dims (`opacity-50`) when connection is not `live`; `aria-selected` when selected; click → `pairSelected(symbol)`.
- `MarketFilter` local state → `MarketList` prop `query`. `ConnectionStatus` renders `Live` / `Reconnecting (attempt N)` / `Offline` / `Connecting` with a coloured dot.

- [ ] **Step 1: Write failing tests** — `filters pairs by typed text` (type `eth` → only ETH row); `clicking a row dispatches pairSelected`; `row shows price with pair precision and signed change`; `rows are dimmed when reconnecting`; `status shows attempt number`.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat: market list with filter, price flash and connection status`.

---

### Task 19: Chart panel

**Files:**
- Create: `src/features/chart/components/ChartPanel.tsx`, `CandleChart.tsx`, `IntervalPicker.tsx`
- Test: `ChartPanel.test.tsx`

**Interfaces:**
- `CandleChart` props `{ candles: Candle[]; status: CandlesState['status'] }`; uses lightweight-charts v5 (`createChart`, `chart.addSeries(CandlestickSeries, { upColor, downColor, … })`), `series.setData` when the array identity changes and length differs or first candle time differs, otherwise `series.update(last)`; `ResizeObserver` for width; dark `layout.background`/`textColor` from theme tokens. Mock `lightweight-charts` in tests (`vi.mock`) with `createChart` returning `{ addSeries: () => ({ setData, update }), applyOptions, remove, timeScale: () => ({ fitContent }) }`.
- `ChartPanel`: header `BTC/USDT  67,412.50  +1.84%` from the selected ticker, `IntervalPicker` (`Segmented` over `INTERVALS`, dispatches `intervalChanged`), `History unavailable — showing live candles` note when status is `unavailable`, `Loading…` when `loading`.

- [ ] **Step 1: Write failing tests** — `shows selected pair header with price and change`; `interval buttons dispatch intervalChanged`; `shows unavailable note`; `calls setData with candles on mount` (via the mock).
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat: candlestick chart panel with interval picker`.

---

### Task 20: Trade form

**Files:**
- Create: `src/features/orders/components/TradeForm.tsx`
- Test: `TradeForm.test.tsx`

**Interfaces:**
- Local state: `side` (`Segmented` buy/sell), `type` (`Segmented` market/limit), `quantity: string`, `price: string`. Derived: `OrderContext` from selectors (Task 11), `error = validateOrder(request, ctx)` recomputed on every render; submit button disabled when `error` (shown inline under the relevant field, connection errors above the button), label `Buy BTC` / `Sell BTC`, variant buy/sell. Percent buttons `25 50 75 100` set quantity to `roundTo(availableQuote * pct / price, qtyPrecision)` for buys or `roundTo(availableBase * pct, qtyPrecision)` for sells. Shows `Cost` / `Proceeds` = `formatUsd(orderCost)` and `Available: 8,765.00 USDT` / `0.01500 BTC`. Submit → `dispatch(orderRequested(request))`, then clears quantity. Limit price input is prefilled with the last price when switching to limit.

- [ ] **Step 1: Write failing tests** (`renderWithStore` with ticker BTC 100, live) — `submit is disabled with an empty quantity`; `shows "Insufficient USDT" when cost exceeds available`; `percent buttons fill the quantity`; `dispatches orderRequested for a market buy`; `shows connection message and disables submit when reconnecting`; `shows "Buy limit must be below the current price"`.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat: trade form with live validation and percent buttons`.

---

### Task 21: Bottom panel tables and alerts UI

**Files:**
- Create: `src/features/portfolio/components/PositionsTable.tsx`, `TradeHistory.tsx`, `src/features/orders/components/OpenOrdersTable.tsx`, `src/features/alerts/components/AlertsPanel.tsx`, `AlertForm.tsx`
- Modify: `src/app/components/BottomPanel.tsx` (wire the four tabs; badge = open orders count / active alerts count)
- Test: `PositionsTable.test.tsx`, `OpenOrdersTable.test.tsx`, `TradeHistory.test.tsx`, `AlertsPanel.test.tsx`

**Interfaces:**
- `PositionsTable`: rows from `selectPositionRows`; columns Asset, Qty, Avg price, Last, Value, P&L (`+7.69 (+0.77%)` coloured); empty state `No positions yet`.
- `OpenOrdersTable`: `selectOpenOrders`; columns Pair, Side, Price, Qty, Placed (`formatTime`), Cancel button → `orderCancelled(order)`; empty `No open orders`.
- `TradeHistory`: `selectTrades`; columns Time, Pair, Side, Type, Qty, Price, Total, Realized; empty `No trades yet`.
- `AlertForm`: symbol defaults to selection, `Segmented` above/below, price input prefilled with last; inline error from `validateAlert`; submit → `alertRequested`. `AlertsPanel`: form + list of alerts with `Triggered 14:05:32 @ 70,012.10` or `Waiting`, delete button → `alertDeleted(id)`.

- [ ] **Step 1: Write failing tests** — `renders a position row with pnl from the ticker`; `cancel button dispatches orderCancelled with the order`; `history shows newest first`; `alert form rejects an already-true condition inline`; `delete dispatches alertDeleted`.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat: positions, open orders, history and alerts panels`.

---

### Task 22: Header, reset, toasts, external-change banner

**Files:**
- Create: `src/features/portfolio/components/EquityHeader.tsx`, `ResetPortfolioButton.tsx`, `src/features/notifications/components/ToastStack.tsx`, `src/app/components/ExternalChangeBanner.tsx`
- Modify: `src/App.tsx` (mount all regions: `MarketList`, `ChartPanel`, `TradeForm`, `BottomPanel`, `EquityHeader`, `ConnectionStatus`, `ToastStack`, `ExternalChangeBanner`)
- Test: `EquityHeader.test.tsx`, `ToastStack.test.tsx`, `ExternalChangeBanner.test.tsx`

**Interfaces:**
- `EquityHeader`: `Equity 10,120.00 USDT · Realized +20.00` from `selectEquity`/`selectRealizedPnl`, app title, `ResetPortfolioButton` (two-step: click shows `Reset to 10,000 USDT?` with Confirm/Cancel; confirm → `portfolioReset()`).
- `ToastStack`: fixed bottom-right, `role="status"`, each toast with kind colour, title, message, close button → `toastDismissed(id)`.
- `ExternalChangeBanner`: visible when `app.externalChange`; text `This terminal was changed in another tab. Reload to sync.` with a Reload button (`location.reload()`).

- [ ] **Step 1: Write failing tests** — `equity sums quote and positions`; `reset asks for confirmation then dispatches portfolioReset`; `close button dismisses a toast`; `banner appears only after externalChangeDetected`.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** `npm run check` — PASS.
- [ ] **Step 5: Commit** `feat: equity header, reset, toasts and cross-tab banner`.

---

### Task 23: Integration, README, CI, deploy instructions

**Files:**
- Create: `.github/workflows/deploy.yml`, `docs/screenshots/` (at least one PNG of the running app), `README.md` (replace placeholder)
- Modify: `src/App.test.tsx` (integration smoke with a fake client)
- Test: `src/App.integration.test.tsx`

**Interfaces:**
- `deploy.yml`: on push to `main`; `actions/checkout@v4`, `actions/setup-node@v4` (node 24, cache npm), `npm ci`, `npm run check`, `npm run build`, `actions/upload-pages-artifact@v3` (`dist`), `actions/deploy-pages@v4`; `permissions: { pages: write, id-token: write, contents: read }`.
- README sections (spec §7): pitch, live link `https://oleksiishcherbynin.github.io/crypto-terminal/`, screenshot, features, architecture (feature folders + data flow), **Saga patterns** table (copy spec §5.3 with links to files), run/test commands, limitations (paper trading, no fees, Binance regional availability, single tab), deploy steps for the owner: create the GitHub repo `OleksiiShcherbynin/crypto-terminal`, push `main`, Settings → Pages → Source: GitHub Actions.

- [ ] **Step 1: Write the integration test** — `createAppStore({ deps: fakeDeps() })` with real sagas, render `<App/>`, `client.emit({ type: 'open' })`, emit a BTC ticker at 100, `await screen.findAllByText('100.00')` (row and chart header); type quantity `0.1`, click `Buy BTC`, `await findByText(/Bought 0.10000 BTC/)`; equity header shows `10,000.00`; status shows `Live`.
- [ ] **Step 2: Run** — FAIL until wiring issues are fixed; fix them. **Step 3:** Run the app with `npm run dev`, open `http://localhost:5173/crypto-terminal/`, verify live prices, a market buy, a limit order that fills, an alert toast, a reload that keeps state; take `docs/screenshots/terminal.png`.
- [ ] **Step 4: Write README and workflow;** run `npm run build` and `npm run preview`, open the preview URL and confirm assets load under `/crypto-terminal/`.
- [ ] **Step 5: Run** `npm run check` — PASS. **Commit** `docs: README, screenshots and GitHub Pages workflow`.
- [ ] **Step 6:** Report to the owner: repo is ready to push; list the three manual steps (create repo, push, enable Pages).
