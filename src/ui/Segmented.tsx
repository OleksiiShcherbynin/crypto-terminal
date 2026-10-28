export interface SegmentedProps {
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  'aria-label'?: string;
}

export function Segmented({ options, value, onChange, 'aria-label': ariaLabel }: SegmentedProps) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="inline-flex overflow-hidden rounded-sm border border-line"
    >
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(o.value)}
            className={`tabular h-6 cursor-pointer px-2 text-xs transition-colors ${
              selected ? 'bg-panel-2 text-accent' : 'text-muted hover:text-text'
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
