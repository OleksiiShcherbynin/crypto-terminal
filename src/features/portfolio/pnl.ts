import { formatUsd } from '../../domain/format';

export function pnlClass(value: number): string {
  if (value > 0) return 'text-up';
  if (value < 0) return 'text-down';
  return '';
}

export function formatSigned(value: number): string {
  return `${value > 0 ? '+' : ''}${formatUsd(value)}`;
}
