import { describe, expect, it } from 'vitest';
import { WS_HOSTS, pickHost } from './hosts';

describe('pickHost', () => {
  it('uses primary twice then alternates', () =>
    expect([0, 1, 2, 3, 4].map((a) => pickHost(WS_HOSTS, a))).toEqual([
      WS_HOSTS[0],
      WS_HOSTS[0],
      WS_HOSTS[1],
      WS_HOSTS[0],
      WS_HOSTS[1],
    ]));
});
