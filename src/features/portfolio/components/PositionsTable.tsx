import { useAppSelector } from '../../../app/hooks';
import { formatPct, formatPrice, formatQuantity, formatUsd } from '../../../domain/format';
import { findPair } from '../../../domain/pairs';
import { formatSigned, pnlClass } from '../pnl';
import { selectPositionRows } from '../selectors';

const TH = 'sticky top-0 bg-panel px-3 py-1 text-xs font-normal text-muted';

export function PositionsTable() {
  const rows = useAppSelector(selectPositionRows);
  if (rows.length === 0) return <p className="px-3 py-4 text-muted">No positions yet</p>;
  return (
    <table className="w-full border-collapse text-xs">
      <thead>
        <tr>
          <th scope="col" className={`${TH} text-left`}>
            Asset
          </th>
          {['Qty', 'Avg price', 'Last', 'Value', 'P&L'].map((h) => (
            <th key={h} scope="col" className={`${TH} text-right`}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const pair = findPair(r.symbol);
          const pp = pair?.pricePrecision ?? 2;
          const qp = pair?.qtyPrecision ?? 2;
          return (
            <tr key={r.asset} className="h-7 border-t border-line">
              <th scope="row" className="px-3 text-left font-medium">
                {r.asset}
              </th>
              <td className="tabular px-3 text-right">{formatQuantity(r.quantity, qp)}</td>
              <td className="tabular px-3 text-right">{formatPrice(r.avgPrice, pp)}</td>
              <td className="tabular px-3 text-right">
                {r.lastPrice !== undefined ? formatPrice(r.lastPrice, pp) : '—'}
              </td>
              <td className="tabular px-3 text-right">{formatUsd(r.value)}</td>
              <td className="px-3 text-right">
                <span className={`tabular ${pnlClass(r.unrealizedPnl)}`}>
                  {formatSigned(r.unrealizedPnl)} ({formatPct(r.unrealizedPct)})
                </span>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
