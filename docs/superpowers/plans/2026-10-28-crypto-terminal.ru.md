# План реализации Crypto Terminal

> **Для агентов-исполнителей:** ОБЯЗАТЕЛЬНЫЙ ПОД-СКИЛЛ: superpowers:subagent-driven-development (рекомендуется) или superpowers:executing-plans, задача за задачей. Шаги размечены чекбоксами (`- [ ]`) для отслеживания.

Русская версия файла `2026-10-28-crypto-terminal.md`. При расхождении источник истины — английская версия; код, имена и сигнатуры в обеих версиях одинаковы.

**Цель:** браузерный криптотерминал для paper-trading на живых котировках Binance, демонстрирующий redux-saga, как портфолио-проект.

**Архитектура:** состояние держат слайсы Redux Toolkit; всё асинхронное и временнóе живёт в redux-saga (event channel сокета с переподключением, загрузка графика с отменой, наблюдатели на каждую заявку и алерт, таймеры тостов, отложенное сохранение). Фичи общаются только через экшены. Тонкий слой `services/binance` оборачивает WebSocket и REST, чтобы саги и тесты его подставляли.

**Стек:** Vite 8, React 19, TypeScript strict, Redux Toolkit 2.13, react-redux 9, redux-saga 1.5, redux-saga-test-plan 4, Tailwind CSS 4 (`@tailwindcss/vite`), lightweight-charts 5, big.js 7, Vitest 5 + jsdom + React Testing Library 16, ESLint 10 + Prettier 3, GitHub Actions → GitHub Pages.

**Спецификация:** `docs/superpowers/specs/2026-10-28-crypto-terminal-design.md` (русская версия: `…-design.ru.md`). Каждая задача реализует пронумерованный раздел спецификации; сначала прочитать её.

**Параллельность (спец. §8):** задачи 1–8 последовательны и задают контракты. После задачи 8 группа **S** (задачи 9–16, саги) и группа **U** (задачи 17–22, UI) не зависят друг от друга, их могут выполнять разные агенты параллельно. Задача 23 — интеграция.

## Глобальные ограничения

- TypeScript `strict: true`; никакого `any` в продуктовом коде; саги типизированы `SagaIterator`, результат `yield select/call/take` аннотируется на принимающей `const`.
- Node 24, npm 11, Windows 11 / PowerShell 5.1. `&&` внутри скриптов `package.json` допустим (npm запускает их через cmd.exe); в командной строке PowerShell через `&&` не склеивать.
- Версии TypeScript и ESLint оставить теми, что закрепляет шаблон Vite; TypeScript до 7.x не поднимать.
- Хосты Binance (спец. §3): WS `data-stream.binance.vision`, затем `stream.binance.com:9443`; REST `data-api.binance.vision`, затем `api.binance.com`. Стримы: `<symbol lowercase>@miniTicker`, `<symbol lowercase>@kline_<interval>`. Интервалы: `1m`, `15m`, `1h`. История: 300 свечей.
- Стартовый баланс 10 000 USDT; без комиссий и проскальзывания, только лонг; лимитки исполняются по цене лимита; средства резервируются при выставлении (спец. §4.4).
- Ключ хранилища `crypto-terminal:v1`, версия схемы 1 (спец. §4.8).
- Тайминги по умолчанию (спец. §5.3): батч тиков 250 мс; таймаут тишины 30 000 мс; backoff 1 с с удвоением до потолка 30 с; статус `offline` после 5 подряд неудачных попыток; автозакрытие тоста 6 000 мс; debounce сохранения 500 мс. Всё инжектируется для тестов.
- Тексты интерфейса, код, комментарии, README — на английском. Только тёмная тема.
- Каждая задача заканчивается зелёным `npm run check` (lint + typecheck + тесты) и коммитом. Сообщения коммитов — conventional (`feat:`, `test:`, `chore:`), в конце `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Любой дизайн-документ или план, написанный в ходе выполнения, получает русского двойника `.ru.md` (постоянное правило владельца).

## Фокус ревью

1. **Сокет заблокирован, REST работает:** история графика загружается, статус идёт `connecting → reconnecting → offline` после 5 попыток, Buy/Sell для рыночных ордеров выключен с сообщением о соединении. Закреплено в задаче 9 (`reaches offline after five failed attempts`) и задаче 11 (`rejects market order while not live`).
2. **Продажа 100 % не оставляет пыли:** после продажи всей позиции записи нет, баланс USDT точный. Задача 5 (`removes position when fully sold`).
3. **Резерв никогда не уходит в минус:** лимитная покупка резервирует `price × qty`; исполнение освобождает ровно эту сумму даже при 8 знаках количества. Задача 5 (`fill releases exactly the reserved quote`).
4. **Испорченное или старое хранилище:** мусорный JSON или `version: 0` дают чистое состояние по умолчанию, а не падение. Задача 8 (тесты `loadPersistedState`).
5. **Быстрое переключение пар:** ответ истории для уже не выбранной пары отбрасывается. Задача 4 (`ignores candlesLoaded for another symbol`) и задача 10 (`takeLatest cancels the previous load`).

---

## Структура файлов

```
.github/workflows/deploy.yml
index.html, vite.config.ts, tsconfig*.json, eslint.config.js, .prettierrc, package.json
src/
  main.tsx                     запуск: загрузить сохранённое состояние, собрать deps, создать store, отрендерить
  App.tsx                      сетка (market | chart+trade | нижняя панель), баннер, тосты
  index.css                    импорт Tailwind + токены @theme
  domain/
    types.ts                   все доменные типы (Ticker, Candle, Order, Fill, Trade, Position, Alert, Toast …)
    actions.ts                 межфичевые экшены (appStarted, portfolioReset, order*)
    pairs.ts                   WATCHED_PAIRS, findPair, хелперы имён стримов
    money.ts                   арифметика на big.js
    format.ts                  форматирование чисел для UI
  services/binance/
    hosts.ts                   WS_HOSTS, REST_HOSTS, pickHost
    types.ts                   сырые формы сообщений Binance
    parse.ts                   parseStreamMessage → MarketEvent | null
    socketClient.ts            createSocketClient
    rest.ts                    fetchKlines
    testing.ts                 FakeWebSocket, createFakeSocketClient (только для тестов)
  app/
    store.ts                   rootReducer, RootState, SagaDeps, createAppStore
    rootSaga.ts
    hooks.ts                   useAppDispatch, useAppSelector
    appSlice.ts                флаг externalChange
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

Тесты лежат рядом с проверяемым файлом как `<name>.test.ts(x)`.

---

### Задача 1: Скаффолд, инструменты, первый коммит

**Файлы:**
- Создать: проект через `npm create vite@latest . -- --template react-ts`, затем `vite.config.ts`, `.prettierrc`, `src/test/setup.ts`, `src/index.css`, `src/App.test.tsx`, `.gitignore` (из шаблона), `README.md` (однострочная заглушка)

**Интерфейсы:**
- Даёт: `npm run check` = `run-s lint typecheck test`; `npm run test` = `vitest run`; `npm run dev`, `npm run build` (из шаблона); Vite `base: '/crypto-terminal/'`; Vitest с jsdom, `setupFiles: ['src/test/setup.ts']`, который импортирует `@testing-library/jest-dom/vitest`.

- [ ] **Шаг 1: Скаффолд** — в папке проекта выполнить `npm create vite@latest . -- --template react-ts` (на вопрос про непустую папку — «ignore files and continue»), затем `git init`, затем установить:

```
npm i @reduxjs/toolkit react-redux redux-saga lightweight-charts big.js
npm i -D tailwindcss @tailwindcss/vite vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event redux-saga-test-plan @types/big.js npm-run-all2 prettier
```

- [ ] **Шаг 2: Настроить** — `vite.config.ts`: плагины `react()`, `tailwindcss()`; `base: '/crypto-terminal/'`; `test: { environment: 'jsdom', setupFiles: ['src/test/setup.ts'] }` (добавить `/// <reference types="vitest/config" />`). `src/index.css`: `@import "tailwindcss";`. `.prettierrc`: `{ "singleQuote": true, "printWidth": 100 }`. Скрипты в `package.json`: `"test": "vitest run"`, `"typecheck": "tsc -b"` (шаблонный `tsconfig.app.json` уже содержит `noEmit`), `"check": "run-s lint typecheck test"`, `"format": "prettier --write src"`. Заменить шаблонный `App.tsx` на `<main>Crypto Terminal</main>`.

- [ ] **Шаг 3: Написать smoke-тест** `src/App.test.tsx`:

```tsx
it('renders the title', () => {
  render(<App />);
  expect(screen.getByText('Crypto Terminal')).toBeInTheDocument();
});
```

