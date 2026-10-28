import { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { orderRequested } from '../../../domain/actions';
import { formatPrice, formatQuantity, formatUsd } from '../../../domain/format';
import { div, floorTo, mul } from '../../../domain/money';
import { findPair } from '../../../domain/pairs';
import { parseDecimal } from '../../../domain/parse';
import type { ConnectionStatus, OrderRequest, Side, OrderType, Pair } from '../../../domain/types';
import { Button } from '../../../ui/Button';
import { Input } from '../../../ui/Input';
import { Segmented } from '../../../ui/Segmented';
import { selectConnection, selectSelection, selectTicker } from '../../market/selectors';
import { selectAvailableBase, selectAvailableQuote } from '../../portfolio/selectors';
import { limitPricePrefill, orderCost, validateOrder, type OrderContext } from '../validation';

const PERCENTS = [25, 50, 75, 100] as const;

const SIDES = [
  { value: 'buy', label: 'Buy' },
  { value: 'sell', label: 'Sell' },
];
const TYPES = [
  { value: 'market', label: 'Market' },
  { value: 'limit', label: 'Limit' },
];

/** Share of available USDT a market buy may spend, so a small up-tick cannot overdraw it. */
const MARKET_BUY_BUFFER = 0.999;

function positive(raw: string): number | undefined {
  const n = parseDecimal(raw);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/**
 * The untouched limit price, computed from an anchor price. `reanchor` says the anchor should
 * move to the live price: there was none yet, or the market moved through the prefill. Moving
 * the anchor once (instead of following every tick) keeps the field still afterwards.
 */
function prefillPrice(
  side: Side,
  anchor: number | undefined,
  last: number | undefined,
  pair: Pair,
): { price: string; reanchor: boolean } {
  const base = anchor ?? last;
  if (base === undefined) return { price: '', reanchor: false };
  const anchored = limitPricePrefill(side, base, pair.pricePrecision);
  if (last === undefined) return { price: anchored, reanchor: false };
  const crossed = side === 'buy' ? Number(anchored) >= last : Number(anchored) <= last;
  if (crossed) return { price: limitPricePrefill(side, last, pair.pricePrecision), reanchor: true };
  return { price: anchored, reanchor: anchor === undefined };
}

const STALE_NOTE: Record<Exclude<ConnectionStatus, 'live'>, string> = {
  connecting: 'Last known price — feed reconnecting',
  reconnecting: 'Last known price — feed reconnecting',
  offline: 'Last known price — feed offline',
};

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
  const [typedQuantity, setTypedQuantity] = useState('');
  // A percent button stays selected until the user types a quantity by hand; meanwhile the
  // quantity follows the current price, so a 100 % buy stays affordable after the next tick.
  const [percent, setPercent] = useState<number | null>(null);
  const [quantityEdited, setQuantityEdited] = useState(false);
  const [typedPrice, setTypedPrice] = useState('');
  const [priceEdited, setPriceEdited] = useState(false);
  // Price the limit prefill is computed from; set on side/type switches and re-anchored once when
  // the market moves through the prefill.
  const [priceAnchor, setPriceAnchor] = useState<number | undefined>(undefined);

  const lastPrice = ticker?.last;
  const prefill = prefillPrice(side, priceAnchor, lastPrice, pair);
  const price = priceEdited ? typedPrice : prefill.price;
  const reanchor = type === 'limit' && !priceEdited && prefill.reanchor;
  useEffect(() => {
    if (reanchor && lastPrice !== undefined) setPriceAnchor(lastPrice);
  }, [reanchor, lastPrice]);
  const limitPrice = type === 'limit' ? positive(price) : undefined;
  const refPrice = limitPrice ?? lastPrice;

  const percentQuantity = (pct: number): number | undefined => {
    if (side === 'sell') return floorTo(mul(availableBase, pct / 100), pair.qtyPrecision);
    if (refPrice === undefined) return undefined;
    const budget = mul(availableQuote, pct / 100);
    const spend = type === 'market' ? mul(budget, MARKET_BUY_BUFFER) : budget;
    return floorTo(div(spend, refPrice), pair.qtyPrecision);
  };
  const fromPercent = percent !== null ? percentQuantity(percent) : undefined;
  const quantity =
    percent !== null ? (fromPercent !== undefined ? String(fromPercent) : '') : typedQuantity;

  const request: OrderRequest = {
    symbol: pair.symbol,
    side,
    type,
    quantity: parseDecimal(quantity),
    price: type === 'limit' ? parseDecimal(price) : undefined,
  };
  const ctx: OrderContext = {
    pair,
    lastPrice,
    connectionStatus: status,
    availableQuote,
    availableBase,
  };
  const error = validateOrder(request, ctx);

  const qty = positive(quantity);
  const cost =
    qty !== undefined && refPrice !== undefined ? orderCost(request, refPrice) : undefined;

  const clearQuantity = () => {
    setTypedQuantity('');
    setPercent(null);
    setQuantityEdited(false);
  };

  const changeSide = (value: string) => {
    setSide(value === 'sell' ? 'sell' : 'buy');
    clearQuantity();
    // An untouched limit price moves to the valid side of the current price.
    if (!priceEdited) setPriceAnchor(lastPrice);
  };

  const changeType = (value: string) => {
    const next: OrderType = value === 'limit' ? 'limit' : 'market';
    setType(next);
    if (next === 'limit') {
      setPriceEdited(false);
      setPriceAnchor(lastPrice);
    }
  };

  const applyPercent = (pct: number) => {
    if (side === 'buy' && refPrice === undefined) return;
    setPercent(pct);
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
  const noPrice = error?.field === 'price' && lastPrice === undefined;
  // Price errors (format, wrong side) wait for the user's own edit; submit is disabled either way.
  const priceError =
    error?.field === 'price' && type === 'limit' && !noPrice && priceEdited
      ? error.message
      : undefined;
  const staleNote = lastPrice !== undefined && status !== 'live' ? STALE_NOTE[status] : undefined;

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
      {staleNote ? <p className="-mt-2 text-xs text-muted">{staleNote}</p> : null}

      {type === 'limit' ? (
        <Input
          label="Price"
          suffix={pair.quote}
          inputMode="decimal"
          autoComplete="off"
          value={price}
          onChange={(e) => {
            setTypedPrice(e.target.value);
            setPriceEdited(true);
          }}
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
          setTypedQuantity(e.target.value);
          setPercent(null);
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

      {error?.field === 'connection' || noPrice ? (
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
