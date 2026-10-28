import { memo, type KeyboardEvent } from 'react';
import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { findPair } from '../../../domain/pairs';
import { formatCompact, formatPct, formatPrice } from '../../../domain/format';
import { pairSelected } from '../selectionSlice';
import { selectConnection, selectTicker } from '../selectors';
import { usePriceFlash } from '../usePriceFlash';

export interface MarketRowProps {
  symbol: string;
}

function MarketRowImpl({ symbol }: MarketRowProps) {
  const dispatch = useAppDispatch();
  const ticker = useAppSelector(selectTicker(symbol));
  const live = useAppSelector((s) => selectConnection(s).status === 'live');
  const selected = useAppSelector((s) => s.selection.symbol === symbol);
  const pair = findPair(symbol);
  const { direction, key } = usePriceFlash(ticker?.last);

  const select = () => dispatch(pairSelected(symbol));
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      select();
    }
  };

  const label = pair ? `${pair.base}/${pair.quote}` : symbol;
  const flash = direction === 'up' ? 'flash-up' : direction === 'down' ? 'flash-down' : '';
  const changeColour =
    !ticker || ticker.changePct === 0
      ? 'text-muted'
      : ticker.changePct > 0
        ? 'text-up'
        : 'text-down';

  return (
    <div
      role="option"
      tabIndex={0}
      aria-selected={selected}
      onClick={select}
      onKeyDown={onKeyDown}
      className={`grid cursor-pointer grid-cols-[1fr_auto_auto] items-center gap-x-3 border-l-2 px-3 py-1.5 hover:bg-panel-2 ${
        selected ? 'border-accent bg-panel-2' : 'border-transparent'
      } ${live ? '' : 'opacity-50'}`}
    >
      <span className="col-start-1 row-start-1 font-medium">{label}</span>
      <span className="col-start-1 row-start-2 text-xs text-muted tabular">
        {ticker ? formatCompact(ticker.volume) : '--'}
      </span>
      <span
        key={key}
        className={`col-start-2 row-span-2 row-start-1 rounded-sm px-1 text-right text-sm tabular ${flash}`}
      >
        {ticker && pair ? formatPrice(ticker.last, pair.pricePrecision) : '--'}
      </span>
      <span
        className={`col-start-3 row-span-2 row-start-1 w-16 text-right text-xs tabular ${changeColour}`}
      >
        {ticker ? formatPct(ticker.changePct) : '--'}
      </span>
    </div>
  );
}

export const MarketRow = memo(MarketRowImpl);