- [ ] **Шаг 4: Запустить** `npm run check` — ожидается: lint чист, typecheck чист, 1 тест прошёл.

- [ ] **Шаг 5: Коммит** — `git add -A` и `git commit -m "chore: scaffold Vite + React + TS + Tailwind + Vitest"`.

---

### Задача 2: Доменные типы, пары, деньги, форматирование

**Файлы:**
- Создать: `src/domain/types.ts`, `src/domain/pairs.ts`, `src/domain/money.ts`, `src/domain/format.ts`
- Тесты: `src/domain/pairs.test.ts`, `src/domain/money.test.ts`, `src/domain/format.test.ts`

**Интерфейсы:**
- Даёт (`types.ts`):

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

- Даёт (`pairs.ts`): `WATCHED_PAIRS: readonly Pair[]` (25 пар к USDT из спец. §4.2; `pricePrecision` 2 для BTC/ETH/BNB/SOL/LTC, 4 для остальных, 8 для PEPE; `qtyPrecision` 5 для BTC, 4 для ETH, 2 для остальных); `findPair(symbol: string): Pair | undefined`; `miniTickerStream(symbol: string): string` → `btcusdt@miniTicker`; `klineStream(symbol: string, interval: Interval): string` → `btcusdt@kline_1m`; `isKlineStream(stream: string): boolean`.
- Даёт (`money.ts`, все `(a: number, b: number) => number` через big.js, округление до 8 знаков): `add`, `sub`, `mul`, `div`; `roundTo(value: number, dp: number): number`; `isZero(value: number): boolean` (|value| < 1e-8).
- Даёт (`format.ts`): `formatPrice(value: number, precision: number): string` → `67,412.50`; `formatQuantity(value: number, precision: number): string`; `formatPct(pct: number): string` → `+1.84%` / `-0.30%`; `formatCompact(value: number): string` → `1.2B`, `845.3M`, `12.5K`; `formatUsd(value: number): string` → `8,765.00`; `formatTime(ms: number): string` → `14:05:32`.

- [ ] **Шаг 1: Написать падающие тесты**

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

- [ ] **Шаг 2: Запустить** `npm test -- src/domain` — ожидается FAIL (модули не найдены).
- [ ] **Шаг 3: Реализовать** четыре файла по сигнатурам выше. `format.ts` использует `Intl.NumberFormat('en-US', …)`; `formatCompact` — `notation: 'compact', maximumFractionDigits: 1`.
- [ ] **Шаг 4: Запустить** `npm test -- src/domain` — ожидается PASS.
- [ ] **Шаг 5: Коммит** `feat: domain types, pairs, money and format helpers`.

---

### Задача 3: Сервисный слой Binance

**Файлы:**
- Создать: `src/services/binance/hosts.ts`, `types.ts`, `parse.ts`, `socketClient.ts`, `rest.ts`, `testing.ts`
- Тесты: `hosts.test.ts`, `parse.test.ts`, `socketClient.test.ts`, `rest.test.ts`

**Интерфейсы:**
- Использует: типы из задачи 2, `miniTickerStream`/`klineStream`.
- Даёт:

```ts
// hosts.ts
export const WS_HOSTS = ['data-stream.binance.vision', 'stream.binance.com:9443'] as const;
export const REST_HOSTS = ['data-api.binance.vision', 'api.binance.com'] as const;
export function pickHost(hosts: readonly string[], attempt: number): string; // attempt < 2 → hosts[0]; else hosts[(attempt - 1) % hosts.length]
// types.ts — сырые формы, все числовые поля — строки
export interface RawMiniTicker { e: '24hrMiniTicker'; E: number; s: string; c: string; o: string; h: string; l: string; v: string; q: string }
export interface RawKline { e: 'kline'; E: number; s: string; k: { t: number; T: number; s: string; i: string; o: string; c: string; h: string; l: string; v: string; x: boolean } }
export interface RawCombined { stream: string; data: RawMiniTicker | RawKline }
// parse.ts
export type MarketEvent = { kind: 'ticker'; ticker: Ticker } | { kind: 'candle'; symbol: string; interval: Interval; candle: Candle };
export function parseStreamMessage(raw: string, now: () => number = Date.now): MarketEvent | null; // null для подтверждений {result,id}, неизвестных событий, битого JSON
// socketClient.ts
export type SocketEvent = { type: 'open' } | { type: 'message'; event: MarketEvent } | { type: 'close'; code: number } | { type: 'error' };
export interface SocketClient {
  readonly streams: ReadonlySet<string>;
  open(host: string): void;              // url = `wss://${host}/stream?streams=${[...streams].join('/')}`; сначала закрывает предыдущий сокет
  close(): void;
  subscribe(streams: string[]): void;    // добавляет; если открыт — шлёт {method:'SUBSCRIBE', params, id}
  unsubscribe(streams: string[]): void;  // удаляет; если открыт — шлёт {method:'UNSUBSCRIBE', params, id}; неизвестные стримы игнорирует
  listen(listener: (e: SocketEvent) => void): () => void;
}
export function createSocketClient(deps?: { WebSocketImpl?: typeof WebSocket; now?: () => number }): SocketClient;
// rest.ts
export async function fetchKlines(symbol: string, interval: Interval, limit: number, deps?: { fetchImpl?: typeof fetch; hosts?: readonly string[] }): Promise<Candle[]>; // перебирает хосты по порядку; бросает Error('klines unavailable'), если все упали
// testing.ts
export class FakeWebSocket { static instances: FakeWebSocket[]; url: string; sent: string[]; readyState: number; constructor(url: string); send(data: string): void; close(): void; emitOpen(): void; emitMessage(raw: string): void; emitClose(code: number): void; emitError(): void }
export function createFakeSocketClient(): SocketClient & { emit(e: SocketEvent): void; openedHosts: string[]; closeCount: number };
```

- [ ] **Шаг 1: Написать падающие тесты**

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
// socketClient.test.ts (через FakeWebSocket)
it('opens a combined-stream url from held streams', () => { client.subscribe(['btcusdt@miniTicker', 'ethusdt@miniTicker']); client.open('h'); expect(FakeWebSocket.instances[0].url).toBe('wss://h/stream?streams=btcusdt@miniTicker/ethusdt@miniTicker'); });
it('sends SUBSCRIBE when subscribing while open', () => { /* open, emitOpen, subscribe(['btcusdt@kline_1m']) → sent[0] парсится в {method:'SUBSCRIBE', params:[…], id: 1} */ });
it('forwards parsed messages and close to listeners', () => { /* emitMessage(raw тикера) → слушатель получил {type:'message', event:{kind:'ticker'…}}; emitClose(1006) → {type:'close', code:1006} */ });
it('re-opening closes the previous socket and resubscribes all streams', () => { /* open('a'); open('b') → instances[0] закрыт, instances[1].url содержит все стримы */ });
// rest.test.ts
it('maps kline rows to candles', async () => { const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify([[1700000000000, '1', '2', '0.5', '1.5', '10', 0]]))); expect(await fetchKlines('BTCUSDT', '1m', 1, { fetchImpl, hosts: ['h'] })).toEqual([{ time: 1700000000, open: 1, high: 2, low: 0.5, close: 1.5, volume: 10 }]); expect(fetchImpl.mock.calls[0][0]).toBe('https://h/api/v3/klines?symbol=BTCUSDT&interval=1m&limit=1'); });
it('falls back to the second host and throws when all fail', async () => { /* первый отклоняет, второй ок → результат; оба отклоняют → reject 'klines unavailable' */ });
```

- [ ] **Шаг 2: Запустить** `npm test -- src/services` — ожидается FAIL.
- [ ] **Шаг 3: Реализовать** файлы. `socketClient` держит `Set<string>`, массив слушателей, инкрементный id сообщений и текущий `WebSocket`; каждое `message` парсит через `parseStreamMessage`, null отбрасывает. `FakeWebSocket` добавляет себя в `instances` в конструкторе; тесты сбрасывают `instances` в `beforeEach`. `createFakeSocketClient` записывает `openedHosts`, считает `close()`, `emit` передаёт событие слушателям.
- [ ] **Шаг 4: Запустить** `npm test -- src/services` — ожидается PASS.
- [ ] **Шаг 5: Коммит** `feat: Binance socket client, message parser and klines REST`.

---

### Задача 4: Простые слайсы (tickers, connection, selection, candles, toasts, app)

**Файлы:**
- Создать: `src/domain/actions.ts`, `src/features/market/tickersSlice.ts`, `connectionSlice.ts`, `selectionSlice.ts`, `src/features/chart/candlesSlice.ts`, `src/features/notifications/toastsSlice.ts`, `src/app/appSlice.ts`
- Тесты: по одному `*.test.ts` на слайс

