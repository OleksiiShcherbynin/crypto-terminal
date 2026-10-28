# Crypto Terminal — Design

Date: 2026-10-28
Status: draft, awaiting owner approval

## 1. Intent

A paper-trading crypto terminal running entirely in the browser on live
Binance prices. It is a **portfolio project** for frontend job
applications. Its job is to prove, to a hiring engineer skimming the
repo and clicking the live link for five minutes, that the author is
fluent in:

- TypeScript (strict),
- React with hooks,
- Redux (Redux Toolkit),
- **redux-saga**, used for real asynchronous work, not "fetch a list on click",
- a styling library (Tailwind).

Saga is the headline. Every saga in the app must exist because the
product needs it, and each one should show a different side of the
library: event channels, reconnection with backoff, cancellation,
races, long-lived per-entity watchers, debounced persistence.

## 2. Goals, non-goals, anti-goals

### Goals

1. A reviewer opens the live URL and sees prices moving within a few
   seconds, with no setup, no key, no account.
2. They can buy, sell, place a limit order, set an alert, reload the
   page, and find everything still there.
3. The saga layer reads as production-grade: typed, tested, each
   pattern obvious from the file names and the README.
4. The UI looks like a trading terminal someone designed, not a
   component-library demo.
5. Repo is self-explanatory: English README with screenshots, an
   architecture section, and a table mapping each feature to the saga
   effects it uses.

### Non-goals

- No backend, no auth, no real money, no exchange keys.
- One user, one device. No sync across devices.
- No order book, no margin, no short selling, no fees, no slippage.
- No custom watchlist editing; the pair list is a fixed constant.
- Mobile is usable but secondary. The primary scene is a desktop
  window ≥ 1280 px wide.

### Anti-goals (would make this a failure even if it works)

- Saga that could be replaced by `createAsyncThunk` with no loss.
- A layout that reads as "admin dashboard template".
- An app that looks broken when the exchange feed is down. Loss of
  connection must be visible, explained, and self-healing.
- State that gets corrupted on reload (negative balances, phantom
  orders, duplicate fills after a restore).
- A re-render storm: 25 tickers at Binance's update rate must not
  make the page sluggish.

## 3. Constraints

- **Data source:** Binance public market-data endpoints, no key.
  - WebSocket combined stream: `wss://data-stream.binance.vision/stream?streams=...`
    (market-data-only host). Fallback host: `wss://stream.binance.com:9443`.
  - REST for candle history: `https://data-api.binance.vision/api/v3/klines`
    (fallback `https://api.binance.com`). CORS is open on these public
    endpoints.
  - Streams used: `<symbol>@miniTicker` for every watched pair (last
    price, 24h open/high/low/volume); `<symbol>@kline_<interval>` for
    the selected pair only.
  - Limits that matter: one connection may hold up to 1024 streams;
    at most 5 subscribe/unsubscribe messages per second; the server
    drops a connection after 24 h and pings every 20 s (browsers answer
    pongs automatically).
  - Some networks and regions block Binance hosts. Reachability of all
    four hosts (both REST, both WebSocket) from the owner's machine was
    verified on 2026-10-28: first ticker message within 2 s on both
    sockets. No Plan B exchange is in scope; if a reviewer's region
    blocks Binance the app shows the Offline state and the README
    names the limitation. The socket client tries the primary host
    first and switches to the fallback host after two consecutive
    failed attempts, alternating from then on (builder may tune).
- **Hosting:** static, GitHub Pages (Vite `base` set to the repo name)
  via GitHub Actions. Vercel is acceptable if Pages proves awkward.
- **Environment:** Windows 11, PowerShell 5.1, Node 24, npm 11.
  Scripts must not rely on `&&` in `package.json` run through
  PowerShell; use npm's own script chaining or `npm-run-all`.
- **Language:** UI, code, comments, README in English.

## 4. Product

### 4.1 Screen

One screen, no router. Three regions on desktop:

```
┌──────────────────┬──────────────────────────────┬───────────────────┐
│ Market           │ BTC/USDT  67,412.50  +1.84%   │ Trade             │
│ [search…]        │ [1m][15m][1h]                 │ [Buy] [Sell]      │
│ BTC/USDT 67,412  │                               │ Market | Limit    │
│ ETH/USDT  3,512  │        candlestick chart      │ Qty [____] 25 50  │
│ …                │                               │ Price [____]      │
│                  │                               │ Cost  1,234 USDT  │
│                  │                               │ [ Buy BTC ]       │
│                  │                               │ Balance 8,765 USDT│
├──────────────────┴──────────────────────────────┴───────────────────┤
│ Positions | Open orders | History | Alerts              ● Live       │
│ BTC  0.0150  avg 66,900  value 1,011  P&L +7.69 (+0.77%)            │
└─────────────────────────────────────────────────────────────────────┘
```

