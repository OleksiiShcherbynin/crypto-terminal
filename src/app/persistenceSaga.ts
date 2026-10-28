import type { SagaIterator } from 'redux-saga';
import { eventChannel, type EventChannel } from 'redux-saga';
import { call, debounce, fork, put, select, take } from 'redux-saga/effects';
import { alertCreated, alertDeleted, alertTriggered } from '../features/alerts/alertsSlice';
import { intervalChanged, pairSelected } from '../features/market/selectionSlice';
import { orderCancelled, orderFilled, orderPlaced, portfolioReset } from '../domain/actions';
import { externalChangeDetected, selectExternalChange } from './appSlice';
import { STORAGE_KEY, savePersistedState } from './persistence';
import type { RootState, SagaDeps } from './store';

export const PERSIST_DEBOUNCE_MS = 500;

/** Every action that can change a persisted slice. */
export const PERSISTED_ACTIONS: string[] = [
  orderPlaced,
  orderCancelled,
  orderFilled,
  alertCreated,
  alertDeleted,
  alertTriggered,
  pairSelected,
  intervalChanged,
  portfolioReset,
].map((a) => a.type);

type StorageTarget = Pick<Window, 'addEventListener' | 'removeEventListener'>;

/** Writes the persisted slices, unless another tab owns the key (then this tab stays read-only). */
export function* persist(deps: Pick<SagaDeps, 'storage'>): SagaIterator {
  const external: boolean = yield select(selectExternalChange);
  if (external) return;
  const state: RootState = yield select();
  yield call(savePersistedState, deps.storage, state);
}

/** Browsers fire 'storage' only in the other tabs, so our own writes never arrive here. */
export function createStorageChannel(target: StorageTarget): EventChannel<StorageEvent> {
  return eventChannel<StorageEvent>((emit) => {
    const listener = (e: Event) => emit(e as StorageEvent);
    target.addEventListener('storage', listener);
    return () => target.removeEventListener('storage', listener);
  });
}

export function* watchExternalChanges(target: StorageTarget): SagaIterator {
  const channel: EventChannel<StorageEvent> = yield call(createStorageChannel, target);
  try {
    while (true) {
      const event: StorageEvent = yield take(channel);
      if (event.key === STORAGE_KEY) {
        yield put(externalChangeDetected());
        return;
      }
    }
  } finally {
    channel.close();
  }
}

export function* persistenceSaga(
  deps: Pick<SagaDeps, 'storage'>,
  opts: { debounceMs?: number; target?: StorageTarget } = {},
): SagaIterator {
  const target = opts.target ?? (typeof window !== 'undefined' ? window : undefined);
  if (target) yield fork(watchExternalChanges, target);
  yield debounce(opts.debounceMs ?? PERSIST_DEBOUNCE_MS, PERSISTED_ACTIONS, persist, deps);
}
