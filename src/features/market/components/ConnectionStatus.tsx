import { useAppSelector } from '../../../app/hooks';
import { selectConnection } from '../selectors';

const DOT = {
  live: 'bg-up',
  reconnecting: 'bg-accent',
  connecting: 'bg-muted',
  offline: 'bg-down',
} as const;

export function ConnectionStatus() {
  const { status, attempt } = useAppSelector(selectConnection);
  const label =
    status === 'live'
      ? 'Live'
      : status === 'reconnecting'
        ? `Reconnecting (attempt ${attempt})`
        : status === 'offline'
          ? 'Offline'
          : 'Connecting';
  return (
    <div role="status" className="flex items-center gap-2 text-xs text-muted">
      <span aria-hidden="true" className={`size-1.5 rounded-full ${DOT[status]}`} />
      <span>{label}</span>
    </div>
  );
}