Below 1280 px the three regions stack (market list, then chart and
trade form, then the bottom panel as tabs). Toasts appear bottom-right.

### 4.2 Market list

- ~25 USDT pairs, fixed constant (BTC, ETH, BNB, SOL, XRP, ADA, DOGE,
  AVAX, DOT, LINK, MATIC, LTC, TRX, UNI, ATOM, NEAR, APT, ARB, OP,
  FIL, ETC, XLM, ICP, SUI, PEPE — builder may adjust to what Binance
  actually lists at build time).
- Columns: pair, last price, 24h change %, 24h volume (compact).
- Price cell flashes green/red for a moment on up/down tick.
- Text filter box narrows the list client-side (pure selector, no
  saga: filtering 25 rows is synchronous).
- Clicking a row selects the pair; the selection is highlighted and
  persisted.
- Sorting by column is a nice-to-have, builder's call.

### 4.3 Chart

- Candlestick chart of the selected pair; intervals 1m, 15m, 1h.
- On select or interval change: load the last ~300 candles via REST,
  then keep the last candle updating from the kline stream.
- Chart library: `lightweight-charts` (TradingView, Apache-2.0). It is
  the natural look for a terminal and handles streaming updates. My
  call; a builder may swap for another library only if it supports
  live candle updates.
- If history fetch fails, the chart shows "history unavailable" and
  draws from live candles only; it must not block trading.

### 4.4 Trading

- Starting balance: 10,000 USDT (virtual) on first visit. A "Reset
  portfolio" action in the header restores it (with confirmation) and
  clears orders, alerts, and history.
- Side: Buy / Sell. Type: Market / Limit.
- Quantity in base asset, with 25/50/75/100 % buttons (of available
  quote for buys, of held quantity for sells). The form shows the
  estimated cost or proceeds in USDT live.
- **Market order**: the form dispatches `marketOrderRequested`; a
  `tradeSaga` selects the current last price and connection status,
  validates, and dispatches `orderFilled` (or `orderRejected` with a
  reason). Reducers never read other slices for the price.
- Market orders are **only accepted while the connection is Live**.
  While Reconnecting or Offline the Buy/Sell button is disabled and
  the form explains why. Limit orders and alerts may still be placed
  offline; they are matched once live ticks resume.
- **Limit order** is stored as open and watched by a saga. A buy limit
  fills when last price ≤ limit; a sell limit fills when last price ≥
  limit. Fills happen at the limit price. Funds are reserved at
  placement (quote for buys, base for sells) so the available balance
  shown excludes them. Cancelling releases the reservation.
- A limit order on the wrong side of the market is **rejected at
  validation**: a buy limit must be below the current last price, a
  sell limit above it. This keeps "fills at limit price" honest.
  While offline there is no live price, so the check uses the last
  known price and the form shows it is stale.
- Validation: quantity > 0, enough available funds/quantity, limit
  price > 0 and on the correct side. Errors shown inline, submit
  disabled.
- A fill (market or limit) shows a toast.
- Long only; a sell may not exceed held quantity (held minus reserved).
- No fees, no slippage. My call: keeps the math honest and the demo
  clear; the README will say so.

### 4.5 Portfolio

- Positions: per asset, quantity, average entry price, current value,
  unrealized P&L in USDT and %. Recomputed on every price batch via
  memoized selectors.
- Header shows total equity (USDT + positions at last price) and
  realized P&L.
- Average-cost basis. Realized P&L accumulates on sells.
- Trade history: time, pair, side, type, quantity, price, total.
  Newest first.
- Money math must not produce dust or negatives. Builder decides
  between a decimal library (`big.js`) and a rounding discipline; the
  requirement is: a position sold 100 % disappears, and a balance
  never goes below zero by rounding.

### 4.6 Alerts

- "Notify me when PAIR goes above / below X". One-shot: fires once,
  then is marked triggered with the time.
- Semantics are a **level check**, not a crossing: the alert fires on
  the first live tick with price ≥ X (above) or ≤ X (below). Creating
  an alert whose condition is already true is rejected at validation
  ("price is already above X"). An alert restored from storage whose
  level was crossed while the tab was closed fires on the first live
  tick after reload; that is the desired behaviour and the README
  says so.
