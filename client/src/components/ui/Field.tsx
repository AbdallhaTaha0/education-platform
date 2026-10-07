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
      {hint !== undefined ? <p id={`${id}-hint`} className="mt-2 text-sm text-muted">{hint}</p> : null}
      {error !== undefined ? (
        <p className="mt-2 text-sm font-semibold text-error-fg" role="alert" id={`${id}-error`}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function textInputClassName(invalid: boolean): string {
  return `min-h-[48px] w-full rounded-control border bg-field px-4 py-2.5 text-base text-ink transition-colors placeholder:text-muted hover:border-border-strong focus:border-primary ${
    invalid ? 'border-error-fg' : 'border-border-strong'
  }`;
}
