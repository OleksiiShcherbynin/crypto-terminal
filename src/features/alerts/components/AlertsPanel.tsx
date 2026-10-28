import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { formatPrice, formatTime } from '../../../domain/format';
import { findPair } from '../../../domain/pairs';
import { Button } from '../../../ui/Button';
import { alertDeleted, selectAlerts } from '../alertsSlice';
import { AlertForm } from './AlertForm';

export function AlertsPanel() {
  const dispatch = useAppDispatch();
  const alerts = useAppSelector(selectAlerts);
  return (
    <div>
      <AlertForm />
      {alerts.length === 0 ? (
        <p className="px-3 py-4 text-muted">No alerts yet</p>
      ) : (
        <ul className="text-xs">
          {alerts.map((a) => {
            const pair = findPair(a.symbol);
            const pp = pair?.pricePrecision ?? 2;
            const name = pair ? `${pair.base}/${pair.quote}` : a.symbol;
            const label = `${name} ${a.direction} ${formatPrice(a.price, pp)}`;
            const triggered = a.triggeredAt !== undefined;
            return (
              <li
                key={a.id}
                className="flex h-8 items-center justify-between border-b border-line px-3"
              >
                <span className={triggered ? 'text-muted' : ''}>{label}</span>
                <span className="flex items-center gap-3">
                  {triggered ? (
                    <span className="tabular text-accent">
                      Triggered {formatTime(a.triggeredAt ?? 0)} @{' '}
                      {formatPrice(a.triggeredPrice ?? a.price, pp)}
                    </span>
                  ) : (
                    <span className="text-muted">Waiting</span>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Delete alert ${label}`}
                    onClick={() => dispatch(alertDeleted(a.id))}
                  >
                    Delete
                  </Button>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
