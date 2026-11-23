import type { ReactNode } from 'react';

interface FieldProps {
  id: string;
  label: string;
  error?: string;
  dir?: 'ltr' | 'rtl';
  hint?: string;
  hintDir?: 'ltr' | 'rtl';
  labelAside?: ReactNode;
  startAdornment?: ReactNode;
  endAdornment?: ReactNode;
  className?: string;
  children: ReactNode;
}

export function Field({
  id,
  label,
  error,
  dir,
  hint,
  hintDir,
  labelAside,
  startAdornment,
  endAdornment,
  className = '',
  children,
}: FieldProps): JSX.Element {
  const hasAdornment = startAdornment !== undefined || endAdornment !== undefined;
  return (
    <div className={`mb-4 text-start ${className}`} dir={dir}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <label htmlFor={id} className="block text-sm font-semibold text-ink">
          {label}
        </label>
        {labelAside}
      </div>
      {hasAdornment ? (
        <div
          className={`flex min-h-[48px] w-full items-center rounded-control border bg-field transition-colors hover:border-border-strong focus-within:border-primary ${
            error ? 'border-error-fg' : 'border-border-strong'
          }`}
        >
          {startAdornment !== undefined ? (
            <span className="pointer-events-none flex shrink-0 items-center ps-3.5 text-muted">
              {startAdornment}
            </span>
          ) : null}
          {children}
          {endAdornment !== undefined ? (
            <span className="flex shrink-0 items-center pe-1.5">
              {endAdornment}
            </span>
          ) : null}
        </div>
      ) : (
        children
      )}
      {hint !== undefined ? (
        <p id={`${id}-hint`} dir={hintDir} className="mt-1.5 text-start text-sm text-muted">
          {hint}
        </p>
      ) : null}
      {error !== undefined ? (
        <p className="mt-1.5 text-start text-sm font-semibold text-error-fg" role="alert" id={`${id}-error`}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function textInputClassName(invalid: boolean, extra = ''): string {
  return `min-h-[48px] w-full rounded-control border bg-field px-4 py-2.5 text-start text-base text-ink transition-colors placeholder:text-muted hover:border-border-strong focus:border-primary ${
    invalid ? 'border-error-fg' : 'border-border-strong'
  } ${extra}`.trim();
}

export function adornedInputClassName(extra = ''): string {
  return `min-h-[46px] min-w-0 flex-1 border-0 bg-transparent px-3.5 py-2.5 text-start text-base text-ink placeholder:text-muted focus:outline-none ${extra}`.trim();
}
