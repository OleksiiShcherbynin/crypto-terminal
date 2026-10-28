export interface MarketFilterProps {
  value: string;
  onChange: (value: string) => void;
}

export function MarketFilter({ value, onChange }: MarketFilterProps) {
  return (
    <div className="border-b border-line px-3 py-2">
      <input
        type="search"
        aria-label="Filter pairs"
        placeholder="Filter pairs"
        autoComplete="off"
        spellCheck={false}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-7 w-full rounded-sm border border-line bg-bg px-2 text-sm outline-none placeholder:text-muted focus:border-accent"
      />
    </div>
  );
}
