import { describe, it, expect } from 'vitest';
import { add, sub, mul, div, roundTo, isZero } from './money';

describe('money', () => {
  it('adds without float drift', () => expect(add(0.1, 0.2)).toBe(0.3));
  it('multiplies price by quantity', () => expect(mul(0.015, 66900)).toBe(1003.5));
  it('treats tiny remainders as zero', () => expect(isZero(sub(0.3, add(0.1, 0.2)))).toBe(true));
  it('divides and rounds to 8 dp', () => expect(div(1, 3)).toBe(0.33333333));
  it('rounds to given dp', () => expect(roundTo(1.005, 2)).toBe(1.01));
  it('isZero rejects real amounts', () => expect(isZero(0.00000001)).toBe(false));
});
