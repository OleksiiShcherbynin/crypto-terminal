import Big from 'big.js';

const DP = 8;

export function add(a: number, b: number): number {
  return Number(new Big(a).plus(b).round(DP));
}

export function sub(a: number, b: number): number {
  return Number(new Big(a).minus(b).round(DP));
}

export function mul(a: number, b: number): number {
  return Number(new Big(a).times(b).round(DP));
}

export function div(a: number, b: number): number {
  return Number(new Big(a).div(b).round(DP));
}

export function roundTo(value: number, dp: number): number {
  return Number(new Big(value).round(dp));
}

export function isZero(value: number): boolean {
  return Math.abs(value) < 1e-8;
}
