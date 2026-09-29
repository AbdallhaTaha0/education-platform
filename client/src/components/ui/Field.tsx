import type { ReactNode } from 'react';

interface FieldProps {
  id: string;
  label: string;
  error?: string;
  dir?: 'ltr' | 'rtl';
  hint?: string;
  children: ReactNode;
}

export function Field({ id, label, error, dir, hint, children }: FieldProps): JSX.Element {
  return (
    <div className="mb-4" dir={dir}>
      <label htmlFor={id} className="mb-2 block text-sm font-semibold">
        {label}
      </label>
      {children}
      {hint !== undefined ? <p className="mt-2 text-sm text-muted">{hint}</p> : null}
      {error !== undefined ? (
        <p className="mt-2 text-sm font-semibold text-error-fg" role="alert" id={`${id}-error`}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function textInputClassName(invalid: boolean): string {
  return `min-h-[44px] w-full rounded-control border bg-surface px-3 py-2 text-base text-ink ${
    invalid ? 'border-error-fg' : 'border-border'
  }`;
}