**Интерфейсы:**
- Даёт (`domain/actions.ts`, `createAction`): `appStarted()`, `portfolioReset()`, `orderRequested(req: OrderRequest)`, `orderPlaced(order: Order)`, `orderCancelled(order: Order)`, `orderFilled(fill: Fill)`, `orderRejected({ request: OrderRequest; reason: string })`.
- Даёт слайсы (состояние → экшены):
  - `tickers`: `Record<string, Ticker>` → `tickersUpdated(tickers: Ticker[])` (upsert по символу).
  - `connection`: `{ status: ConnectionStatus; attempt: number }`, начальное `{ status: 'connecting', attempt: 0 }` → `connectionStatusChanged({ status, attempt })`.
  - `selection`: `{ symbol: string; interval: Interval }`, начальное `{ symbol: 'BTCUSDT', interval: '1m' }` → `pairSelected(symbol)`, `intervalChanged(interval)`.
  - `candles`: `{ symbol: string; interval: Interval; status: 'idle' | 'loading' | 'ready' | 'unavailable'; candles: Candle[] }` → `candlesLoading({ symbol, interval })` (ставит symbol/interval, статус loading, очищает свечи), `candlesLoaded({ symbol, interval, candles })` (игнорируется, если symbol+interval не совпадают с текущими), `candlesUnavailable({ symbol, interval })` (та же защита), `candleReceived({ symbol, interval, candle })` (та же защита; слияние: last.time === candle.time → заменить; candle.time > last.time → добавить; иначе игнорировать; работает в `ready` и `unavailable`, не в `loading`).
  - `toasts`: `{ items: Toast[] }` → `toastPushed(toast)`, `toastDismissed(id)`.
  - `app`: `{ externalChange: boolean }` → `externalChangeDetected()`.
- Каждый файл слайса экспортирует `<name>Reducer` (default export) и свои экшены; тип `<Name>State`.

- [ ] **Шаг 1: Написать падающие тесты** (по `describe` на слайс, на уровне редьюсера):

```ts
it('upserts tickers by symbol', () => { const s = tickersReducer({}, tickersUpdated([t('BTCUSDT', 1), t('BTCUSDT', 2)])); expect(s.BTCUSDT.last).toBe(2); });
it('ignores candlesLoaded for another symbol', () => { let s = candlesReducer(undefined, candlesLoading({ symbol: 'ETHUSDT', interval: '1m' })); s = candlesReducer(s, candlesLoaded({ symbol: 'BTCUSDT', interval: '1m', candles: [c(1)] })); expect(s.status).toBe('loading'); expect(s.candles).toEqual([]); });
it('replaces the last candle when time matches and appends when newer', () => { /* ready с [c(1)] → candleReceived c(1, close 9) заменяет; c(2) добавляет; c(0) игнорируется */ });
it('does not merge live candles while loading', () => { /* статус loading + candleReceived → candles по-прежнему [] */ });
it('dismisses a toast by id', () => { /* push a, push b, dismiss a → [b] */ });
it('maps pairSelected and intervalChanged', () => { /* тривиально */ });
it('stores connection status', () => { /* тривиально */ });
```
Фикстуры `t(symbol, last)` и `c(time, close?)` кладутся в `src/test/fixtures.ts` (там же экспортировать билдеры `order(partial)`, `alert(partial)`, `fill(partial)` с разумными значениями по умолчанию для следующих задач).

- [ ] **Шаг 2: Запустить** `npm test -- src/features src/app` — ожидается FAIL.
- [ ] **Шаг 3: Реализовать** слайсы через `createSlice`; у `candles`/`toasts`/`app` `extraReducers` пока пустые.
- [ ] **Шаг 4: Запустить** — ожидается PASS.
- [ ] **Шаг 5: Коммит** `feat: tickers, connection, selection, candles, toasts and app slices`.

---

### Задача 5: Слайс портфеля и селекторы

**Файлы:**
- Создать: `src/features/portfolio/portfolioSlice.ts`, `src/features/portfolio/selectors.ts`
- Тесты: `portfolioSlice.test.ts`, `selectors.test.ts`

**Интерфейсы:**
- Использует: `domain/actions` (`orderPlaced`, `orderCancelled`, `orderFilled`, `portfolioReset`), `money.ts`.
- Даёт:

```ts
export interface PortfolioState { quoteBalance: number; reservedQuote: number; positions: Record<string, Position>; trades: Trade[]; realizedPnl: number }
export const INITIAL_QUOTE = 10_000; export const MAX_TRADES = 500;
// редьюсер обрабатывает только через extraReducers (своих экшенов нет):
//  orderPlaced: buy → reservedQuote += mul(price, qty); sell → positions[base].reservedQuantity += qty
//  orderCancelled: обратное orderPlaced
//  orderFilled: type 'limit' сначала освобождает резерв; затем buy → quoteBalance -= total, слияние позиции по средней цене;
//               sell → quoteBalance += total, realized = mul(sub(price, avgPrice), qty), quantity -= qty, удалить позицию при isZero(quantity);
//               trades.unshift({...fill, total, realizedPnl}), не больше MAX_TRADES; realizedPnl += realized
//  portfolioReset: начальное состояние
// selectors.ts (на RootState, производные — через createSelector):
export const selectPortfolio, selectQuoteBalance, selectAvailableQuote /* quoteBalance - reservedQuote */, selectAvailableBase(asset) /* quantity - reservedQuantity, 0 если нет */,
  selectPositionRows /* PositionRow[] по убыванию value */, selectEquity /* quoteBalance + Σ quantity*last */, selectRealizedPnl, selectTrades;
export interface PositionRow { asset: string; symbol: string; quantity: number; avgPrice: number; lastPrice?: number; value: number; unrealizedPnl: number; unrealizedPct: number }
```
`base` для символа берётся из `findPair(symbol)!.base`. Селекторы импортируют тип `RootState` из `src/app/store` (type-only импорт, цикла в рантайме нет); этот файл появится в задаче 8 — до тех пор объявить селекторы на локальном типе `{ portfolio: PortfolioState; tickers: Record<string, Ticker> }` и переключить на `RootState` в задаче 8.

- [ ] **Шаг 1: Написать падающие тесты**

```ts
it('market buy moves quote into a position at average cost', () => { let s = reduce(orderFilled(fill({ side: 'buy', type: 'market', quantity: 0.01, price: 60000 }))); s = reduce(orderFilled(fill({ side: 'buy', type: 'market', quantity: 0.01, price: 70000 })), s); expect(s.quoteBalance).toBe(8700); expect(s.positions.BTC).toMatchObject({ quantity: 0.02, avgPrice: 65000 }); });
it('removes position when fully sold and books realized pnl', () => { /* купить 0.02 @ 65000, продать 0.02 @ 66000 → positions.BTC undefined, quoteBalance 10020, realizedPnl 20, trades[0].realizedPnl 20 */ });
it('reserves quote on limit buy and releases on cancel', () => { /* orderPlaced buy 0.1 @ 50000 → reservedQuote 5000; orderCancelled → 0 */ });
it('fill releases exactly the reserved quote', () => { /* orderPlaced buy 0.00012345 @ 81000.5 → reservedQuote = mul(...); orderFilled той же лимитки → reservedQuote 0, quoteBalance = 10000 - total */ });
it('reserves base on limit sell', () => { /* позиция 0.5 ETH, orderPlaced sell 0.2 → reservedQuantity 0.2; selectAvailableBase('ETH') = 0.3 */ });
it('caps trade history at 500', () => { /* 501 исполнение → trades.length 500, новые сверху */ });
it('resets to initial state', () => { /* portfolioReset → INITIAL */ });
// selectors.test.ts
it('computes position rows and equity from tickers', () => { /* BTC 0.02 @ 65000, тикер last 66000 → value 1320, unrealizedPnl 20, unrealizedPct ≈ 1.538; equity = quote + 1320 */ });
```

- [ ] **Шаг 2: Запустить** `npm test -- src/features/portfolio` — ожидается FAIL.
- [ ] **Шаг 3: Реализовать** редьюсер и селекторы по описанию.
- [ ] **Шаг 4: Запустить** — ожидается PASS.
- [ ] **Шаг 5: Коммит** `feat: portfolio slice with reservations, average cost and selectors`.

---

### Задача 6: Слайс заявок и валидация ордеров

**Файлы:**
- Создать: `src/features/orders/ordersSlice.ts`, `src/features/orders/validation.ts`
- Тесты: `ordersSlice.test.ts`, `validation.test.ts`

**Интерфейсы:**
- Даёт:

