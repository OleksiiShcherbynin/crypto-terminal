import { useAppSelector } from '../../../app/hooks';
import { findPair } from '../../../domain/pairs';
import { formatPct, formatPrice } from '../../../domain/format';
import { Panel } from '../../../ui/Panel';
import { selectSelection, selectTicker } from '../../market/selectors';
import { CandleChart } from './CandleChart';
import { IntervalPicker } from './IntervalPicker';

export function ChartPanel() {
  const { symbol } = useAppSelector(selectSelection);
  const ticker = useAppSelector(selectTicker(symbol));
  const { candles, status } = useAppSelector((s) => s.candles);
  const pair = findPair(symbol);
  const precision = pair?.pricePrecision ?? 2;
  const change = ticker?.changePct ?? 0;
  const changeColour = change === 0 ? 'text-muted' : change > 0 ? 'text-up' : 'text-down';

  return (
    <Panel title="Chart" right={<IntervalPicker />}>
      <div className="flex h-full flex-col">
        <div className="flex items-baseline gap-3 px-3 py-2">
          <span className="font-medium">{pair ? `${pair.base}/${pair.quote}` : symbol}</span>
          <span className="text-sm tabular">
            {ticker ? formatPrice(ticker.last, precision) : '--'}
          </span>
          <span className={`text-xs tabular ${changeColour}`}>
            {ticker ? formatPct(ticker.changePct) : '--'}
          </span>
          {status === 'unavailable' ? (
            <span className="ml-auto text-xs text-muted">
              History unavailable — showing live candles
            </span>
          ) : null}
        </div>
        <div className="min-h-0 flex-1">
          <CandleChart candles={candles} status={status} pricePrecision={precision} />
        </div>
      </div>
    </Panel>
  );
}
