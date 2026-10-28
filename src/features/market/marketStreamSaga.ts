import { createAction } from '@reduxjs/toolkit';
import { buffers, eventChannel, type EventChannel, type SagaIterator } from 'redux-saga';
import { call, cancelled, delay, flush, put, race, take } from 'redux-saga/effects';
import type { SagaDeps } from '../../app/store';
import { WATCHED_PAIRS, miniTickerStream } from '../../domain/pairs';
import type { Ticker } from '../../domain/types';
import { pickHost } from '../../services/binance/hosts';
import type { SocketClient, SocketEvent } from '../../services/binance/socketClient';
import { candleReceived } from '../chart/candlesSlice';
import { connectionStatusChanged } from './connectionSlice';
import { tickersUpdated } from './tickersSlice';

export const BATCH_MS = 250,
  SILENCE_MS = 30_000,
  MAX_BACKOFF_MS = 30_000,
  OFFLINE_AFTER_ATTEMPTS = 5,
  CHANNEL_BUFFER = 2000;

export const streamStopped = createAction('market/streamStopped');

/** 1 s doubling per attempt, capped at 30 s: 1 → 1000, 2 → 2000, 6 → 30000. */
export function backoffMs(attempt: number): number {
  return Math.min(1000 * 2 ** (attempt - 1), MAX_BACKOFF_MS);
}

/** Bridges socket callbacks into the saga world; a burst never grows memory past the buffer. */
export function createSocketChannel(client: SocketClient): EventChannel<SocketEvent> {
  return eventChannel<SocketEvent>(
    (emit) => client.listen(emit),
    buffers.sliding<SocketEvent>(CHANNEL_BUFFER),
  );
}

export interface StreamOptions {
  batchMs: number;
  silenceMs: number;
  backoff: (attempt: number) => number;
  now: () => number;
}

export type StreamOutcome = { outcome: 'closed' | 'silent' | 'stopped'; opened: boolean };

/**
 * Drains one connection in fixed batch windows until it closes, goes silent or is stopped.
 * Tickers are coalesced per window (latest per symbol); candles are forwarded as they arrive.
 */
export function* consumeStream(
  channel: EventChannel<SocketEvent>,
  opts: StreamOptions,
): SagaIterator<StreamOutcome> {
  let opened = false;
  let lastMessageAt = opts.now();
  while (true) {
    const { stop }: { tick?: true; stop?: ReturnType<typeof streamStopped> } = yield race({
      tick: delay(opts.batchMs),
      stop: take(streamStopped.type),
    });
    if (stop) return { outcome: 'stopped', opened };

    const events: SocketEvent[] = yield flush(channel);
    const batch = new Map<string, Ticker>();
    let closed = false;
    for (const e of events) {
      if (e.type === 'close' || e.type === 'error') {
        closed = true;
        break;
      }
      if (e.type === 'open') {
        opened = true;
        lastMessageAt = opts.now();
        yield put(connectionStatusChanged({ status: 'live', attempt: 0 }));
        continue;
      }
      lastMessageAt = opts.now();
      const event = e.event;
      if (event.kind === 'ticker') {
        batch.set(event.ticker.symbol, event.ticker);
      } else {
        const { symbol, interval, candle } = event;
        yield put(candleReceived({ symbol, interval, candle }));
      }
    }
    // Ticks received before a close are still valid prices, so they are published either way.
    if (batch.size > 0) yield put(tickersUpdated([...batch.values()]));
    if (closed) return { outcome: 'closed', opened };
    if (opts.now() - lastMessageAt > opts.silenceMs) return { outcome: 'silent', opened };
  }
}

function connectionStatus(attempt: number) {
  const status =
    attempt === 0 ? 'connecting' : attempt >= OFFLINE_AFTER_ATTEMPTS ? 'offline' : 'reconnecting';
  return connectionStatusChanged({ status, attempt });
}

/**
 * Owns the market socket: subscribes the watched pairs, then connects, consumes and reconnects
 * with exponential backoff, alternating hosts, until stopped or cancelled.
 */
export function* marketStreamSaga(
  deps: Pick<SagaDeps, 'client' | 'wsHosts' | 'now'>,
  opts: Partial<StreamOptions> = {},
): SagaIterator {
  const options: StreamOptions = {
    batchMs: BATCH_MS,
    silenceMs: SILENCE_MS,
    backoff: backoffMs,
    now: deps.now,
    ...opts,
  };
  const { client, wsHosts } = deps;
  const channel: EventChannel<SocketEvent> = yield call(createSocketChannel, client);
  try {
    yield call(
      [client, client.subscribe],
      WATCHED_PAIRS.map((p) => miniTickerStream(p.symbol)),
    );
    let attempt = 0;
    while (true) {
      yield put(connectionStatus(attempt));
      yield call([client, client.open], pickHost(wsHosts, attempt));
      const { outcome, opened }: StreamOutcome = yield call(consumeStream, channel, options);
      if (outcome === 'stopped') {
        channel.close();
        yield call([client, client.close]);
        return;
      }
      // A silent socket is still open; a closed one is already gone.
      if (outcome === 'silent') yield call([client, client.close]);
      // A connection that worked and then dropped starts again from attempt 1.
      if (opened) attempt = 0;
      attempt += 1;
      yield delay(options.backoff(attempt));
    }
  } finally {
    const wasCancelled: boolean = yield cancelled();
    if (wasCancelled) {
      channel.close();
      yield call([client, client.close]);
    }
  }
}