```ts
export interface OrdersState { items: Order[] }
// редьюсер: orderPlaced → push; orderCancelled → удалить по id; orderFilled → удалить по fill.orderId, если есть; portfolioReset → []
export const selectOpenOrders = (s: { orders: OrdersState }) => s.orders.items;
// validation.ts
export interface OrderContext { pair: Pair; lastPrice?: number; connectionStatus: ConnectionStatus; availableQuote: number; availableBase: number }
export interface OrderError { field: 'quantity' | 'price' | 'connection' | 'funds'; message: string }
export function orderCost(req: OrderRequest, lastPrice: number): number; // mul(quantity, price ?? lastPrice)
export function validateOrder(req: OrderRequest, ctx: OrderContext): OrderError | null;
```
Правила в этом порядке, побеждает первая ошибка (тексты точные):
1. `quantity` не конечное или ≤ 0 → `{ field: 'quantity', message: 'Enter a quantity greater than zero' }`
2. `type === 'market' && connectionStatus !== 'live'` → `{ field: 'connection', message: 'Market orders need a live connection' }`
3. `lastPrice === undefined` → `{ field: 'price', message: 'No price for this pair yet' }`
4. `type === 'limit'` и `price` не конечное или ≤ 0 → `{ field: 'price', message: 'Enter a limit price greater than zero' }`
5. `type === 'limit' && side === 'buy' && price >= lastPrice` → `{ field: 'price', message: 'Buy limit must be below the current price' }`; sell и `price <= lastPrice` → `'Sell limit must be above the current price'`
6. buy и `orderCost > availableQuote` → `{ field: 'funds', message: 'Insufficient USDT' }`; sell и `quantity > availableBase` → `{ field: 'funds', message: \`Insufficient ${pair.base}\` }`

- [ ] **Шаг 1: Написать падающие тесты** — по одному `it` на правило выше с базовым проходящим контекстом (`lastPrice: 100, connectionStatus: 'live', availableQuote: 1000, availableBase: 5`), плюс `returns null for a valid market buy` и `returns null for a valid limit sell above market`; тесты слайса: `removes an order when its fill arrives`, `clears on portfolioReset`.
- [ ] **Шаг 2: Запустить** `npm test -- src/features/orders` — ожидается FAIL.
- [ ] **Шаг 3: Реализовать**.
- [ ] **Шаг 4: Запустить** — ожидается PASS.
- [ ] **Шаг 5: Коммит** `feat: orders slice and order validation rules`.

---

### Задача 7: Слайс алертов и валидация алертов

**Файлы:**
- Создать: `src/features/alerts/alertsSlice.ts`, `src/features/alerts/validation.ts`
- Тесты: `alertsSlice.test.ts`, `validation.test.ts`

**Интерфейсы:**
- Даёт:

```ts
export interface AlertsState { items: Alert[] }
// экшены: alertRequested(req: AlertRequest), alertCreated(alert: Alert), alertDeleted(id: string),
//          alertTriggered({ id: string; price: number; at: number }), alertRejected({ request: AlertRequest; reason: string })
// редьюсер: created → push; deleted → удалить; triggered → проставить triggeredAt/triggeredPrice; portfolioReset → []; alertRequested/alertRejected → без изменений
export const selectAlerts, selectActiveAlerts /* без triggeredAt */, selectAlertById(id);
// validation.ts
export function alertHit(alert: Pick<Alert, 'direction' | 'price'>, last: number): boolean; // above: last >= price; below: last <= price
export function validateAlert(req: AlertRequest, pair: Pair, lastPrice?: number): string | null;
```
Сообщения: цена не конечная или ≤ 0 → `'Enter a price greater than zero'`; `lastPrice === undefined` → `'No price for this pair yet'`; `alertHit(req, lastPrice)` → `'Price is already above X'` / `'Price is already below X'`, где X = `formatPrice(req.price, pair.pricePrecision)`.

- [ ] **Шаг 1: Написать падающие тесты** — `alertHit`: четыре случая (above попал/не попал, below попал/не попал, равенство считается попаданием); `validateAlert`: три сообщения и случай null; слайс: `marks alert triggered`, `clears on portfolioReset`.
- [ ] **Шаг 2: Запустить** — FAIL. **Шаг 3: Реализовать.** **Шаг 4: Запустить** — PASS.
- [ ] **Шаг 5: Коммит** `feat: alerts slice and alert validation`.

---

### Задача 8: Store, граница persistence, типизированные хуки, тестовая обвязка

**Файлы:**
- Создать: `src/app/store.ts`, `src/app/rootSaga.ts` (заглушка, которая только делает `put(appStarted())`), `src/app/hooks.ts`, `src/app/persistence.ts`, `src/features/market/selectors.ts`, `src/test/renderWithStore.tsx`
- Изменить: `src/features/portfolio/selectors.ts` (переключить на `RootState`), `src/main.tsx`
- Тесты: `src/app/persistence.test.ts`, `src/app/store.test.ts`

**Интерфейсы:**
- Даёт:

```ts
// store.ts
export const rootReducer = combineReducers({ tickers, connection, selection, candles, portfolio, orders, alerts, toasts, app });
export type RootState = ReturnType<typeof rootReducer>;
export interface SagaDeps { client: SocketClient; fetchKlines: typeof fetchKlines; storage: Storage; now: () => number; newId: () => string; wsHosts: readonly string[] }
export function createAppStore(opts: { preloadedState?: Partial<RootState>; deps: SagaDeps; runSaga?: boolean /* по умолчанию true */ }): { store: AppStore; sagaTask?: Task };
export type AppStore = EnhancedStore<RootState>; export type AppDispatch = AppStore['dispatch'];
// hooks.ts: useAppDispatch, useAppSelector (withTypes)
// features/market/selectors.ts
export const selectTicker = (symbol: string) => (s: RootState) => s.tickers[symbol] as Ticker | undefined;
export const selectTickers = (s: RootState) => s.tickers; export const selectConnection = (s: RootState) => s.connection; export const selectSelection = (s: RootState) => s.selection;
export const selectFilteredPairs = (query: string) => (): Pair[] => /* пары, чьи base или symbol содержат query без учёта регистра, в порядке WATCHED_PAIRS */
// persistence.ts
export const STORAGE_KEY = 'crypto-terminal:v1'; export const SCHEMA_VERSION = 1;
export interface PersistedState { version: 1; portfolio: PortfolioState; orders: OrdersState; alerts: AlertsState; selection: SelectionState }
export function pickPersisted(state: RootState): PersistedState;
export function loadPersistedState(storage: Storage): Partial<RootState> | undefined; // undefined при отсутствии ключа, ошибке JSON или version !== SCHEMA_VERSION
export function savePersistedState(storage: Storage, state: RootState): void;
// test/renderWithStore.tsx
export function renderWithStore(ui: ReactElement, opts?: { preloadedState?: Partial<RootState> }): RenderResult & { store: AppStore; client: ReturnType<typeof createFakeSocketClient> }; // runSaga: false
```
`main.tsx` собирает `deps` (`createSocketClient()`, `fetchKlines`, `localStorage`, `Date.now`, `() => crypto.randomUUID()`, `WS_HOSTS`), вызывает `createAppStore({ preloadedState: loadPersistedState(localStorage), deps })`, рендерит `<Provider store={store}><App /></Provider>`. Middleware проверки сериализуемости остаётся включённым; `SagaDeps` в экшены не попадают.

- [ ] **Шаг 1: Написать падающие тесты**

```ts
it('round-trips persisted slices', () => { const storage = fakeStorage(); const state = rootReducer(undefined, { type: 'init' }); savePersistedState(storage, state); expect(loadPersistedState(storage)).toEqual({ portfolio: state.portfolio, orders: state.orders, alerts: state.alerts, selection: state.selection }); });
it('returns undefined for garbage and for another version', () => { storage.setItem(STORAGE_KEY, '{nope'); expect(loadPersistedState(storage)).toBeUndefined(); storage.setItem(STORAGE_KEY, JSON.stringify({ version: 0 })); expect(loadPersistedState(storage)).toBeUndefined(); });
it('creates a store with preloaded state and no saga', () => { const { store, sagaTask } = createAppStore({ preloadedState: { selection: { symbol: 'ETHUSDT', interval: '1h' } }, deps: fakeDeps(), runSaga: false }); expect(store.getState().selection.symbol).toBe('ETHUSDT'); expect(sagaTask).toBeUndefined(); });
```
`fakeStorage()` и `fakeDeps()` кладутся в `src/test/fixtures.ts`.

