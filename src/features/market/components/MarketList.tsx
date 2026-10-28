import { useState } from 'react';
import { filterPairs } from '../selectors';
import { MarketFilter } from './MarketFilter';
import { MarketRow } from './MarketRow';

export function MarketList() {
  const [query, setQuery] = useState('');
  const pairs = filterPairs(query);
  return (
    <div className="flex min-h-0 flex-col">
      <MarketFilter value={query} onChange={setQuery} />
      <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 border-b border-line px-3 py-1 text-xs text-muted">
        <span>Pair / volume</span>
        <span className="text-right">Last</span>
        <span className="w-16 text-right">24h</span>
      </div>
      <div role="listbox" aria-label="Pairs" className="max-h-96 overflow-y-auto xl:max-h-none">
        {pairs.map((p) => (
          <MarketRow key={p.symbol} symbol={p.symbol} />
        ))}
        {pairs.length === 0 ? <p className="px-3 py-3 text-muted">No matching pairs</p> : null}
      </div>
    </div>
  );
}
