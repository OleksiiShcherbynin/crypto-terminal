import { useRef, type KeyboardEvent } from 'react';

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
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const i = tabs.findIndex((t) => t.id === active);
    if (i < 0 || tabs.length === 0) return;
    let next: number;
    if (e.key === 'ArrowRight') next = (i + 1) % tabs.length;
    else if (e.key === 'ArrowLeft') next = (i - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = tabs.length - 1;
    else return;
    e.preventDefault();
    const target = tabs[next];
    if (!target) return;
    refs.current[target.id]?.focus();
    onChange(target.id);
  }

  return (
    <div role="tablist" onKeyDown={onKeyDown} className="flex h-8 items-stretch gap-4 px-3">
      {tabs.map((t) => {
        const selected = t.id === active;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            ref={(el) => {
              refs.current[t.id] = el;
            }}
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