- [ ] **Шаг 2: Запустить** `npm test -- src/app` — ожидается FAIL.
- [ ] **Шаг 3: Реализовать**; перевести `portfolio/selectors.ts` на `RootState`; перевести `App.test.tsx` на `renderWithStore`.
- [ ] **Шаг 4: Запустить** `npm run check` — ожидается PASS.
- [ ] **Шаг 5: Коммит** `feat: store, persistence boundary and test harness`.

---

> **Группа S (задачи 9–16) и группа U (задачи 17–22) с этого места могут идти параллельно.**

### Задача 9: Сага рыночного потока

**Файлы:**
- Создать: `src/features/market/marketStreamSaga.ts`
- Тесты: `marketStreamSaga.test.ts`

**Интерфейсы:**
- Использует: `SocketClient`, `SocketEvent`, `pickHost`, `tickersUpdated`, `connectionStatusChanged`, `candleReceived`, `miniTickerStream`, `WATCHED_PAIRS`.
- Даёт:

```ts
export const BATCH_MS = 250, SILENCE_MS = 30_000, MAX_BACKOFF_MS = 30_000, OFFLINE_AFTER_ATTEMPTS = 5, CHANNEL_BUFFER = 2000;
export const streamStopped = createAction('market/streamStopped');
export function backoffMs(attempt: number): number; // min(1000 * 2^(attempt-1), 30000): 1→1000, 2→2000, 6→30000
export function createSocketChannel(client: SocketClient): EventChannel<SocketEvent>; // buffers.sliding(CHANNEL_BUFFER); unsubscribe = client.listen(...)
export interface StreamOptions { batchMs: number; silenceMs: number; backoff: (attempt: number) => number; now: () => number }
export type StreamOutcome = { outcome: 'closed' | 'silent' | 'stopped'; opened: boolean }; // opened: за это соединение было событие 'open'
export function* consumeStream(channel: EventChannel<SocketEvent>, opts: StreamOptions): SagaIterator<StreamOutcome>;
export function* marketStreamSaga(deps: Pick<SagaDeps, 'client' | 'wsHosts' | 'now'>, opts?: Partial<StreamOptions>): SagaIterator;
```
Поведение: `marketStreamSaga` один раз подписывает `WATCHED_PAIRS.map(p => miniTickerStream(p.symbol))`, затем в цикле: `put(connectionStatusChanged({ status: attempt === 0 ? 'connecting' : attempt >= OFFLINE_AFTER_ATTEMPTS ? 'offline' : 'reconnecting', attempt }))`, `client.open(pickHost(hosts, attempt))`, `consumeStream`; при `'stopped'` закрыть канал и клиент и выйти; иначе `attempt += 1`, `delay(opts.backoff(attempt))`. Цикл `consumeStream`: `race({ tick: delay(batchMs), stop: take(streamStopped.type) })`; `flush(channel)`; по каждому событию: `open` → `put(connectionStatusChanged({ status: 'live', attempt: 0 }))` и сброс `lastMessageAt`; `message` с тикером → хранить последний по символу; `message` со свечой → `put(candleReceived(...))`; `close`/`error` → вернуть `'closed'`; после тела цикла `put(tickersUpdated([...batch]))`, если непусто; вернуть `'silent'`, когда `now() - lastMessageAt > silenceMs`. В `marketStreamSaga` счётчик `attempt` сбрасывается в 0 перед инкрементом, если вернувшийся `opened` истинен, так что соединение, которое работало и оборвалось, начинает снова с попытки 1.

- [ ] **Шаг 1: Написать падающие тесты** (`expectSaga` с `createFakeSocketClient()`, `opts = { batchMs: 5, silenceMs: 40, backoff: () => 1, now: Date.now }`):

```ts
it('goes live and batches tickers, keeping the latest per symbol', async () => { /* сценарий: emit open; emit тикер BTC 1; emit тикер BTC 2; emit тикер ETH 3 → ожидать put(connectionStatusChanged live) и put(tickersUpdated([BTC last 2, ETH last 3])); run(100) */ });
it('reconnects after close with incremented attempt', async () => { /* emit open, затем close(1006) → put connecting(0), live, reconnecting(1); client.openedHosts.length ≥ 2 */ });
it('reaches offline after five failed attempts', async () => { /* open не эмитить; на каждый open эмитить close (хук в фейковом клиенте) → ожидать put(connectionStatusChanged({status:'offline', attempt:5})) */ });
it('treats silence as a dead connection', async () => { /* emit open, больше ничего, silenceMs 40 → reconnecting(1) в пределах run(200) */ });
it('forwards candles immediately', async () => { /* emit событие свечи → put(candleReceived(...)) */ });
it('stops on streamStopped and closes the client', async () => { /* dispatch(streamStopped()) → сага завершается; client.closeCount 1 */ });
it('backoffMs doubles to a 30 s cap', () => expect([1, 2, 3, 6].map(backoffMs)).toEqual([1000, 2000, 4000, 30000]));
```

- [ ] **Шаг 2: Запустить** `npm test -- marketStreamSaga` — ожидается FAIL.
- [ ] **Шаг 3: Реализовать** по описанию. В `marketStreamSaga` использовать `try/finally` с `cancelled()`, чтобы закрыть канал и клиент при отмене корневой саги.
- [ ] **Шаг 4: Запустить** — ожидается PASS (использовать `.run({ timeout })` / `.silentRun()`, чтобы не было предупреждений о таймауте).
- [ ] **Шаг 5: Коммит** `feat: market stream saga with batching, silence detection and backoff reconnect`.

---

### Задача 10: Сага графика

**Файлы:**
- Создать: `src/features/chart/chartSaga.ts`
- Тесты: `chartSaga.test.ts`

**Интерфейсы:**
- Использует: `SocketClient.subscribe/unsubscribe/streams`, `fetchKlines`, `klineStream`, `isKlineStream`, `candlesLoading/Loaded/Unavailable`, `pairSelected`, `intervalChanged`, `appStarted`, `connectionStatusChanged`, селектор `selectSelection`.
- Даёт:

```ts
export const HISTORY_LIMIT = 300;
export const chartTriggers = (a: Action) => pairSelected.match(a) || intervalChanged.match(a) || appStarted.match(a) || (connectionStatusChanged.match(a) && a.payload.status === 'live');
export function* loadChart(deps: Pick<SagaDeps, 'client' | 'fetchKlines'>): SagaIterator;
export function* chartSaga(deps: Pick<SagaDeps, 'client' | 'fetchKlines'>): SagaIterator; // takeLatest(chartTriggers, loadChart, deps)
```
`loadChart`: `select(selectSelection)` → stream = `klineStream(symbol, interval)`; отписать все удерживаемые стримы, для которых `isKlineStream` и `!== stream`; подписать `[stream]`; `put(candlesLoading)`; `try { candles = call(fetchKlines, symbol, interval, HISTORY_LIMIT); put(candlesLoaded) } catch { put(candlesUnavailable) } finally { if (yield cancelled()) { /* вытеснена: стримами владеет новый запуск */ } }`.

- [ ] **Шаг 1: Написать падающие тесты**

```ts
it('subscribes the kline stream, unsubscribes the old one and loads history', async () => { /* клиент держит 'ethusdt@kline_1m' + 'btcusdt@miniTicker'; выбор BTCUSDT/1m; fetchKlines возвращает [c(1)] → client.streams содержит 'btcusdt@kline_1m', не содержит 'ethusdt@kline_1m', по-прежнему содержит 'btcusdt@miniTicker'; put candlesLoading, затем candlesLoaded */ });
it('marks history unavailable when fetch fails', async () => { /* fetchKlines отклоняет → put(candlesUnavailable), стрим всё ещё подписан */ });
it('takeLatest cancels the previous load', async () => { /* fetchKlines для ETH возвращает никогда не резолвящийся промис, для BTC резолвит; dispatch pairSelected('ETHUSDT'), затем pairSelected('BTCUSDT') → candlesLoaded только для BTCUSDT */ });
it('reloads when the connection comes back live', async () => { /* dispatch connectionStatusChanged live → fetchKlines вызван */ });
```
Использовать `expectSaga(chartSaga, deps).withReducer(rootReducer, state).dispatch(...)`.

- [ ] **Шаг 2: Запустить** — FAIL. **Шаг 3: Реализовать.** **Шаг 4: Запустить** — PASS.
- [ ] **Шаг 5: Коммит** `feat: chart saga with takeLatest history load and kline subscription`.

---

### Задача 11: Сага торговли (рыночные исполнения и выставление лимиток)

**Файлы:**
- Создать: `src/features/orders/tradeSaga.ts`
- Тесты: `tradeSaga.test.ts`

