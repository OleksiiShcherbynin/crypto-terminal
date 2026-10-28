import { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { findPair } from '../../../domain/pairs';
import type { AlertDirection, AlertRequest, Pair } from '../../../domain/types';
import { Button } from '../../../ui/Button';
import { Input } from '../../../ui/Input';
import { Segmented } from '../../../ui/Segmented';
import { selectSelection, selectTicker } from '../../market/selectors';
import { alertRequested } from '../alertsSlice';
import { validateAlert } from '../validation';

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

function AlertFormFor({ pair }: { pair: Pair }) {
  const dispatch = useAppDispatch();
  const ticker = useAppSelector(selectTicker(pair.symbol));
  const lastPrice = ticker?.last;
  const prefill = lastPrice !== undefined ? lastPrice.toFixed(pair.pricePrecision) : '';

  const [direction, setDirection] = useState<AlertDirection>('above');
  const [price, setPrice] = useState(prefill);
  const [edited, setEdited] = useState(false);

  const request: AlertRequest = {
    symbol: pair.symbol,
    direction,
    price: Number(price.trim().replace(',', '.')),
  };
  const error =
    price.trim() === ''
      ? 'Enter a price greater than zero'
      : validateAlert(request, pair, lastPrice);
  // Format errors wait for the first edit; "already above/below" shows as soon as it applies.
  const alreadyTrue = error?.startsWith('Price is already') ?? false;
  const shown = error !== null && (edited || alreadyTrue) ? error : undefined;

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (error) return;
    dispatch(alertRequested(request));
    setPrice(prefill);
    setEdited(false);
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
          onChange={(v) => setDirection(v === 'below' ? 'below' : 'above')}
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
            setPrice(e.target.value);
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
