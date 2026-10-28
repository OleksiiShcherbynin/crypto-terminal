import { useDispatch, useSelector } from 'react-redux';
import type { RootState } from '../../../app/store';
import type { ToastKind } from '../../../domain/types';
import { toastDismissed } from '../toastsSlice';

const accent: Record<ToastKind, string> = {
  success: 'bg-up',
  error: 'bg-down',
  warning: 'bg-accent',
  info: 'bg-muted',
};

const selectToasts = (s: RootState) => s.toasts.items;

export function ToastStack() {
  const toasts = useSelector(selectToasts);
  const dispatch = useDispatch();
  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed right-3 bottom-3 z-50 flex w-[360px] max-w-[calc(100vw-1.5rem)] flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role={toast.kind === 'error' ? 'alert' : 'status'}
          className="pointer-events-auto flex overflow-hidden rounded-sm border border-line bg-panel-2 shadow-lg shadow-black/40"
        >
          <span aria-hidden="true" className={`w-1 shrink-0 ${accent[toast.kind]}`} />
          <div className="min-w-0 flex-1 px-3 py-2">
            <p className="text-sm font-medium text-text">{toast.title}</p>
            {toast.message ? <p className="mt-0.5 text-xs text-muted">{toast.message}</p> : null}
          </div>
          <button
            type="button"
            aria-label="Dismiss notification"
            onClick={() => dispatch(toastDismissed(toast.id))}
            className="cursor-pointer px-2 text-muted hover:text-text"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
      ))}
    </div>
  );
}
