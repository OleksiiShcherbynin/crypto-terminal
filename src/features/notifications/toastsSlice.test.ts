import { describe, expect, it } from 'vitest';
import type { Toast } from '../../domain/types';
import toastsReducer, { toastDismissed, toastPushed } from './toastsSlice';

describe('toastsSlice', () => {
  it('dismisses a toast by id', () => {
    const a: Toast = { id: 'a', kind: 'info', title: 'A' };
    const b: Toast = { id: 'b', kind: 'error', title: 'B', message: 'm' };
    let s = toastsReducer(undefined, toastPushed(a));
    s = toastsReducer(s, toastPushed(b));
    s = toastsReducer(s, toastDismissed('a'));
    expect(s.items).toEqual([b]);
  });
});