**Интерфейсы:**
- Использует: `validateOrder`, `orderCost`, `findPair`, `selectTicker(symbol)`, `selectConnection` (задача 8), `selectAvailableQuote`, `selectAvailableBase` (задача 5).
- Даёт:

```ts
export function* handleOrderRequest(deps: Pick<SagaDeps, 'now' | 'newId'>, action: PayloadAction<OrderRequest>): SagaIterator;
export function* tradeSaga(deps: Pick<SagaDeps, 'now' | 'newId'>): SagaIterator; // takeEvery(orderRequested.type, handleOrderRequest, deps)
```
`handleOrderRequest`: собрать `OrderContext` из селекторов; `error = validateOrder(req, ctx)`; ошибка → `put(orderRejected({ request: req, reason: error.message }))`; market → `put(orderFilled({ id: newId(), symbol, side, type: 'market', quantity, price: lastPrice, executedAt: now() }))`; limit → `put(orderPlaced({ id: newId(), symbol, side, price: req.price!, quantity, createdAt: now() }))`.

- [ ] **Шаг 1: Написать падающие тесты** (`expectSaga(tradeSaga, deps).withReducer(rootReducer, state).dispatch(orderRequested(...))`):

```ts
it('fills a market buy at the last price', async () => { /* тикер BTC last 100, live → put(orderFilled({ …price: 100, type: 'market' })); в итоговом состоянии quoteBalance 9990 при qty 0.1 */ });
it('rejects market order while not live', async () => { /* соединение reconnecting → put(orderRejected({ reason: 'Market orders need a live connection' })) и никакого orderFilled */ });
it('places a limit buy below market and reserves quote', async () => { /* лимитная покупка 0.1 @ 90 → put(orderPlaced), state.orders.items.length 1, reservedQuote 9 */ });
it('rejects a limit buy above market', async () => { /* причина 'Buy limit must be below the current price' */ });
```

- [ ] **Шаг 2: Запустить** — FAIL. **Шаг 3: Реализовать.** **Шаг 4: Запустить** — PASS.
- [ ] **Шаг 5: Коммит** `feat: trade saga validates and executes market and limit requests`.

---

### Задача 12: Сага-наблюдатель заявок

**Файлы:**
- Создать: `src/features/orders/orderWatcherSaga.ts`
- Тесты: `orderWatcherSaga.test.ts`

**Интерфейсы:**
- Использует: `tickersUpdated`, `orderPlaced`, `orderCancelled`, `orderFilled`, `portfolioReset`, `selectOpenOrders`.
- Даёт:

```ts
export function crosses(order: Pick<Order, 'side' | 'price'>, last: number): boolean; // buy: last <= price; sell: last >= price
export function* waitForCross(order: Order): SagaIterator<{ at: number }>; // цикл take(tickersUpdated), пока не crosses
export function* watchOrder(deps: Pick<SagaDeps, 'newId'>, order: Order): SagaIterator;
export function* orderWatcherSaga(deps: Pick<SagaDeps, 'newId'>): SagaIterator; // fork watchOrder для каждого selectOpenOrders на старте, затем takeEvery(orderPlaced, (a) => fork(watchOrder, deps, a.payload))
```
`watchOrder`: `race({ fill: call(waitForCross, order), cancel: take(a => orderCancelled.match(a) && a.payload.id === order.id), reset: take(portfolioReset.type) })`; при `fill` → `put(orderFilled({ id: newId(), orderId: order.id, symbol, side, type: 'limit', quantity, price: order.price, executedAt: fill.at }))`.

- [ ] **Шаг 1: Написать падающие тесты**

```ts
it('fills a buy limit when price falls to the limit', async () => { /* orderPlaced buy @ 90; tickersUpdated [BTC 95] → ничего; [BTC 90] → put(orderFilled({ orderId, price: 90, type: 'limit' })) */ });
it('does not fill after cancellation', async () => { /* orderPlaced; orderCancelled(order); tickersUpdated [BTC 10] → not.put.actionType(orderFilled.type) */ });
it('re-spawns watchers for restored orders on start', async () => { /* начальное состояние orders.items [sell @ 110]; tickersUpdated [BTC 110] → orderFilled */ });
it('stops all watchers on portfolioReset', async () => { /* orderPlaced; portfolioReset; пересекающий тик → исполнения нет */ });
it('crosses uses inclusive comparison', () => { expect(crosses({ side: 'buy', price: 90 }, 90)).toBe(true); expect(crosses({ side: 'sell', price: 110 }, 109.99)).toBe(false); });
```

- [ ] **Шаг 2: Запустить** — FAIL. **Шаг 3: Реализовать.** **Шаг 4: Запустить** — PASS.
- [ ] **Шаг 5: Коммит** `feat: per-order watcher saga with fill/cancel race`.

---

### Задача 13: Сага алертов

**Файлы:**
- Создать: `src/features/alerts/alertSaga.ts`
- Тесты: `alertSaga.test.ts`

**Интерфейсы:**
- Использует: `validateAlert`, `alertHit`, экшены алертов, `selectActiveAlerts`, `selectTicker`, `tickersUpdated`, `portfolioReset`.
- Даёт:

```ts
export function* handleAlertRequest(deps: Pick<SagaDeps, 'now' | 'newId'>, action: PayloadAction<AlertRequest>): SagaIterator; // валидация → alertRejected | alertCreated
export function* waitForAlert(alert: Alert): SagaIterator<{ price: number; at: number }>;
export function* watchAlert(alert: Alert): SagaIterator; // race(hit vs alertDeleted(id) vs portfolioReset) → put(alertTriggered({ id, price, at }))
export function* alertSaga(deps: Pick<SagaDeps, 'now' | 'newId'>): SagaIterator; // fork наблюдателей для selectActiveAlerts; takeEvery(alertRequested, handleAlertRequest, deps); takeEvery(alertCreated, a => fork(watchAlert, a.payload))
```

- [ ] **Шаг 1: Написать падающие тесты** — `creates an alert when its condition is not yet true`; `rejects an alert whose condition is already true` (причина `'Price is already above 100.00'`); `triggers once when the level is reached`; `does not trigger after deletion`; `restored alert fires on first live tick past the level`.
- [ ] **Шаг 2: Запустить** — FAIL. **Шаг 3: Реализовать.** **Шаг 4: Запустить** — PASS.
- [ ] **Шаг 5: Коммит** `feat: alert saga with validation and per-alert watchers`.

---

### Задача 14: Уведомления (таймер тостов + триггеры)

**Файлы:**
- Создать: `src/features/notifications/toastSaga.ts`, `src/features/notifications/notificationsSaga.ts`
- Тесты: `toastSaga.test.ts`, `notificationsSaga.test.ts`

**Интерфейсы:**
- Даёт:

```ts
export const TOAST_MS = 6000;
export function* autoDismiss(opts: { toastMs: number }, action: PayloadAction<Toast>): SagaIterator; // race(delay vs toastDismissed(id)); по таймауту put(toastDismissed(id))
export function* toastSaga(opts?: { toastMs: number }): SagaIterator; // takeEvery(toastPushed, autoDismiss, opts)
export function toastForFill(fill: Fill, pair: Pair): Omit<Toast, 'id'>;        // kind 'success', title `Bought 0.01000 BTC @ 67,412.50` / `Sold …`, message 'Limit order filled' | 'Market order'
export function toastForAlert(alert: Alert, price: number, pair: Pair): Omit<Toast, 'id'>; // kind 'warning', title `BTC/USDT is above 70,000.00`, message `Now 70,012.10`
export function toastForRejection(reason: string): Omit<Toast, 'id'>;          // kind 'error', title 'Order rejected', message reason
export function* notificationsSaga(deps: Pick<SagaDeps, 'newId'>): SagaIterator; // takeEvery([orderFilled, alertTriggered, orderRejected, alertRejected]) → put(toastPushed({ id: newId(), ...}))
```

- [ ] **Шаг 1: Написать падающие тесты** — `dismisses after the timeout` (toastMs 5); `does not dismiss twice when closed manually`; `pushes a success toast on orderFilled`; `pushes a warning toast on alertTriggered with the alert looked up by id`; `pushes an error toast on orderRejected`.
- [ ] **Шаг 2: Запустить** — FAIL. **Шаг 3: Реализовать.** **Шаг 4: Запустить** — PASS.
- [ ] **Шаг 5: Коммит** `feat: toast auto-dismiss and notification triggers`.

---

### Задача 15: Сага сохранения и обнаружение внешних изменений

**Файлы:**
- Создать: `src/app/persistenceSaga.ts`
- Тесты: `persistenceSaga.test.ts`

**Интерфейсы:**
- Даёт:

