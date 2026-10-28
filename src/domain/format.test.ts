import { describe, it, expect } from 'vitest';
import {
  formatPrice,
  formatQuantity,
  formatPct,
  formatCompact,
  formatUsd,
  formatTime,
} from './format';

describe('format', () => {
  it('formats price with grouping and fixed decimals', () =>
    expect(formatPrice(67412.5, 2)).toBe('67,412.50'));
  it('formats quantity', () => expect(formatQuantity(0.015, 5)).toBe('0.01500'));
  it('formats signed percent', () => {
    expect(formatPct(1.84)).toBe('+1.84%');
    expect(formatPct(-0.3)).toBe('-0.30%');
  });
  it('formats compact volume', () => {
    expect(formatCompact(1_234_000_000)).toBe('1.2B');
    expect(formatCompact(845_300_000)).toBe('845.3M');
    expect(formatCompact(12_500)).toBe('12.5K');
  });
  it('formats usd', () => expect(formatUsd(8765)).toBe('8,765.00'));
  it('formats local time HH:MM:SS', () => {
    const d = new Date(2026, 9, 28, 14, 5, 32);
    expect(formatTime(d.getTime())).toBe('14:05:32');
  });
});
