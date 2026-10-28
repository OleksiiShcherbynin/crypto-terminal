import { parseStreamMessage, type MarketEvent } from './parse';

export type SocketEvent =
  | { type: 'open' }
  | { type: 'message'; event: MarketEvent }
  | { type: 'close'; code: number }
  | { type: 'error' };

export interface SocketClient {
  readonly streams: ReadonlySet<string>;
  /** Closes any previous socket first; its late events are ignored. */
  open(host: string): void;
  /** Explicit close: emits no 'close' event to listeners. */
  close(): void;
  subscribe(streams: string[]): void;
  unsubscribe(streams: string[]): void;
  listen(listener: (e: SocketEvent) => void): () => void;
}

const OPEN = 1;

export function createSocketClient(
  deps: { WebSocketImpl?: typeof WebSocket; now?: () => number } = {},
): SocketClient {
  const WebSocketImpl = deps.WebSocketImpl ?? globalThis.WebSocket;
  const now = deps.now ?? Date.now;
  const streams = new Set<string>();
  const listeners: Array<(e: SocketEvent) => void> = [];
  let socket: WebSocket | null = null;
  let nextId = 1;

  const emit = (e: SocketEvent) => {
    for (const l of [...listeners]) l(e);
  };

  const detach = () => {
    const prev = socket;
    socket = null;
    if (prev) {
      try {
        prev.close();
      } catch {
        // already closed
      }
    }
  };

  const send = (method: 'SUBSCRIBE' | 'UNSUBSCRIBE', params: string[]) => {
    if (socket && socket.readyState === OPEN && params.length > 0) {
      socket.send(JSON.stringify({ method, params, id: nextId++ }));
    }
  };

  return {
    streams,
    open(host) {
      detach();
      const ws = new WebSocketImpl(`wss://${host}/stream?streams=${[...streams].join('/')}`);
      socket = ws;
      // Handlers check identity so a replaced/closed socket can never reach listeners.
      ws.onopen = () => {
        if (socket === ws) emit({ type: 'open' });
      };
      ws.onmessage = (m: MessageEvent) => {
        if (socket !== ws) return;
        const event = parseStreamMessage(String(m.data), now);
        if (event) emit({ type: 'message', event });
      };
      ws.onerror = () => {
        if (socket === ws) emit({ type: 'error' });
      };
      ws.onclose = (c: CloseEvent) => {
        if (socket !== ws) return;
        socket = null;
        emit({ type: 'close', code: c.code });
      };
    },
    close() {
      detach();
    },
    subscribe(list) {
      const added = list.filter((s) => !streams.has(s));
      added.forEach((s) => streams.add(s));
      send('SUBSCRIBE', added);
    },
    unsubscribe(list) {
      const known = list.filter((s) => streams.has(s));
      known.forEach((s) => streams.delete(s));
      send('UNSUBSCRIBE', known);
    },
    listen(listener) {
      listeners.push(listener);
      return () => {
        const i = listeners.indexOf(listener);
        if (i >= 0) listeners.splice(i, 1);
      };
    },
  };
}