```ts
export const PERSIST_DEBOUNCE_MS = 500;
export const PERSISTED_ACTIONS: string[] = [orderPlaced, orderCancelled, orderFilled, alertCreated, alertDeleted, alertTriggered, pairSelected, intervalChanged, portfolioReset].map(a => a.type);
export function* persist(deps: Pick<SagaDeps, 'storage'>): SagaIterator; // если select(selectExternalChange) → return; иначе call(savePersistedState, storage, select(state))
export function createStorageChannel(target: Pick<Window, 'addEventListener' | 'removeEventListener'>): EventChannel<StorageEvent>;
export function* watchExternalChanges(target): SagaIterator; // take из канала; если event.key === STORAGE_KEY → put(externalChangeDetected()) и return
export function* persistenceSaga(deps: Pick<SagaDeps, 'storage'>, opts?: { debounceMs?: number; target?: Window }): SagaIterator; // fork(watchExternalChanges), debounce(debounceMs, PERSISTED_ACTIONS, persist, deps)
```

- [ ] **Шаг 1: Написать падающие тесты** — `writes once after a burst of actions` (debounceMs 5, три `orderPlaced` → в storage ключ записан один раз, с заявками); `stops persisting after an external change` (dispatch `externalChangeDetected`, затем `orderPlaced` → storage не изменился); `detects a storage event for our key` (фейковый target бросает `StorageEvent` с ключом → `put(externalChangeDetected())`), `ignores other keys`.
- [ ] **Шаг 2: Запустить** — FAIL. **Шаг 3: Реализовать.** **Шаг 4: Запустить** — PASS.
- [ ] **Шаг 5: Коммит** `feat: debounced persistence saga with cross-tab change detection`.

---

### Задача 16: Корневая сага и запуск

**Файлы:**
- Изменить: `src/app/rootSaga.ts`
- Тесты: `src/app/rootSaga.test.ts`

**Интерфейсы:**
- Даёт: `export function* rootSaga(deps: SagaDeps): SagaIterator` — `all([fork(marketStreamSaga, deps), fork(chartSaga, deps), fork(tradeSaga, deps), fork(orderWatcherSaga, deps), fork(alertSaga, deps), fork(toastSaga), fork(notificationsSaga, deps), fork(persistenceSaga, deps)])`, затем `put(appStarted())`.

- [ ] **Шаг 1: Написать падающий тест** — `boots: subscribes tickers, dispatches appStarted and loads the chart` через `createAppStore({ deps: fakeDeps() })`: после `await` одного тика `deps.client.streams` содержит `btcusdt@miniTicker` и `btcusdt@kline_1m`, мок `fetchKlines` вызван один раз с `('BTCUSDT', '1m', 300)`, в состоянии `candles.status` равен `'ready'`.
- [ ] **Шаг 2: Запустить** — FAIL. **Шаг 3: Реализовать.** **Шаг 4: Запустить** `npm run check` — PASS.
- [ ] **Шаг 5: Коммит** `feat: root saga wiring`.

---

### Задача 17: Тема, UI-примитивы, каркас раскладки

**Файлы:**
- Создать: `src/ui/Button.tsx`, `Input.tsx`, `Panel.tsx`, `Tabs.tsx`, `Segmented.tsx`, `src/app/components/BottomPanel.tsx`
- Изменить: `src/index.css`, `src/App.tsx`
- Тесты: `src/ui/Tabs.test.tsx`, `src/App.test.tsx`

**Интерфейсы:**
- Даёт: токены `@theme` в `index.css`: `--color-bg`, `--color-panel`, `--color-panel-2`, `--color-line`, `--color-text`, `--color-muted`, `--color-accent`, `--color-up`, `--color-down`; `--font-sans`, `--font-mono`. Утилиты `tabular` (tabular-nums) и keyframes `flash-up` / `flash-down` (затухание фона 600 мс).
- Пропсы `Button`: `variant?: 'primary' | 'ghost' | 'buy' | 'sell'`, `size?: 'sm' | 'md'`, нативные пропсы кнопки. Пропсы `Input`: `label?`, `suffix?` (например, `USDT`), `error?: string`, нативные пропсы инпута; ошибка рендерится с `role="alert"`. Пропсы `Panel`: `title?`, `right?: ReactNode`, `children`. Пропсы `Tabs`: `tabs: { id: string; label: string; badge?: number }[]`, `active: string`, `onChange(id)`. Пропсы `Segmented`: `options: { value: string; label: string }[]`, `value`, `onChange`.
- Раскладка `App`: `xl:grid-cols-[280px_1fr_320px]` со строками `[1fr_240px]`, ниже `xl` — в столбец; слоты-заглушки для Market / Chart / Trade / Bottom. `BottomPanel` содержит `Tabs` с id `positions | orders | history | alerts` и рендерит активного потомка (потомков даёт задача 21).
- При выборе точной палитры и шрифтов применить скилл frontend-design (спец. §6): почти чёрный фон, тонкие границы, один акцент, зелёный/красный только для движения.

- [ ] **Шаг 1: Написать падающие тесты** — `Tabs calls onChange with the clicked id and marks the active tab with aria-selected`; `App renders the four regions` (по `aria-label`: `Market`, `Chart`, `Trade`, `Portfolio`).
- [ ] **Шаг 2: Запустить** — FAIL. **Шаг 3: Реализовать.** **Шаг 4: Запустить** — PASS.
- [ ] **Шаг 5: Коммит** `feat: theme tokens, UI primitives and layout shell`.

---

### Задача 18: Список пар, фильтр, статус соединения

**Файлы:**
- Создать: `src/features/market/usePriceFlash.ts`, `components/MarketList.tsx`, `MarketRow.tsx`, `MarketFilter.tsx`, `ConnectionStatus.tsx`
- Тесты: `MarketList.test.tsx`, `MarketRow.test.tsx`, `ConnectionStatus.test.tsx`

**Интерфейсы:**
- Использует: `selectTicker`, `selectConnection`, `selectSelection`, `selectFilteredPairs` (задача 8), `pairSelected`.
- `usePriceFlash(last: number | undefined): 'up' | 'down' | null` — сравнивает с предыдущим значением, возвращает направление на 600 мс.
- Пропсы `MarketRow`: `{ symbol: string }`; подписывается на свой тикер через `useAppSelector(selectTicker(symbol))`, обёрнут в `React.memo`; показывает `BTC/USDT`, `formatPrice(last, pricePrecision)`, `formatPct(changePct)` в цвете up/down, `formatCompact(volume)`; приглушается (`opacity-50`), когда соединение не `live`; `aria-selected`, когда выбран; клик → `pairSelected(symbol)`.
- Локальное состояние `MarketFilter` → проп `query` у `MarketList`. `ConnectionStatus` рендерит `Live` / `Reconnecting (attempt N)` / `Offline` / `Connecting` с цветной точкой.

- [ ] **Шаг 1: Написать падающие тесты** — `filters pairs by typed text` (ввести `eth` → только строка ETH); `clicking a row dispatches pairSelected`; `row shows price with pair precision and signed change`; `rows are dimmed when reconnecting`; `status shows attempt number`.
- [ ] **Шаг 2: Запустить** — FAIL. **Шаг 3: Реализовать.** **Шаг 4: Запустить** — PASS.
- [ ] **Шаг 5: Коммит** `feat: market list with filter, price flash and connection status`.

---

### Задача 19: Панель графика

**Файлы:**
- Создать: `src/features/chart/components/ChartPanel.tsx`, `CandleChart.tsx`, `IntervalPicker.tsx`
- Тесты: `ChartPanel.test.tsx`

**Интерфейсы:**
- Пропсы `CandleChart`: `{ candles: Candle[]; status: CandlesState['status'] }`; использует lightweight-charts v5 (`createChart`, `chart.addSeries(CandlestickSeries, { upColor, downColor, … })`), `series.setData`, когда сменилась идентичность массива и отличается длина или время первой свечи, иначе `series.update(last)`; `ResizeObserver` для ширины; тёмные `layout.background`/`textColor` из токенов темы. В тестах замокать `lightweight-charts` (`vi.mock`): `createChart` возвращает `{ addSeries: () => ({ setData, update }), applyOptions, remove, timeScale: () => ({ fitContent }) }`.
- `ChartPanel`: шапка `BTC/USDT  67,412.50  +1.84%` из выбранного тикера, `IntervalPicker` (`Segmented` по `INTERVALS`, диспатчит `intervalChanged`), заметка `History unavailable — showing live candles` при статусе `unavailable`, `Loading…` при `loading`.

