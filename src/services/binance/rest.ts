import type { Candle, Interval } from '../../domain/types';
import { REST_HOSTS } from './hosts';

function toCandle(row: unknown): Candle {
  if (!Array.isArray(row) || row.length < 6) throw new Error('bad kline row');
  const candle = {
    time: Math.floor(Number(row[0]) / 1000),
    open: Number(row[1]),
    high: Number(row[2]),
    low: Number(row[3]),
    close: Number(row[4]),
    volume: Number(row[5]),
  };
  if (Object.values(candle).some((n) => Number.isNaN(n))) throw new Error('bad kline row');
  return candle;
}

/** Per-host budget: a host that has not answered by then counts as failed. */
export const KLINES_TIMEOUT_MS = 8_000;

function abortError(signal: AbortSignal): unknown {
  return signal.reason ?? new DOMException('The operation was aborted.', 'AbortError');
}

function timeoutSignal(ms: number): AbortSignal {
  if (typeof AbortSignal.timeout === 'function') return AbortSignal.timeout(ms);
  const controller = new AbortController();
  setTimeout(() => controller.abort(new DOMException('Timed out', 'TimeoutError')), ms);
  return controller.signal;
}

/** Aborts as soon as any input aborts (AbortSignal.any where available). */
function anySignal(signals: AbortSignal[]): AbortSignal {
  if (typeof AbortSignal.any === 'function') return AbortSignal.any(signals);
  const controller = new AbortController();
  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort(signal.reason);
      break;
    }
    signal.addEventListener('abort', () => controller.abort(signal.reason), { once: true });
  }
  return controller.signal;
}

export interface FetchKlinesDeps {
  fetchImpl?: typeof fetch;
  hosts?: readonly string[];
  /** Caller cancellation: stops at once, without trying further hosts. */
  signal?: AbortSignal;
  timeoutMs?: number;
}

/**
 * Tries hosts in order; a network error, timeout, non-OK status or malformed body moves to the
 * next host. An abort by the caller rethrows immediately.
 */
export async function fetchKlines(
  symbol: string,
  interval: Interval,
  limit: number,
  deps: FetchKlinesDeps = {},
): Promise<Candle[]> {
  const fetchImpl = deps.fetchImpl ?? ((...args) => globalThis.fetch(...args));
  const hosts = deps.hosts ?? REST_HOSTS;
  const { signal } = deps;
  const timeoutMs = deps.timeoutMs ?? KLINES_TIMEOUT_MS;
  for (const host of hosts) {
    if (signal?.aborted) throw abortError(signal);
    const timeout = timeoutSignal(timeoutMs);
    try {
      const res = await fetchImpl(
        `https://${host}/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`,
        { signal: signal ? anySignal([signal, timeout]) : timeout },
      );
      if (!res.ok) continue;
      const body: unknown = await res.json();
      if (!Array.isArray(body)) continue;
      return body.map(toCandle);
    } catch {
      if (signal?.aborted) throw abortError(signal);
      // otherwise: try next host
    }
  }
  throw new Error('klines unavailable');
}
