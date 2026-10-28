import type { Pair, Ticker } from '../../domain/types';
import { WATCHED_PAIRS } from '../../domain/pairs';
import type { RootState } from '../../app/store';

export const selectTicker = (symbol: string) => (s: RootState) =>
  s.tickers[symbol] as Ticker | undefined;
export const selectTickers = (s: RootState) => s.tickers;
export const selectConnection = (s: RootState) => s.connection;
export const selectSelection = (s: RootState) => s.selection;

export function filterPairs(query: string): Pair[] {
  const q = query.trim().toLowerCase();
  if (q === '') return [...WATCHED_PAIRS];
  return WATCHED_PAIRS.filter(
    (p) => p.base.toLowerCase().includes(q) || p.symbol.toLowerCase().includes(q),
  );
}

export const selectFilteredPairs = (query: string) => (): Pair[] => filterPairs(query);
