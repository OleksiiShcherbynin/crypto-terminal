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

/** Tries hosts in order; a network error, non-OK status or malformed body moves to the next host. */
export async function fetchKlines(
  symbol: string,
  interval: Interval,
  limit: number,
  deps: { fetchImpl?: typeof fetch; hosts?: readonly string[] } = {},
): Promise<Candle[]> {
  const fetchImpl = deps.fetchImpl ?? ((...args) => globalThis.fetch(...args));
  const hosts = deps.hosts ?? REST_HOSTS;
  for (const host of hosts) {
    try {
      const res = await fetchImpl(
        `https://${host}/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`,
      );
      if (!res.ok) continue;
      const body: unknown = await res.json();
      if (!Array.isArray(body)) continue;
      return body.map(toCandle);
    } catch {
      // try next host
    }
  }
  throw new Error('klines unavailable');
}
