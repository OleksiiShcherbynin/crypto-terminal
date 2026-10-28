import { useSelector } from 'react-redux';
import { formatUsd } from '../../../domain/format';
import { formatSigned, pnlClass } from '../pnl';
import { selectEquity, selectRealizedPnl } from '../selectors';
import { ResetPortfolioButton } from './ResetPortfolioButton';

export function EquityHeader() {
  const equity = useSelector(selectEquity);
  const realized = useSelector(selectRealizedPnl);

  return (
    <header className="flex h-9 shrink-0 items-center gap-6 border-b border-line bg-panel px-3">
      <div className="flex items-baseline gap-3">
        <h1 className="text-sm font-semibold tracking-tight">Crypto Terminal</h1>
        <span className="text-xs text-muted">Paper trading</span>
      </div>
      <dl className="ml-auto flex items-baseline gap-6 text-xs">
        <div className="flex items-baseline gap-2">
          <dt className="text-muted">Equity</dt>
          <dd className="tabular text-sm text-text">
            <span>{formatUsd(equity)}</span> <span className="text-muted">USDT</span>
          </dd>
        </div>
        <div className="flex items-baseline gap-2">
          <dt className="text-muted">Realized</dt>
          <dd className={`tabular text-sm ${pnlClass(realized) || 'text-text'}`}>
            {formatSigned(realized)}
          </dd>
        </div>
      </dl>
      <ResetPortfolioButton />
    </header>
  );
}
