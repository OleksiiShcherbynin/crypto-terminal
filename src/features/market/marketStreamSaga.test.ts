import { expectSaga } from 'redux-saga-test-plan';
import type { PutEffect } from 'redux-saga/effects';
import { describe, expect, it, vi } from 'vitest';
import { WATCHED_PAIRS } from '../../domain/pairs';
import type { SocketClient, SocketEvent } from '../../services/binance/socketClient';
import { c, fakeDeps, t } from '../../test/fixtures';
import { candleReceived } from '../chart/candlesSlice';
import { connectionStatusChanged } from './connectionSlice';
import {
  CHANNEL_BUFFER,
  backoffMs,
  createSocketChannel,
  marketStreamSaga,
  streamStopped,
  type StreamOptions,
} from './marketStreamSaga';
import { tickersUpdated } from './tickersSlice';

const OPTS: StreamOptions = { batchMs: 5, silenceMs: 40, backoff: () => 1, now: Date.now };
// For tests where silence is not the subject: a slow CI timer must not trigger a reconnect.
const STEADY: StreamOptions = { ...OPTS, silenceMs: 10_000 };

const later = (ms: number, fn: () => void) => setTimeout(fn, ms);

const tickerEvent = (symbol: string, last: number): SocketEvent => ({
  type: 'message',
  event: { kind: 'ticker', ticker: t(symbol, last) },
});

/** Counts how often the channel's unsubscribe (returned by `client.listen`) runs. */
function trackUnsubscribe(client: SocketClient) {
  const unsubscribed = vi.fn();
  const listen = client.listen;
  client.listen = (listener) => {
    const off = listen(listener);
    return () => {
      unsubscribed();
      off();
    };
  };
  return unsubscribed;
}

