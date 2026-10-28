import { useAppSelector } from '../../../app/hooks';
import { formatPrice, formatQuantity, formatTime, formatUsd } from '../../../domain/format';
import { findPair } from '../../../domain/pairs';
import { formatSigned, pnlClass } from '../pnl';
import { selectTrades } from '../selectors';

const TH = 'sticky top-0 bg-panel px-3 py-1 text-xs font-normal text-muted';
const HEADS = ['Time', 'Pair', 'Side', 'Type', 'Qty', 'Price', 'Total', 'Realized'];
const LEFT = new Set(['Time', 'Pair', 'Side', 'Type']);

export function TradeHistory() {
  // The reducer stores trades newest first.
  const trades = useAppSelector(selectTrades);
  if (trades.length === 0) return <p className="px-3 py-4 text-muted">No trades yet</p>;
  return (
    <table className="w-full border-collapse text-xs">
      <thead>
        <tr>
          {HEADS.map((h) => (
            <th key={h} scope="col" className={`${TH} ${LEFT.has(h) ? 'text-left' : 'text-right'}`}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {trades.map((t) => {
          const pair = findPair(t.symbol);
          return (
            <tr key={t.id} className="h-7 border-t border-line">
              <td className="tabular px-3 text-left text-muted">{formatTime(t.executedAt)}</td>
              <td className="px-3 text-left">{pair ? `${pair.base}/${pair.quote}` : t.symbol}</td>
              <td className={`px-3 text-left ${t.side === 'buy' ? 'text-up' : 'text-down'}`}>
                {t.side === 'buy' ? 'Buy' : 'Sell'}
              </td>
              <td className="px-3 text-left capitalize">{t.type}</td>
              <td className="tabular px-3 text-right">
                {formatQuantity(t.quantity, pair?.qtyPrecision ?? 2)}
              </td>
              <td className="tabular px-3 text-right">
                {formatPrice(t.price, pair?.pricePrecision ?? 2)}
              </td>
              <td className="tabular px-3 text-right">{formatUsd(t.total)}</td>
              <td className="px-3 text-right">
                {t.side === 'sell' ? (
                  <span className={`tabular ${pnlClass(t.realizedPnl)}`}>
                    {formatSigned(t.realizedPnl)}
                  </span>
                ) : (
                  <span className="text-muted">—</span>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
