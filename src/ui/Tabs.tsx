export interface TabItem {
  id: string;
  label: string;
  badge?: number;
}

export interface TabsProps {
  tabs: TabItem[];
  active: string;
  onChange: (id: string) => void;
  idPrefix?: string;
}

export function Tabs({ tabs, active, onChange, idPrefix = 'tab' }: TabsProps) {
  return (
    <div role="tablist" className="flex h-8 items-stretch gap-4 px-3">
      {tabs.map((t) => {
        const selected = t.id === active;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`${idPrefix}-${t.id}`}
            aria-selected={selected}
            aria-controls={`${idPrefix}-panel`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(t.id)}
            className={`-mb-px cursor-pointer border-b px-0.5 text-xs transition-colors ${
              selected ? 'border-accent text-text' : 'border-transparent text-muted hover:text-text'
            }`}
          >
            {t.label}
            {t.badge ? <span className="tabular ml-1.5 text-muted">{t.badge}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
