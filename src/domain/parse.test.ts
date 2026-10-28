import { describe, expect, it } from 'vitest';
import { parseDecimal } from './parse';

describe('parseDecimal', () => {
  it('parses plain and fractional numbers', () => {
    expect(parseDecimal('42')).toBe(42);
    expect(parseDecimal('0.015')).toBe(0.015);
    expect(parseDecimal('.5')).toBe(0.5);
    expect(parseDecimal('7.')).toBe(7);
  });

  it('accepts a comma as the decimal point and ignores surrounding spaces', () => {
    expect(parseDecimal('95,5')).toBe(95.5);
    expect(parseDecimal('  1,25 ')).toBe(1.25);
  });

  it('rejects empty input, exponents, signs and garbage', () => {
    for (const raw of ['', '   ', '1e3', '1E-2', '-1', '+1', '1.2.3', '1,2,3', 'abc', 'Infinity']) {
      expect(parseDecimal(raw), raw).toBeNaN();
    }
  });
});
