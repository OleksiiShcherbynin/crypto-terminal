import { useState, type ReactNode } from 'react';
import { Tabs } from '../../ui/Tabs';

export type BottomTabId = 'positions' | 'orders' | 'history' | 'alerts';

const TABS: { id: BottomTabId; label: string }[] = [
  { id: 'positions', label: 'Positions' },
  { id: 'orders', label: 'Open orders' },
  { id: 'history', label: 'History' },
  { id: 'alerts', label: 'Alerts' },
];

export interface BottomPanelProps {
  panels?: Partial<Record<BottomTabId, ReactNode>>;
  status?: ReactNode;
}

export function BottomPanel({ panels = {}, status }: BottomPanelProps) {
  const [active, setActive] = useState<BottomTabId>('positions');
  const content = panels[active];
  return (
    <section
      aria-label="Portfolio"
      className="flex min-h-0 flex-col border-t border-line bg-panel xl:col-span-3"
    >
      <div className="flex shrink-0 items-center justify-between border-b border-line pr-3">
        <Tabs
          tabs={TABS}
          active={active}
          onChange={(id) => setActive(id as BottomTabId)}
          idPrefix="portfolio"
        />
        {status}
      </div>
      <div
        role="tabpanel"
        id="portfolio-panel"
        aria-labelledby={`portfolio-${active}`}
        className="min-h-0 flex-1 overflow-auto"
      >
        {content ?? <p className="px-3 py-4 text-muted">Nothing here yet</p>}
      </div>
    </section>
  );
}
