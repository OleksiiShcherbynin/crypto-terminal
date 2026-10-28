import { expectSaga } from 'redux-saga-test-plan';
import { describe, expect, it } from 'vitest';
import { orderPlaced } from '../domain/actions';
import { order, fakeStorage } from '../test/fixtures';
import { externalChangeDetected } from './appSlice';
import { STORAGE_KEY } from './persistence';
import { persistenceSaga, watchExternalChanges } from './persistenceSaga';
import { rootReducer } from './store';

const initial = () => rootReducer(undefined, { type: '@@init' });

describe('persistenceSaga', () => {
  it('writes once after a burst of actions', async () => {
    const storage = fakeStorage();
    let writes = 0;
    const counting: Storage = {
      ...storage,
      getItem: (k) => storage.getItem(k),
      setItem: (k, v) => {
        writes++;
        storage.setItem(k, v);
      },
    };
    await expectSaga(
      persistenceSaga,
      { storage: counting },
      { debounceMs: 5, target: new EventTarget() },
    )
      .withReducer(rootReducer, initial())
      .dispatch(orderPlaced(order({ id: 'o1' })))
      .dispatch(orderPlaced(order({ id: 'o2' })))
      .dispatch(orderPlaced(order({ id: 'o3' })))
      .silentRun(60);
    expect(writes).toBe(1);
    const saved = JSON.parse(storage.getItem(STORAGE_KEY) ?? '{}') as { version: number };
    expect(saved.version).toBe(1);
  });

  it('stops persisting after an external change', async () => {
    const storage = fakeStorage();
    await expectSaga(persistenceSaga, { storage }, { debounceMs: 5, target: new EventTarget() })
      .withReducer(rootReducer, initial())
      .dispatch(externalChangeDetected())
      .dispatch(orderPlaced(order()))
      .silentRun(60);
    expect(storage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('detects a storage event for our key', async () => {
    const target = new EventTarget();
    const run = expectSaga(watchExternalChanges, target)
      .put(externalChangeDetected())
      .silentRun(50);
    target.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY }));
    const result = await run;
    expect(result.effects.put).toBeUndefined();
  });

  it('ignores other keys', async () => {
    const target = new EventTarget();
    const run = expectSaga(watchExternalChanges, target).silentRun(50);
    target.dispatchEvent(new StorageEvent('storage', { key: 'something-else' }));
    const result = await run;
    expect(result.allEffects.filter((e) => 'PUT' in e)).toHaveLength(0);
  });
});