- Firing shows a toast and keeps the alert in the list as triggered.
- Alerts can be deleted at any time.
- Toasts: bottom-right, auto-dismiss after ~6 s, manual close.

### 4.7 Connection status

- Indicator in the bottom bar: **Live** / **Reconnecting (attempt n)** /
  **Offline**.
- When the feed is down, prices stay on screen but dim, and the trade
  form warns that fills may be delayed. No fills happen on stale
  prices (an order is only matched against ticks that arrived while
  connected).

### 4.8 Persistence

- `localStorage`, single versioned key (`crypto-terminal:v1`).
- Persisted: balance, positions, open orders, trades, alerts, selected
  pair and interval. Not persisted: tickers, candles, connection state,
  toasts.
- Restore on boot before sagas start. A schema version mismatch
  resets to defaults rather than crashing.
- **Multiple tabs are a documented limitation**, not a supported
  case: each tab runs its own watchers and the last writer wins. The
  app listens to the `storage` event and, when another tab has
  written the key, shows a non-blocking banner "Changed in another
  tab, reload to sync" and stops persisting from this tab until
  reload. No locking, no BroadcastChannel.

## 5. Architecture

### 5.1 Stack (decided)

| Concern | Choice |
|---|---|
| Build | Vite, TypeScript `strict`, ESLint, Prettier |
| State | Redux Toolkit slices, typed hooks, memoized selectors |
| Side effects | redux-saga (all async and timing logic lives here) |
| Styling | Tailwind CSS v4, no component library |
| Chart | lightweight-charts |
| Tests | Vitest, redux-saga-test-plan, React Testing Library |
| CI/CD | GitHub Actions: lint, test, build, deploy to Pages |

### 5.2 Feature layout

```
src/
  app/            store, rootSaga, typed hooks, persistence boundary
  features/
    market/       tickers slice, connection slice, stream saga, pair list
    chart/        candles slice, chart saga
    portfolio/    balance, positions, trades slice; selectors
    orders/       open orders slice, order watcher saga
    alerts/       alerts slice, alert watcher saga
    notifications/ toasts slice, toast saga
  services/
    binance/      WebSocket client factory, REST client, message parsers
  ui/             shared primitives (Button, Input, Tabs, Panel, Toast)
```

Each feature owns its slice, sagas, selectors, components, and tests.
Cross-feature communication goes through actions only (e.g. the order
saga dispatches `orderFilled`; the portfolio reducer handles it).

### 5.3 Sagas and what each one demonstrates

| Saga | Does | Effects it showcases |
|---|---|---|
| `marketStreamSaga` | Opens one combined-stream socket for all tickers; parses messages; batches ticks and dispatches `tickersUpdated` at most ~4 times/s; tracks connection status; reconnects with exponential backoff (1 s → 30 s cap) on close or error; treats 30 s of silence as a dead connection | `eventChannel` with a sliding buffer, `race` (message vs. silence timeout vs. `stop`), `delay`, `retry`-style loop, `cancelled()` cleanup closing the socket |
| `chartSaga` | On pair or interval change: unsubscribe the previous kline stream, cancel any in-flight history fetch, fetch history, subscribe the new kline stream, apply live candle updates | `takeLatest`, `call` with cancellation, `fork`, `cancelled()`, subscribe/unsubscribe messages over the shared socket |
| `tradeSaga` | Handles `marketOrderRequested`: selects last price and connection status, validates, dispatches `orderFilled` or `orderRejected` | `takeEvery`, `select`, `put` |
| `orderWatcherSaga` | One forked watcher per open limit order, spawned on placement and re-spawned on boot for restored orders; waits for a tick that crosses the limit, races it against cancellation; dispatches `orderFilled` | `fork` per entity, `take` with a predicate, `race` (fill vs. cancel), `select` |
| `alertWatcherSaga` | Same shape as orders, for price alerts; on trigger dispatches `alertTriggered` and `toastPushed` | `fork`, `take`, `race`, `put` |
| `toastSaga` | Auto-dismiss each toast after a delay unless closed manually | `takeEvery`, `race` (`delay` vs. dismiss action) |
| `persistenceSaga` | Writes the persisted subset of state after any of the persisted slices change, debounced | `debounce` over an action pattern, `select` |

Rules:

- No timing logic (`setTimeout`, reconnect loops) outside sagas.
- No business logic (fill matching, P&L) inside components.
- A fill or alert is matched only against ticks received over a live
  connection, never against restored state, so a reload cannot
  double-fill.
