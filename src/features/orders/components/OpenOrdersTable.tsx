import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { orderCancelled } from '../../../domain/actions';
import { formatPrice, formatQuantity, formatTime } from '../../../domain/format';
import { findPair } from '../../../domain/pairs';
import { Button } from '../../../ui/Button';
import { selectOpenOrders } from '../ordersSlice';

const TH = 'sticky top-0 bg-panel px-3 py-1 text-xs font-normal text-muted';

export function OpenOrdersTable() {
  const dispatch = useAppDispatch();
  const orders = useAppSelector(selectOpenOrders);
  if (orders.length === 0) return <p className="px-3 py-4 text-muted">No open orders</p>;
  return (
    <table className="w-full border-collapse text-xs">
      <thead>
        <tr>
          <th scope="col" className={`${TH} text-left`}>
            Pair
          </th>
          <th scope="col" className={`${TH} text-left`}>
            Side
          </th>
          <th scope="col" className={`${TH} text-right`}>
            Price
          </th>
          <th scope="col" className={`${TH} text-right`}>
            Qty
          </th>
          <th scope="col" className={`${TH} text-right`}>
            Placed
          </th>
          <th scope="col" className={`${TH} text-right`}>
            <span className="sr-only">Actions</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {orders.map((o) => {
          const pair = findPair(o.symbol);
          const label = pair ? `${pair.base}/${pair.quote}` : o.symbol;
          return (
            <tr key={o.id} className="h-7 border-t border-line">
              <td className="px-3 text-left">{label}</td>
              <td className={`px-3 text-left ${o.side === 'buy' ? 'text-up' : 'text-down'}`}>
                {o.side === 'buy' ? 'Buy' : 'Sell'}
              </td>
              <td className="tabular px-3 text-right">
                {formatPrice(o.price, pair?.pricePrecision ?? 2)}
              </td>
              <td className="tabular px-3 text-right">
                {formatQuantity(o.quantity, pair?.qtyPrecision ?? 2)}
              </td>
              <td className="tabular px-3 text-right text-muted">{formatTime(o.createdAt)}</td>
              <td className="px-3 text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`Cancel ${o.side} order ${label}`}
                  onClick={() => dispatch(orderCancelled(o))}
                >
                  Cancel
                </Button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
