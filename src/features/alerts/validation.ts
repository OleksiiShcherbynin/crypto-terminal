import { formatPrice } from '../../domain/format';
import { ceilTo, floorTo, mul } from '../../domain/money';
import type { Alert, AlertDirection, AlertRequest, Pair } from '../../domain/types';

export function alertHit(alert: Pick<Alert, 'direction' | 'price'>, last: number): boolean {
  return alert.direction === 'above' ? last >= alert.price : last <= alert.price;
}

/** Alert price the form starts with: 1 % beyond the last price, so the alert is never already true. */
export function alertPricePrefill(
  direction: AlertDirection,
  lastPrice: number,
  precision: number,
): string {
  const price =
    direction === 'above'
      ? ceilTo(mul(lastPrice, 1.01), precision)
      : floorTo(mul(lastPrice, 0.99), precision);
  return price.toFixed(precision);
}

export function validateAlert(req: AlertRequest, pair: Pair, lastPrice?: number): string | null {
  if (!Number.isFinite(req.price) || req.price <= 0) return 'Enter a price greater than zero';
  if (lastPrice === undefined) return 'No price for this pair yet';
  if (alertHit(req, lastPrice)) {
    return `Price is already ${req.direction} ${formatPrice(req.price, pair.pricePrecision)}`;
  }
  return null;
}
