import { describe, expect, it } from 'vitest';
import { formatSigned, pnlClass } from './pnl';

describe('pnl', () => {
  it('signs and colours real gains and losses', () => {
    expect(formatSigned(12.345)).toBe('+12.35');
    expect(pnlClass(12.345)).toBe('text-up');
    expect(formatSigned(-1_234.5)).toBe('-1,234.50');
    expect(pnlClass(-1_234.5)).toBe('text-down');
  });

  it('treats amounts that round to zero as neutral, without a sign', () => {
    for (const value of [0, -0, 0.004, -0.004]) {
      expect(formatSigned(value), String(value)).toBe('0.00');
      expect(pnlClass(value), String(value)).toBe('');
    }
  });

  it('rounds before deciding the sign', () => {
    expect(formatSigned(0.005)).toBe('+0.01');
    expect(pnlClass(-0.005)).toBe('text-down');
  });
});
