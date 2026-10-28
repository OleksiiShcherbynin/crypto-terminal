import { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { findPair } from '../../../domain/pairs';
import { parseDecimal } from '../../../domain/parse';
import type { AlertDirection, AlertRequest, Pair } from '../../../domain/types';
import { Button } from '../../../ui/Button';
import { Input } from '../../../ui/Input';
import { Segmented } from '../../../ui/Segmented';
import { selectSelection, selectTicker } from '../../market/selectors';
import { alertRequested } from '../alertsSlice';
import { alertHit, alertPricePrefill, validateAlert } from '../validation';

const DIRECTIONS = [
  { value: 'above', label: 'Above' },
  { value: 'below', label: 'Below' },
];

export function AlertForm() {
  const { symbol } = useAppSelector(selectSelection);
  const pair = findPair(symbol);
  // Keyed by symbol so switching pairs resets the form.
  return pair ? <AlertFormFor key={symbol} pair={pair} /> : null;
}

/**
 * The untouched alert price, computed from an anchor price. `reanchor` says the anchor should
 * move to the live price: there was none yet, or the market reached the prefill. Moving the
 * anchor once (instead of following every tick) keeps the field still afterwards.
 */
function prefillPrice(
  direction: AlertDirection,
  anchor: number | undefined,
  last: number | undefined,
  pair: Pair,
): { price: string; reanchor: boolean } {
  const base = anchor ?? last;
  if (base === undefined) return { price: '', reanchor: false };
  const anchored = alertPricePrefill(direction, base, pair.pricePrecision);
  if (last === undefined) return { price: anchored, reanchor: false };
  if (alertHit({ direction, price: Number(anchored) }, last)) {
    return { price: alertPricePrefill(direction, last, pair.pricePrecision), reanchor: true };
  }
  return { price: anchored, reanchor: anchor === undefined };
}

function AlertFormFor({ pair }: { pair: Pair }) {
  const dispatch = useAppDispatch();
  const ticker = useAppSelector(selectTicker(pair.symbol));
  const lastPrice = ticker?.last;

  const [direction, setDirection] = useState<AlertDirection>('above');
  const [typedPrice, setTypedPrice] = useState('');
  const [edited, setEdited] = useState(false);
  // Price the prefill is computed from; set on direction switches and re-anchored once when the
  // market reaches the prefill.
  const [anchor, setAnchor] = useState(lastPrice);

  const prefill = prefillPrice(direction, anchor, lastPrice, pair);
  const price = edited ? typedPrice : prefill.price;
  const reanchor = !edited && prefill.reanchor;
  useEffect(() => {
    if (reanchor && lastPrice !== undefined) setAnchor(lastPrice);
  }, [reanchor, lastPrice]);
  const request: AlertRequest = { symbol: pair.symbol, direction, price: parseDecimal(price) };
  const error = validateAlert(request, pair, lastPrice);
  // Errors wait for the user's own edit; submit is disabled either way.
  const shown = error !== null && edited ? error : undefined;

  const restartPrefill = () => {
    setEdited(false);
    setAnchor(lastPrice);
  };

  const changeDirection = (value: string) => {
    setDirection(value === 'below' ? 'below' : 'above');
    if (!edited) setAnchor(lastPrice);
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (error) return;
    dispatch(alertRequested(request));
    restartPrefill();
  };

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      aria-label="New alert"
      className="flex flex-wrap items-start gap-3 border-b border-line p-3 text-xs"
    >
      <span className="flex h-8 items-center font-medium">
        {pair.base}/{pair.quote}
      </span>
      <div className="flex h-8 items-center">
        <Segmented
          aria-label="Direction"
          options={DIRECTIONS}
          value={direction}
          onChange={changeDirection}
        />
      </div>
      <div className="w-44">
        <Input
          aria-label="Price"
          suffix={pair.quote}
          inputMode="decimal"
          autoComplete="off"
          value={price}
          onChange={(e) => {
            setTypedPrice(e.target.value);
            setEdited(true);
          }}
          error={shown}
        />
      </div>
      <Button type="submit" disabled={error !== null}>
        Add alert
      </Button>
    </form>
  );
}
