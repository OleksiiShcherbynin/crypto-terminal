import { describe, expect, it, vi } from 'vitest';
import { fetchKlines } from './rest';

const rows = [[1700000000000, '1', '2', '0.5', '1.5', '10', 0]];
const ok = () => new Response(JSON.stringify(rows));
const expected = [{ time: 1700000000, open: 1, high: 2, low: 0.5, close: 1.5, volume: 10 }];

describe('fetchKlines', () => {
  it('maps kline rows to candles', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(ok());
    expect(await fetchKlines('BTCUSDT', '1m', 1, { fetchImpl, hosts: ['h'] })).toEqual(expected);
    expect(fetchImpl.mock.calls[0][0]).toBe(
      'https://h/api/v3/klines?symbol=BTCUSDT&interval=1m&limit=1',
    );
  });

  it('falls back to the second host when the first rejects', async () => {
    const fetchImpl = vi.fn().mockRejectedValueOnce(new Error('net')).mockResolvedValueOnce(ok());
    expect(await fetchKlines('BTCUSDT', '1m', 1, { fetchImpl, hosts: ['a', 'b'] })).toEqual(
      expected,
    );
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('treats a non-OK status as a host failure', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response('x', { status: 503 }))
      .mockResolvedValueOnce(ok());
    expect(await fetchKlines('BTCUSDT', '1m', 1, { fetchImpl, hosts: ['a', 'b'] })).toEqual(
      expected,
    );
  });

  it('throws when all hosts fail', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('net'));
    await expect(fetchKlines('BTCUSDT', '1m', 1, { fetchImpl, hosts: ['a', 'b'] })).rejects.toThrow(
      'klines unavailable',
    );
  });

  it('treats a malformed body as a host failure', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('{"code":-1}'));
    await expect(fetchKlines('BTCUSDT', '1m', 1, { fetchImpl, hosts: ['a'] })).rejects.toThrow(
      'klines unavailable',
    );
  });
});
