function fixed(precision: number): Intl.NumberFormat {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  });
}

const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });
const usd = fixed(2);
const pct = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  signDisplay: 'exceptZero',
});

export function formatPrice(value: number, precision: number): string {
  return fixed(precision).format(value);
}

export function formatQuantity(value: number, precision: number): string {
  return fixed(precision).format(value);
}

export function formatPct(value: number): string {
  return `${pct.format(value)}%`;
}

export function formatCompact(value: number): string {
  return compact.format(value);
}

export function formatUsd(value: number): string {
  return usd.format(value);
}

export function formatTime(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}
