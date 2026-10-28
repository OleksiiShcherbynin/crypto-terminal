import { describe, expect, it } from 'vitest';
import { orderCancelled, orderFilled, orderPlaced, portfolioReset } from '../../domain/actions';
import { fill, order } from '../../test/fixtures';
import reducer, { selectOpenOrders, type OrdersState } from './ordersSlice';

const init = (items: OrdersState['items'] = []): OrdersState => ({ items });

describe('ordersSlice', () => {
  it('adds a placed order', () => {
    const state = reducer(init(), orderPlaced(order()));
    expect(selectOpenOrders({ orders: state })).toEqual([order()]);
  });

  it('removes a cancelled order', () => {
    const state = reducer(init([order(), order({ id: 'o2' })]), orderCancelled(order()));
    expect(state.items.map((o) => o.id)).toEqual(['o2']);
  });

  it('removes an order when its fill arrives', () => {
    const state = reducer(init([order(), order({ id: 'o2' })]), orderFilled(fill()));
    expect(state.items.map((o) => o.id)).toEqual(['o2']);
  });

  it('keeps orders when a market fill has no orderId', () => {
    const state = reducer(init([order()]), orderFilled(fill({ orderId: undefined })));
    expect(state.items).toHaveLength(1);
  });

  it('clears on portfolioReset', () => {
    expect(reducer(init([order()]), portfolioReset()).items).toEqual([]);
  });
});
