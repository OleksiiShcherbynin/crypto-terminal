import { beforeEach, describe, expect, it } from 'vitest';
import { createSocketClient, type SocketClient, type SocketEvent } from './socketClient';
import { FakeWebSocket, createFakeSocketClient } from './testing';

const tickerRaw = JSON.stringify({
  stream: 'btcusdt@miniTicker',
  data: {
    e: '24hrMiniTicker',
    E: 1,
    s: 'BTCUSDT',
    c: '101',
    o: '100',
    h: '102',
    l: '99',
    v: '10',
    q: '1000',
  },
});

let client: SocketClient;
let events: SocketEvent[];

beforeEach(() => {
  FakeWebSocket.instances = [];
  client = createSocketClient({
    WebSocketImpl: FakeWebSocket as unknown as typeof WebSocket,
    now: () => 7,
  });
  events = [];
  client.listen((e) => events.push(e));
});

describe('socketClient', () => {
  it('opens a combined-stream url from held streams', () => {
    client.subscribe(['btcusdt@miniTicker', 'ethusdt@miniTicker']);
    client.open('h');
    expect(FakeWebSocket.instances[0].url).toBe(
      'wss://h/stream?streams=btcusdt@miniTicker/ethusdt@miniTicker',
    );
  });

  it('sends SUBSCRIBE and UNSUBSCRIBE when open', () => {
    client.open('h');
    const ws = FakeWebSocket.instances[0];
    ws.emitOpen();
    client.subscribe(['btcusdt@kline_1m']);
    expect(JSON.parse(ws.sent[0])).toEqual({
      method: 'SUBSCRIBE',
      params: ['btcusdt@kline_1m'],
      id: 1,
    });
    client.unsubscribe(['btcusdt@kline_1m', 'unknown']);
    expect(JSON.parse(ws.sent[1])).toEqual({
      method: 'UNSUBSCRIBE',
      params: ['btcusdt@kline_1m'],
      id: 2,
    });
    expect([...client.streams]).toEqual([]);
  });

  it('does not send before the socket is open', () => {
    client.open('h');
    client.subscribe(['a@miniTicker']);
    expect(FakeWebSocket.instances[0].sent).toEqual([]);
  });

  it('forwards open, parsed messages, errors and close to listeners', () => {
    client.open('h');
    const ws = FakeWebSocket.instances[0];
    ws.emitOpen();
    ws.emitMessage(tickerRaw);
    ws.emitMessage('{"result":null,"id":1}');
    ws.emitError();
    ws.emitClose(1006);
    expect(events).toEqual([
      { type: 'open' },
      {
        type: 'message',
        event: {
          kind: 'ticker',
          ticker: {
            symbol: 'BTCUSDT',
            last: 101,
            open: 100,
            high: 102,
            low: 99,
            volume: 10,
            changePct: 1,
            receivedAt: 7,
          },
        },
      },
      { type: 'error' },
      { type: 'close', code: 1006 },
    ]);
  });

  it('re-opening closes the previous socket and resubscribes all streams', () => {
    client.subscribe(['btcusdt@miniTicker']);
    client.open('a');
    client.open('b');
    expect(FakeWebSocket.instances[0].readyState).toBe(FakeWebSocket.CLOSED);
    expect(FakeWebSocket.instances[1].url).toBe('wss://b/stream?streams=btcusdt@miniTicker');
  });

  it('ignores events from a replaced socket', () => {
    client.open('a');
    const old = FakeWebSocket.instances[0];
    client.open('b');
    old.emitClose(1000);
    old.emitMessage(tickerRaw);
    old.emitOpen();
    expect(events).toEqual([]);
  });

  it('emits no close event after an explicit close()', () => {
    client.open('a');
    const ws = FakeWebSocket.instances[0];
    client.close();
    ws.emitClose(1000);
    expect(events).toEqual([]);
    expect(ws.readyState).toBe(FakeWebSocket.CLOSED);
  });

  it('stops notifying after unlisten', () => {
    const extra: SocketEvent[] = [];
    const off = client.listen((e) => extra.push(e));
    off();
    client.open('a');
    FakeWebSocket.instances[0].emitOpen();
    expect(extra).toEqual([]);
  });
});

describe('createFakeSocketClient', () => {
  it('records opened hosts and close count and emits to listeners', () => {
    const fake = createFakeSocketClient();
    const got: SocketEvent[] = [];
    fake.listen((e) => got.push(e));
    fake.open('x');
    fake.close();
    fake.emit({ type: 'open' });
    expect(fake.openedHosts).toEqual(['x']);
    expect(fake.closeCount).toBe(1);
    expect(got).toEqual([{ type: 'open' }]);
  });
});