describe('marketStreamSaga', () => {
  it('subscribes every watched pair once', async () => {
    const deps = fakeDeps();
    await expectSaga(marketStreamSaga, deps, STEADY).silentRun(20);
    expect(deps.client.streams.size).toBe(WATCHED_PAIRS.length);
    expect(deps.client.streams.has('btcusdt@miniTicker')).toBe(true);
    expect(deps.client.openedHosts[0]).toBe(deps.wsHosts[0]);
  });

  it('goes live and batches tickers, keeping the latest per symbol', async () => {
    const deps = fakeDeps();
    later(10, () => {
      deps.client.emit({ type: 'open' });
      deps.client.emit(tickerEvent('BTCUSDT', 1));
      deps.client.emit(tickerEvent('BTCUSDT', 2));
      deps.client.emit(tickerEvent('ETHUSDT', 3));
    });
    const result = await expectSaga(marketStreamSaga, deps, STEADY)
      .put(connectionStatusChanged({ status: 'connecting', attempt: 0 }))
      .put(connectionStatusChanged({ status: 'live', attempt: 0 }))
      .put(tickersUpdated([t('BTCUSDT', 2), t('ETHUSDT', 3)]))
      .silentRun(100);
    // One window, one put: the intermediate BTC tick never reaches the store.
    const tickerPuts = result.allEffects
      .filter((e): e is PutEffect => e.type === 'PUT')
      .map((e) => e.payload.action)
      .filter(tickersUpdated.match);
    expect(tickerPuts).toHaveLength(1);
  });

  it('reconnects after close with incremented attempt', async () => {
    const deps = fakeDeps();
    later(10, () => deps.client.emit({ type: 'open' }));
    later(20, () => deps.client.emit({ type: 'close', code: 1006 }));
    await expectSaga(marketStreamSaga, deps, STEADY)
      .put(connectionStatusChanged({ status: 'connecting', attempt: 0 }))
      .put(connectionStatusChanged({ status: 'live', attempt: 0 }))
      .put(connectionStatusChanged({ status: 'reconnecting', attempt: 1 }))
      .silentRun(100);
    expect(deps.client.openedHosts.length).toBeGreaterThanOrEqual(2);
  });

  it('reaches offline after five failed attempts', async () => {
    const deps = fakeDeps();
    const open = deps.client.open;
    deps.client.open = (host) => {
      open(host);
      queueMicrotask(() => deps.client.emit({ type: 'close', code: 1006 }));
    };
    await expectSaga(marketStreamSaga, deps, STEADY)
      .put(connectionStatusChanged({ status: 'reconnecting', attempt: 4 }))
      .put(connectionStatusChanged({ status: 'offline', attempt: 5 }))
      .not.put(connectionStatusChanged({ status: 'live', attempt: 0 }))
      .silentRun(200);
    // Attempt 2 onwards alternates hosts, starting with the fallback.
    expect(deps.client.openedHosts.slice(0, 4)).toEqual([
      deps.wsHosts[0],
      deps.wsHosts[0],
      deps.wsHosts[1],
      deps.wsHosts[0],
    ]);
  });

  it('restarts from attempt 1 after a connection that worked drops', async () => {
    const deps = fakeDeps();
    const open = deps.client.open;
    let opens = 0;
    deps.client.open = (host) => {
      open(host);
      opens += 1;
      // First connection fails outright; the second goes live, then drops.
      if (opens === 1) queueMicrotask(() => deps.client.emit({ type: 'close', code: 1006 }));
      if (opens === 2)
        queueMicrotask(() => {
          deps.client.emit({ type: 'open' });
          deps.client.emit({ type: 'close', code: 1006 });
        });
    };
    const result = await expectSaga(marketStreamSaga, deps, STEADY)
      .put(connectionStatusChanged({ status: 'live', attempt: 0 }))
      .not.put(connectionStatusChanged({ status: 'reconnecting', attempt: 2 }))
      .silentRun(150);
    const reconnects = result.allEffects
      .filter((e): e is PutEffect => e.type === 'PUT')
      .map((e) => e.payload.action)
      .filter((a) => connectionStatusChanged.match(a) && a.payload.status === 'reconnecting');
    expect(reconnects).toEqual([
      connectionStatusChanged({ status: 'reconnecting', attempt: 1 }),
      connectionStatusChanged({ status: 'reconnecting', attempt: 1 }),
    ]);
  });

  it('treats silence as a dead connection', async () => {
    const deps = fakeDeps();
    later(10, () => deps.client.emit({ type: 'open' }));
    await expectSaga(marketStreamSaga, deps, OPTS)
      .put(connectionStatusChanged({ status: 'live', attempt: 0 }))
      .put(connectionStatusChanged({ status: 'reconnecting', attempt: 1 }))
      .silentRun(200);
    expect(deps.client.openedHosts.length).toBeGreaterThanOrEqual(2);
    // The silent socket is still open, so the saga closes it before reopening.
    expect(deps.client.closeCount).toBeGreaterThanOrEqual(1);
  });

  it('forwards candles immediately', async () => {
    const deps = fakeDeps();
    const candle = c(60, 101);
    later(10, () =>
      deps.client.emit({
        type: 'message',
        event: { kind: 'candle', symbol: 'BTCUSDT', interval: '1m', candle },
      }),
    );
    await expectSaga(marketStreamSaga, deps, STEADY)
      .put(candleReceived({ symbol: 'BTCUSDT', interval: '1m', candle }))
      .silentRun(50);
  });

  it('stops on streamStopped and closes the client', async () => {
    const deps = fakeDeps();
    const unsubscribed = trackUnsubscribe(deps.client);
    await expectSaga(marketStreamSaga, deps, STEADY)
      .delay(20)
      .dispatch(streamStopped())
      .run({ timeout: 500 });
    expect(deps.client.closeCount).toBe(1);
    expect(unsubscribed).toHaveBeenCalledTimes(1);
  });

  it('closes the channel and the client when cancelled', async () => {
    const deps = fakeDeps();
    const unsubscribed = trackUnsubscribe(deps.client);
    // silentRun cancels the still-running saga when the timeout elapses.
    await expectSaga(marketStreamSaga, deps, STEADY).silentRun(20);
    expect(deps.client.closeCount).toBe(1);
    expect(unsubscribed).toHaveBeenCalledTimes(1);
  });

  it('backoffMs doubles to a 30 s cap', () =>
    expect([1, 2, 3, 6].map(backoffMs)).toEqual([1000, 2000, 4000, 30000]));
});

describe('createSocketChannel', () => {
  it('drops the oldest events once the sliding buffer is full', async () => {
    const client = fakeDeps().client;
    const channel = createSocketChannel(client);
    for (let i = 0; i <= CHANNEL_BUFFER; i++) client.emit({ type: 'close', code: i });
    const events = await new Promise<SocketEvent[]>((resolve) =>
      channel.flush((input) => resolve(Array.isArray(input) ? input : [])),
    );
    expect(events).toHaveLength(CHANNEL_BUFFER);
    expect(events[0]).toEqual({ type: 'close', code: 1 });
    channel.close();
  });
});
