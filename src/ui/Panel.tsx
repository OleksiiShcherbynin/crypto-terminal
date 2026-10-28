import type { ReactNode } from 'react';

export interface PanelProps {
  title?: string;
  right?: ReactNode;
  children?: ReactNode;
}

export function Panel({ title, right, children }: PanelProps) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      {title || right ? (
        <div className="flex h-8 shrink-0 items-center justify-between border-b border-line px-3">
          {title ? <h2 className="text-xs font-medium text-muted">{title}</h2> : <span />}
          {right}
        </div>
      ) : null}
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}
