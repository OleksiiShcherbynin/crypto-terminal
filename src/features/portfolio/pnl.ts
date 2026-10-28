import { formatUsd } from '../../domain/format';
import { roundTo } from '../../domain/money';

/** P&L as displayed: 2 dp, with -0 folded into 0 so a rounded-away loss is not "-0.00". */
function displayed(value: number): number {
  const rounded = roundTo(value, 2);
  return rounded === 0 ? 0 : rounded;
}

/** Green for a gain, red for a loss; '' (neutral) for anything that displays as 0.00. */
export function pnlClass(value: number): string {
  const v = displayed(value);
  if (v > 0) return 'text-up';
  if (v < 0) return 'text-down';
  return '';
}

export function formatSigned(value: number): string {
  const v = displayed(value);
  return `${v > 0 ? '+' : ''}${formatUsd(v)}`;
}
