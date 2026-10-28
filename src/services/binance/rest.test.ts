import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

  describe('timeouts and cancellation', () => {
    /** A host that never answers; it settles only when its request signal aborts. */
    const hanging = (_url: string, init?: RequestInit) =>
      new Promise<Response>((_, reject) => {
        init?.signal?.addEventListener('abort', () => reject(init.signal?.reason));
      });

    it('falls back to the next host when the first one hangs past the timeout', async () => {
      const fetchImpl = vi
        .fn<typeof fetch>()
        .mockImplementationOnce((url, init) => hanging(String(url), init))
        .mockResolvedValueOnce(ok());
      expect(
        await fetchKlines('BTCUSDT', '1m', 1, { fetchImpl, hosts: ['a', 'b'], timeoutMs: 20 }),
      ).toEqual(expected);
      expect(fetchImpl).toHaveBeenCalledTimes(2);
    });

    it('passes a signal to every request', async () => {
      const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(ok());
      await fetchKlines('BTCUSDT', '1m', 1, { fetchImpl, hosts: ['h'] });
      expect(fetchImpl.mock.calls[0][1]?.signal).toBeInstanceOf(AbortSignal);
    });

    it('stops at the first host and rethrows when the caller aborts', async () => {
      const controller = new AbortController();
      const fetchImpl = vi.fn<typeof fetch>((url, init) => hanging(String(url), init));
      const pending = fetchKlines('BTCUSDT', '1m', 1, {
        fetchImpl,
        hosts: ['a', 'b'],
        signal: controller.signal,
      });
      controller.abort();
      await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    });

    describe('without native AbortSignal.timeout / AbortSignal.any', () => {
      const native = { timeout: AbortSignal.timeout, any: AbortSignal.any };
      beforeEach(() => {
        Reflect.set(AbortSignal, 'timeout', undefined);
        Reflect.set(AbortSignal, 'any', undefined);
      });
      afterEach(() => {
        Reflect.set(AbortSignal, 'timeout', native.timeout);
        Reflect.set(AbortSignal, 'any', native.any);
        vi.restoreAllMocks();
      });

      it('still falls back when a host hangs past the timeout', async () => {
        const fetchImpl = vi
          .fn<typeof fetch>()
          .mockImplementationOnce((url, init) => hanging(String(url), init))
          .mockResolvedValueOnce(ok());
        expect(
          await fetchKlines('BTCUSDT', '1m', 1, { fetchImpl, hosts: ['a', 'b'], timeoutMs: 20 }),
        ).toEqual(expected);
      });

      it('clears its timer and caller listener after every host', async () => {
        const controller = new AbortController();
        const clear = vi.spyOn(globalThis, 'clearTimeout');
        const remove = vi.spyOn(controller.signal, 'removeEventListener');
        const fetchImpl = vi
          .fn<typeof fetch>()
          .mockRejectedValueOnce(new Error('net'))
          .mockResolvedValueOnce(ok());
        await fetchKlines('BTCUSDT', '1m', 1, {
          fetchImpl,
          hosts: ['a', 'b'],
          signal: controller.signal,
        });
        expect(clear).toHaveBeenCalledTimes(2);
        expect(remove).toHaveBeenCalledTimes(2);
      });
    });

    it('does not start a request when the caller already aborted', async () => {
      const controller = new AbortController();
      controller.abort();
      const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(ok());
      await expect(
        fetchKlines('BTCUSDT', '1m', 1, { fetchImpl, hosts: ['a'], signal: controller.signal }),
      ).rejects.toMatchObject({ name: 'AbortError' });
      expect(fetchImpl).not.toHaveBeenCalled();
    });
  });
});
