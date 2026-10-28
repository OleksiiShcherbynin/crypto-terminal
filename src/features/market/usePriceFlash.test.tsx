import { renderHook } from '@testing-library/react';
import { it, expect } from 'vitest';
import { usePriceFlash } from './usePriceFlash';

it('reports direction and bumps key on each change', () => {
  const { result, rerender } = renderHook(({ v }) => usePriceFlash(v), {
    initialProps: { v: 10 as number | undefined },
  });
  expect(result.current.direction).toBeNull();
  const k0 = result.current.key;
  rerender({ v: 11 });
  expect(result.current.direction).toBe('up');
  const k1 = result.current.key;
  expect(k1).toBeGreaterThan(k0);
  rerender({ v: 10 });
  expect(result.current.direction).toBe('down');
  expect(result.current.key).toBeGreaterThan(k1);
});

it('ignores undefined values', () => {
  const { result, rerender } = renderHook(({ v }) => usePriceFlash(v), {
    initialProps: { v: undefined as number | undefined },
  });
  rerender({ v: 5 });
  expect(result.current.direction).toBeNull();
});