- [ ] **Шаг 1: Написать падающие тесты** — `shows selected pair header with price and change`; `interval buttons dispatch intervalChanged`; `shows unavailable note`; `calls setData with candles on mount` (через мок).
- [ ] **Шаг 2: Запустить** — FAIL. **Шаг 3: Реализовать.** **Шаг 4: Запустить** — PASS.
- [ ] **Шаг 5: Коммит** `feat: candlestick chart panel with interval picker`.

---

### Задача 20: Форма торговли

**Файлы:**
- Создать: `src/features/orders/components/TradeForm.tsx`
- Тесты: `TradeForm.test.tsx`

**Интерфейсы:**
- Локальное состояние: `side` (`Segmented` buy/sell), `type` (`Segmented` market/limit), `quantity: string`, `price: string`. Производное: `OrderContext` из селекторов (задача 11), `error = validateOrder(request, ctx)` пересчитывается при каждом рендере; кнопка отправки выключена при `error` (показывается inline под нужным полем, ошибки соединения — над кнопкой), подпись `Buy BTC` / `Sell BTC`, variant buy/sell. Кнопки процентов `25 50 75 100` ставят количество `roundTo(availableQuote * pct / price, qtyPrecision)` для покупки или `roundTo(availableBase * pct, qtyPrecision)` для продажи. Показывает `Cost` / `Proceeds` = `formatUsd(orderCost)` и `Available: 8,765.00 USDT` / `0.01500 BTC`. Отправка → `dispatch(orderRequested(request))`, затем очистка количества. Поле цены лимита предзаполняется последней ценой при переключении на limit.

- [ ] **Шаг 1: Написать падающие тесты** (`renderWithStore` с тикером BTC 100, live) — `submit is disabled with an empty quantity`; `shows "Insufficient USDT" when cost exceeds available`; `percent buttons fill the quantity`; `dispatches orderRequested for a market buy`; `shows connection message and disables submit when reconnecting`; `shows "Buy limit must be below the current price"`.
- [ ] **Шаг 2: Запустить** — FAIL. **Шаг 3: Реализовать.** **Шаг 4: Запустить** — PASS.
- [ ] **Шаг 5: Коммит** `feat: trade form with live validation and percent buttons`.

---

### Задача 21: Таблицы нижней панели и UI алертов

**Файлы:**
- Создать: `src/features/portfolio/components/PositionsTable.tsx`, `TradeHistory.tsx`, `src/features/orders/components/OpenOrdersTable.tsx`, `src/features/alerts/components/AlertsPanel.tsx`, `AlertForm.tsx`
- Изменить: `src/app/components/BottomPanel.tsx` (подключить четыре вкладки; badge = число открытых заявок / активных алертов)
- Тесты: `PositionsTable.test.tsx`, `OpenOrdersTable.test.tsx`, `TradeHistory.test.tsx`, `AlertsPanel.test.tsx`

**Интерфейсы:**
- `PositionsTable`: строки из `selectPositionRows`; колонки Asset, Qty, Avg price, Last, Value, P&L (`+7.69 (+0.77%)` в цвете); пустое состояние `No positions yet`.
- `OpenOrdersTable`: `selectOpenOrders`; колонки Pair, Side, Price, Qty, Placed (`formatTime`), кнопка Cancel → `orderCancelled(order)`; пусто — `No open orders`.
- `TradeHistory`: `selectTrades`; колонки Time, Pair, Side, Type, Qty, Price, Total, Realized; пусто — `No trades yet`.
- `AlertForm`: символ по умолчанию из выбора, `Segmented` above/below, поле цены предзаполнено последней ценой; inline-ошибка из `validateAlert`; отправка → `alertRequested`. `AlertsPanel`: форма + список алертов с `Triggered 14:05:32 @ 70,012.10` или `Waiting`, кнопка удаления → `alertDeleted(id)`.

- [ ] **Шаг 1: Написать падающие тесты** — `renders a position row with pnl from the ticker`; `cancel button dispatches orderCancelled with the order`; `history shows newest first`; `alert form rejects an already-true condition inline`; `delete dispatches alertDeleted`.
- [ ] **Шаг 2: Запустить** — FAIL. **Шаг 3: Реализовать.** **Шаг 4: Запустить** — PASS.
- [ ] **Шаг 5: Коммит** `feat: positions, open orders, history and alerts panels`.

---

### Задача 22: Шапка, сброс, тосты, баннер внешних изменений

**Файлы:**
- Создать: `src/features/portfolio/components/EquityHeader.tsx`, `ResetPortfolioButton.tsx`, `src/features/notifications/components/ToastStack.tsx`, `src/app/components/ExternalChangeBanner.tsx`
- Изменить: `src/App.tsx` (смонтировать все области: `MarketList`, `ChartPanel`, `TradeForm`, `BottomPanel`, `EquityHeader`, `ConnectionStatus`, `ToastStack`, `ExternalChangeBanner`)
- Тесты: `EquityHeader.test.tsx`, `ToastStack.test.tsx`, `ExternalChangeBanner.test.tsx`

**Интерфейсы:**
- `EquityHeader`: `Equity 10,120.00 USDT · Realized +20.00` из `selectEquity`/`selectRealizedPnl`, название приложения, `ResetPortfolioButton` (в два шага: клик показывает `Reset to 10,000 USDT?` с Confirm/Cancel; подтверждение → `portfolioReset()`).
- `ToastStack`: фиксированно справа снизу, `role="status"`, каждый тост с цветом по kind, заголовком, сообщением, кнопкой закрытия → `toastDismissed(id)`.
- `ExternalChangeBanner`: виден при `app.externalChange`; текст `This terminal was changed in another tab. Reload to sync.` с кнопкой Reload (`location.reload()`).

- [ ] **Шаг 1: Написать падающие тесты** — `equity sums quote and positions`; `reset asks for confirmation then dispatches portfolioReset`; `close button dismisses a toast`; `banner appears only after externalChangeDetected`.
- [ ] **Шаг 2: Запустить** — FAIL. **Шаг 3: Реализовать.** **Шаг 4: Запустить** `npm run check` — PASS.
- [ ] **Шаг 5: Коммит** `feat: equity header, reset, toasts and cross-tab banner`.

---

### Задача 23: Интеграция, README, CI, инструкция по деплою

**Файлы:**
- Создать: `.github/workflows/deploy.yml`, `docs/screenshots/` (хотя бы один PNG работающего приложения), `README.md` (заменить заглушку)
- Изменить: `src/App.test.tsx` (интеграционный smoke с фейковым клиентом)
- Тесты: `src/App.integration.test.tsx`

**Интерфейсы:**
- `deploy.yml`: по push в `main`; `actions/checkout@v4`, `actions/setup-node@v4` (node 24, cache npm), `npm ci`, `npm run check`, `npm run build`, `actions/upload-pages-artifact@v3` (`dist`), `actions/deploy-pages@v4`; `permissions: { pages: write, id-token: write, contents: read }`.
- Разделы README (спец. §7): питч, живая ссылка `https://oleksiishcherbynin.github.io/crypto-terminal/`, скриншот, возможности, архитектура (папки фич + поток данных), таблица **Saga patterns** (скопировать спец. §5.3 со ссылками на файлы), команды запуска и тестов, ограничения (paper trading, без комиссий, региональная доступность Binance, одна вкладка), шаги деплоя для владельца: создать репозиторий `OleksiiShcherbynin/crypto-terminal` на GitHub, запушить `main`, Settings → Pages → Source: GitHub Actions.

- [ ] **Шаг 1: Написать интеграционный тест** — `createAppStore({ deps: fakeDeps() })` с настоящими сагами, отрендерить `<App/>`, `client.emit({ type: 'open' })`, эмитить тикер BTC по 100, `await screen.findAllByText('100.00')` (строка и шапка графика); ввести количество `0.1`, нажать `Buy BTC`, `await findByText(/Bought 0.10000 BTC/)`; шапка капитала показывает `10,000.00`; статус показывает `Live`.
- [ ] **Шаг 2: Запустить** — FAIL, пока не починены проблемы сборки воедино; починить. **Шаг 3:** запустить приложение `npm run dev`, открыть `http://localhost:5173/crypto-terminal/`, проверить живые цены, рыночную покупку, лимитку, которая исполняется, тост алерта, перезагрузку с сохранением состояния; сделать `docs/screenshots/terminal.png`.
- [ ] **Шаг 4: Написать README и workflow;** выполнить `npm run build` и `npm run preview`, открыть URL превью и убедиться, что ассеты грузятся под `/crypto-terminal/`.
- [ ] **Шаг 5: Запустить** `npm run check` — PASS. **Коммит** `docs: README, screenshots and GitHub Pages workflow`.
- [ ] **Шаг 6:** Отчитаться владельцу: репозиторий готов к пушу; перечислить три ручных шага (создать репозиторий, запушить, включить Pages).
