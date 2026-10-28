import { formatPrice } from '../../domain/format';
import type { Alert, AlertRequest, Pair } from '../../domain/types';

export function alertHit(alert: Pick<Alert, 'direction' | 'price'>, last: number): boolean {
  return alert.direction === 'above' ? last >= alert.price : last <= alert.price;
}

export function validateAlert(req: AlertRequest, pair: Pair, lastPrice?: number): string | null {
  if (!Number.isFinite(req.price) || req.price <= 0) return 'Enter a price greater than zero';
  if (lastPrice === undefined) return 'No price for this pair yet';
  if (alertHit(req, lastPrice)) {
    return `Price is already ${req.direction} ${formatPrice(req.price, pair.pricePrecision)}`;
  }
  return null;
}