- The socket is owned by a `services/binance` client with
  `subscribe(streams)` / `unsubscribe(streams)`; `marketStreamSaga`
  owns its lifecycle, `chartSaga` only subscribes and unsubscribes
  the kline stream through it. After a reconnect the client
  re-subscribes every stream it currently holds, including the
  selected kline stream.
- Every saga has tests with `redux-saga-test-plan`, with the socket and
  REST client provided as mocks. Reducers have unit tests. Key
  components (trade form validation, market row flash, toast) have RTL
  tests.

### 5.4 Performance

- Ticks are batched in the saga; the tickers slice is updated once per
  batch.
- Market rows are memoized and subscribe to their own symbol via
  selector, so one tick re-renders one row.
- Positions and equity are memoized selectors keyed on the tickers
  batch.

## 6. Visual direction

Tailwind, dark theme only. Dense, calm, numeric. Intent: "a tool a
trader keeps open all day", not a marketing page.

- Background near-black with slightly lighter panels; one accent hue
  for selection and primary buttons; green/red reserved for price
  movement and P&L.
- Numbers in a monospaced or tabular-figure face (`font-variant-numeric:
  tabular-nums`); UI text in a neutral sans.
- Panels separated by hairlines, not shadows. Minimal chrome, no cards
  within cards.
- Price flash: short background tint that fades, no layout shift.
- The frontend-design skill is to be used at implementation time to
  settle typography and exact palette; this section fixes the
  direction only.

## 7. Delivery

- Git repository in the project folder (none exists yet). Design
  documents and plans live in `docs/superpowers/`.
- GitHub Actions workflow: on push to `main` run lint, tests, build,
  deploy `dist/` to GitHub Pages.
- Repository `OleksiiShcherbynin/crypto-terminal`; Vite `base` is
  `/crypto-terminal/`; live link
  `https://oleksiishcherbynin.github.io/crypto-terminal/`. The GitHub
  CLI is not installed on the owner's machine, so the plan stops at a
  committed, working workflow file plus README instructions; the
  owner creates the remote, pushes `main`, and enables Pages (source:
  GitHub Actions).
- Every design document and plan under `docs/superpowers/` is kept in
  two languages: the English file is the source of truth, and a
  Russian twin with the `.ru.md` suffix is written alongside it
  (owner's standing preference).
- README (English): one-paragraph pitch, live link, GIF or screenshots,
  features list, architecture diagram, the saga table from §5.3 with
  links to files, how to run and test, honest limitations (paper
  trading, no fees, Binance availability by region).

## 8. Implementation shape (for the plan)

The owner wants several agents working the code. The plan should
therefore establish contracts first, then parallelize:

1. Scaffold and contracts: Vite project, Tailwind, store, slice state
   shapes and action creators, Binance message types, service
   interfaces. One agent, sequential.
2. In parallel: (a) slices, selectors, sagas, and their tests; (b) UI
   components against the contracts with mocked store data.
3. Integration, README, CI, deploy, final review.

## 9. Left to the builder

- Exact component breakdown inside each feature.
- Kline history fetch size, candle merging details.
- Number formatting rules per pair (price precision, compact volume).
- Choice between a decimal library and a rounding discipline (§4.5).
- Column sorting in the market list.
- Test file layout and fixture design.
- Exact backoff constants, batch interval, silence timeout (the
  numbers in §5.3 are defaults, not requirements).

## 10. Decisions made by Claude, not the owner

Listed so the owner can veto any of them while reading:

- Tailwind over Material UI — **owner's choice** (2026-10-28).
- No router, single screen with a tabbed bottom panel.
- Fixed pair list, no watchlist editing.
- Fills at limit price, funds reserved at placement, no fees or
  slippage, long only.
- Market list filter is a selector, not a saga.
- `lightweight-charts` for the chart; intervals 1m / 15m / 1h.
- Binance `data-stream.binance.vision` / `data-api.binance.vision` as
  primary hosts, `stream.binance.com` / `api.binance.com` as fallback.
- Dark theme only.
- GitHub Pages as the default deploy target; owner pushes and enables
  Pages manually (no `gh` on the machine).
- Market orders only while Live, routed through `tradeSaga`.
- Wrong-side limit orders and already-true alerts rejected at
  validation; alerts are level checks, restored alerts may fire on
  the first live tick.
- Multiple tabs: documented limitation with a "reload to sync" banner.
- Binance fallback host after two failed attempts; no second exchange.
- GitHub account for the live link: `OleksiiShcherbynin` (confirmed by
  the owner 2026-10-28).
