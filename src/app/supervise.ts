import type { SagaIterator } from 'redux-saga';
import { call, delay } from 'redux-saga/effects';

export const RESTART_DELAY_MS = 1000;
export const MAX_RESTARTS = 5;

/**
 * Runs a saga and restarts it if it crashes, so one failure cannot cancel its siblings under
 * `all`. Gives up after MAX_RESTARTS to avoid a tight crash loop.
 */
export function* supervise<A extends unknown[]>(
  name: string,
  saga: (...args: A) => SagaIterator,
  ...args: A
): SagaIterator {
  let restarts = 0;
  while (true) {
    try {
      yield call(saga, ...args);
      return;
    } catch (e) {
      if (restarts >= MAX_RESTARTS) {
        console.error(`[saga:${name}] crashed ${restarts + 1} times, giving up`, e);
        return;
      }
      restarts++;
      console.error(`[saga:${name}] crashed, restarting`, e);
      yield delay(RESTART_DELAY_MS);
    }
  }
}
