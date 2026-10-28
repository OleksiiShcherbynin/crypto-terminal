import { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { orderRequested } from '../../../domain/actions';
import { formatPrice, formatQuantity, formatUsd } from '../../../domain/format';
import { div, floorTo, mul } from '../../../domain/money';
import { findPair } from '../../../domain/pairs';
import type { OrderRequest, Side, OrderType, Pair } from '../../../domain/types';
import { Button } from '../../../ui/Button';
import { Input } from '../../../ui/Input';
import { Segmented } from '../../../ui/Segmented';
import { selectConnection, selectSelection, selectTicker } from '../../market/selectors';
import { selectAvailableBase, selectAvailableQuote } from '../../portfolio/selectors';
import { orderCost, validateOrder, type OrderContext } from '../validation';

const PERCENTS = [25, 50, 75, 100] as const;

const SIDES = [
  { value: 'buy', label: 'Buy' },
  { value: 'sell', label: 'Sell' },
];
const TYPES = [
  { value: 'market', label: 'Market' },
  { value: 'limit', label: 'Limit' },
];

function positive(raw: string): number | undefined {
  const n = Number(raw);
  return raw.trim() !== '' && Number.isFinite(n) && n > 0 ? n : undefined;
}

export function TradeForm() {
  const { symbol } = useAppSelector(selectSelection);
  const pair = findPair(symbol);
  // Keyed by symbol so switching pairs resets the whole form.
  return pair ? <TradeFormFor key={symbol} pair={pair} /> : null;
}

function TradeFormFor({ pair }: { pair: Pair }) {
  const dispatch = useAppDispatch();
  const ticker = useAppSelector(selectTicker(pair.symbol));
  const { status } = useAppSelector(selectConnection);
  const availableQuote = useAppSelector(selectAvailableQuote);
  const availableBase = useAppSelector(selectAvailableBase(pair.base));

  const [side, setSide] = useState<Side>('buy');
  const [type, setType] = useState<OrderType>('market');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [quantityEdited, setQuantityEdited] = useState(false);

  const lastPrice = ticker?.last;
  const request: OrderRequest = {
    symbol: pair.symbol,
    side,
    type,
    quantity: Number(quantity),
    price: type === 'limit' ? Number(price) : undefined,
  };
  const ctx: OrderContext = {
    pair,
    lastPrice,
    connectionStatus: status,
    availableQuote,
    availableBase,
  };
  const error = validateOrder(request, ctx);

  const limitPrice = type === 'limit' ? positive(price) : undefined;
  const refPrice = limitPrice ?? lastPrice;
  const qty = positive(quantity);
  const cost =
    qty !== undefined && refPrice !== undefined ? orderCost(request, refPrice) : undefined;

  const clearQuantity = () => {
    setQuantity('');
    setQuantityEdited(false);
  };

  const changeSide = (value: string) => {
    setSide(value === 'sell' ? 'sell' : 'buy');
    clearQuantity();
  };

  const changeType = (value: string) => {
    const next: OrderType = value === 'limit' ? 'limit' : 'market';
    setType(next);
    if (next === 'limit' && lastPrice !== undefined)
      setPrice(lastPrice.toFixed(pair.pricePrecision));
  };

  const applyPercent = (pct: number) => {
    let amount: number;
    if (side === 'sell') {
      amount = floorTo(mul(availableBase, pct / 100), pair.qtyPrecision);
    } else {
      if (refPrice === undefined) return;
      amount = floorTo(div(mul(availableQuote, pct / 100), refPrice), pair.qtyPrecision);
    }
    setQuantity(String(amount));
    setQuantityEdited(true);
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (error) return;
    dispatch(orderRequested(request));
    clearQuantity();
  };

  const quantityError =
    error?.field === 'funds' || (error?.field === 'quantity' && quantityEdited)
      ? error.message
      : undefined;
  const priceError = error?.field === 'price' && type === 'limit' ? error.message : undefined;
  const noPriceError = error?.field === 'price' && type === 'market' ? error.message : undefined;
  const stale = status !== 'live';

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3 p-3 text-sm" noValidate>
      <div className="flex items-center justify-between">
        <Segmented aria-label="Side" options={SIDES} value={side} onChange={changeSide} />
        <Segmented aria-label="Order type" options={TYPES} value={type} onChange={changeType} />
      </div>

      <div className="flex items-baseline justify-between text-xs">
        <span className="text-muted">Last price</span>
        <span className="tabular">
          {lastPrice !== undefined ? formatPrice(lastPrice, pair.pricePrecision) : '—'}
        </span>
      </div>
      {stale ? <p className="-mt-2 text-xs text-muted">Price is stale while offline</p> : null}

      {type === 'limit' ? (
        <Input
          label="Price"
          suffix={pair.quote}
          inputMode="decimal"
          autoComplete="off"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          error={priceError}
        />
      ) : null}

      <Input
        label="Quantity"
        suffix={pair.base}
        inputMode="decimal"
        autoComplete="off"
        placeholder="0"
        value={quantity}
        onChange={(e) => {
          setQuantity(e.target.value);
          setQuantityEdited(true);
        }}
        error={quantityError}
      />

      <div className="grid grid-cols-4 gap-1">
        {PERCENTS.map((pct) => (
          <Button key={pct} variant="ghost" size="sm" onClick={() => applyPercent(pct)}>
            {pct}%
          </Button>
        ))}
      </div>

      <dl className="flex flex-col gap-1 text-xs">
        <div className="flex justify-between">
          <dt className="text-muted">Available</dt>
          <dd className="tabular">
            {side === 'buy'
              ? `${formatUsd(availableQuote)} ${pair.quote}`
              : `${formatQuantity(availableBase, pair.qtyPrecision)} ${pair.base}`}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted">{side === 'buy' ? 'Cost' : 'Proceeds'}</dt>
          <dd className="tabular">
            {cost !== undefined ? `${formatUsd(cost)} ${pair.quote}` : '—'}
          </dd>
        </div>
      </dl>

      {error?.field === 'connection' || noPriceError ? (
        <p role="alert" className="text-xs text-down">
          {error?.message}
        </p>
      ) : null}

      <Button type="submit" variant={side} disabled={error !== null}>
        {side === 'buy' ? 'Buy' : 'Sell'} {pair.base}
      </Button>
    </form>
  );
}
