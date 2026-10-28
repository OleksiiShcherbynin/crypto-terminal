import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'ghost' | 'buy' | 'sell';
type Size = 'sm' | 'md';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const variants: Record<Variant, string> = {
  primary: 'bg-accent text-bg hover:brightness-110',
  ghost: 'border border-line text-text hover:bg-panel-2',
  buy: 'bg-up text-bg hover:brightness-110',
  sell: 'bg-down text-bg hover:brightness-110',
};

const sizes: Record<Size, string> = {
  sm: 'h-6 px-2 text-xs',
  md: 'h-8 px-3 text-sm',
};

export function Button({
  variant = 'primary',
  size = 'md',
  type = 'button',
  className = '',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex cursor-pointer items-center justify-center rounded-sm font-medium transition-[filter,background-color] disabled:cursor-not-allowed disabled:opacity-40 ${variants[variant]} ${sizes[size]} ${className}`}
      {...rest}
    />
  );
}
