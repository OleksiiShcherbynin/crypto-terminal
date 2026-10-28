import { useState } from 'react';

export type FlashDirection = 'up' | 'down' | null;

interface FlashState {
  prev: number | undefined;
  direction: FlashDirection;
  key: number;
}

/**
 * Tracks the direction of the latest price change. No timers: the CSS animation
 * fades the highlight out, and `key` lets the caller restart it on every tick.
 */
export function usePriceFlash(last: number | undefined): {
  direction: FlashDirection;
  key: number;
} {
  const [state, setState] = useState<FlashState>({ prev: last, direction: null, key: 0 });
  if (last !== state.prev) {
    const changed = last !== undefined && state.prev !== undefined;
    setState({
      prev: last,
      direction: changed ? (last > state.prev! ? 'up' : 'down') : state.direction,
      key: changed ? state.key + 1 : state.key,
    });
  }
  return { direction: state.direction, key: state.key };
}
