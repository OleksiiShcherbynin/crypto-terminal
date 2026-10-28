import { useId, type InputHTMLAttributes } from 'react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  suffix?: string;
  error?: string;
}

export function Input({ label, suffix, error, id, className = '', ...rest }: InputProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const errorId = `${inputId}-error`;
  return (
    <div className="flex flex-col gap-1">
      {label ? (
        <label htmlFor={inputId} className="text-xs text-muted">
          {label}
        </label>
      ) : null}
      <div
        className={`flex h-8 items-center rounded-sm border bg-bg px-2 focus-within:border-accent ${
          error ? 'border-down' : 'border-line'
        }`}
      >
        <input
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={`tabular min-w-0 flex-1 bg-transparent text-right text-sm outline-none placeholder:text-muted ${className}`}
          {...rest}
        />
        {suffix ? <span className="ml-2 text-xs text-muted">{suffix}</span> : null}
      </div>
      {error ? (
        <p id={errorId} role="alert" className="text-xs text-down">
          {error}
        </p>
      ) : null}
    </div>
  );
}
