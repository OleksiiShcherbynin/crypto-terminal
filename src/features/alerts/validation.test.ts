import { describe, expect, it } from 'vitest';
import { findPair } from '../../domain/pairs';
import { alertHit, alertPricePrefill, validateAlert } from './validation';

const pair = findPair('BTCUSDT')!;

describe('alertHit', () => {
  it('above: hit when last >= price', () => {
    expect(alertHit({ direction: 'above', price: 100 }, 101)).toBe(true);
    expect(alertHit({ direction: 'above', price: 100 }, 99)).toBe(false);
  });
  it('below: hit when last <= price', () => {
    expect(alertHit({ direction: 'below', price: 100 }, 99)).toBe(true);
    expect(alertHit({ direction: 'below', price: 100 }, 101)).toBe(false);
  });
  it('counts equality as a hit', () => {
    expect(alertHit({ direction: 'above', price: 100 }, 100)).toBe(true);
    expect(alertHit({ direction: 'below', price: 100 }, 100)).toBe(true);
  });
});

describe('validateAlert', () => {
  const base = { symbol: 'BTCUSDT', direction: 'above' as const, price: 110 };

  it('rejects a non-positive price', () => {
    expect(validateAlert({ ...base, price: 0 }, pair, 100)).toBe('Enter a price greater than zero');
    expect(validateAlert({ ...base, price: NaN }, pair, 100)).toBe(
      'Enter a price greater than zero',
    );
  });
  it('rejects when there is no price for the pair', () => {
    expect(validateAlert(base, pair, undefined)).toBe('No price for this pair yet');
  });
  it('rejects an alert that is already hit', () => {
    expect(validateAlert({ ...base, price: 90 }, pair, 100)).toBe('Price is already above 90.00');
    expect(validateAlert({ ...base, direction: 'below', price: 110 }, pair, 100)).toBe(
      'Price is already below 110.00',
    );
  });
  it('returns null for a valid alert', () => {
    expect(validateAlert(base, pair, 100)).toBeNull();
  });
});

describe('alertPricePrefill', () => {
  it('prefills above 1 % over the last price (rounded up) and below 1 % under it (rounded down)', () => {
    expect(alertPricePrefill('above', 100, 2)).toBe('101.00');
    expect(alertPricePrefill('below', 100, 2)).toBe('99.00');
    expect(alertPricePrefill('above', 0.12345, 4)).toBe('0.1247');
    expect(alertPricePrefill('below', 0.12345, 4)).toBe('0.1222');
  });
  it('is never already true', () => {
    for (const direction of ['above', 'below'] as const) {
      const price = Number(alertPricePrefill(direction, 100, 2));
      expect(validateAlert({ symbol: 'BTCUSDT', direction, price }, pair, 100)).toBeNull();
    }
  });
});
