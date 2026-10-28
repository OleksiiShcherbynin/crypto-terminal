export const WS_HOSTS = ['data-stream.binance.vision', 'stream.binance.com:9443'] as const;
export const REST_HOSTS = ['data-api.binance.vision', 'api.binance.com'] as const;

/** Primary host for the first two attempts, then alternate starting with the fallback. */
export function pickHost(hosts: readonly string[], attempt: number): string {
  return attempt < 2 ? hosts[0] : hosts[(attempt - 1) % hosts.length];
}
