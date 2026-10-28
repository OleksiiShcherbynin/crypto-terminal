import { expectSaga } from 'redux-saga-test-plan';
import type { SagaIterator } from 'redux-saga';
import { all, fork, put, take } from 'redux-saga/effects';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MAX_RESTARTS, supervise } from './supervise';

describe('supervise', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    errorSpy.mockRestore();
  });

  it('restarts a saga that throws once', async () => {
    let runs = 0;
    function* flaky(): SagaIterator {
      runs++;
      yield put({ type: 'tick' });
      if (runs === 1) throw new Error('boom');
    }
    const run = expectSaga(supervise, 'flaky', flaky).silentRun(5_000);
    await vi.advanceTimersByTimeAsync(5_000);
    await run;
    expect(runs).toBe(2);
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  it('gives up after the restart cap', async () => {
    let runs = 0;
    function* broken(): SagaIterator {
      runs++;
      yield put({ type: 'tick' });
      throw new Error('boom');
    }
    const run = expectSaga(supervise, 'broken', broken).silentRun(20_000);
    await vi.advanceTimersByTimeAsync(20_000);
    await run;
    expect(runs).toBe(MAX_RESTARTS + 1);
    expect(errorSpy).toHaveBeenCalledTimes(MAX_RESTARTS + 1);
  });

  it('keeps a sibling running when one crashes', async () => {
    function* crasher(): SagaIterator {
      yield put({ type: 'crash' });
      throw new Error('boom');
    }
    function* echo(): SagaIterator {
      yield take('ping');
      yield put({ type: 'pong' });
    }
    function* root(): SagaIterator {
      yield all([fork(supervise, 'crasher', crasher), fork(supervise, 'echo', echo)]);
    }
    const run = expectSaga(root).put({ type: 'pong' }).dispatch({ type: 'ping' }).silentRun(100);
    await vi.advanceTimersByTimeAsync(100);
    await run;
  });
});
