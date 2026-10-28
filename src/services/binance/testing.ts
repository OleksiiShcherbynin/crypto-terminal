import type { SocketClient, SocketEvent } from './socketClient';

/** Minimal in-memory WebSocket for tests. Assign to `WebSocketImpl` via a cast. */
export class FakeWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  static instances: FakeWebSocket[] = [];

  url: string;
  sent: string[] = [];
  readyState: number = FakeWebSocket.CONNECTING;
  onopen: ((ev: Event) => void) | null = null;
  onmessage: ((ev: MessageEvent) => void) | null = null;
  onclose: ((ev: CloseEvent) => void) | null = null;
  onerror: ((ev: Event) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    FakeWebSocket.instances.push(this);
  }

  send(data: string): void {
    this.sent.push(data);
  }

  /** Like a real socket, does not fire onclose synchronously. */
  close(): void {
    this.readyState = FakeWebSocket.CLOSED;
  }

  emitOpen(): void {
    this.readyState = FakeWebSocket.OPEN;
    this.onopen?.(new Event('open'));
  }

  emitMessage(raw: string): void {
    this.onmessage?.({ data: raw } as MessageEvent);
  }

  emitClose(code: number): void {
    this.readyState = FakeWebSocket.CLOSED;
    this.onclose?.({ code } as CloseEvent);
  }

  emitError(): void {
    this.onerror?.(new Event('error'));
  }
}

export function createFakeSocketClient(): SocketClient & {
  emit(e: SocketEvent): void;
  openedHosts: string[];
  closeCount: number;
} {
  const listeners: Array<(e: SocketEvent) => void> = [];
  const streams = new Set<string>();
  const fake = {
    streams,
    openedHosts: [] as string[],
    closeCount: 0,
    open(host: string) {
      fake.openedHosts.push(host);
    },
    close() {
      fake.closeCount++;
    },
    subscribe(list: string[]) {
      list.forEach((s) => streams.add(s));
    },
    unsubscribe(list: string[]) {
      list.forEach((s) => streams.delete(s));
    },
    listen(listener: (e: SocketEvent) => void) {
      listeners.push(listener);
      return () => {
        const i = listeners.indexOf(listener);
        if (i >= 0) listeners.splice(i, 1);
      };
    },
    emit(e: SocketEvent) {
      for (const l of [...listeners]) l(e);
    },
  };
  return fake;
}
