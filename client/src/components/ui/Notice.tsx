import type { ReactNode } from 'react';

type Kind = 'error' | 'success' | 'info' | 'pending';

const CLASSES: Record<Kind, string> = {
  error: 'border-error-fg bg-error-bg text-error-fg',
  success: 'border-success-fg bg-success-bg text-success-fg',
  info: 'border-border bg-canvas text-ink',
  pending: 'border-pending-fg bg-pending-bg text-pending-fg',
};

export function Notice({ kind, children }: { kind: Kind; children: ReactNode }): JSX.Element | null {
  if (children === null || children === undefined || children === '') return null;
  return (
    <p className={`mb-4 rounded-control border px-4 py-3 font-semibold [&:empty]:hidden ${CLASSES[kind]}`} role={kind === 'error' ? 'alert' : 'status'}>
      {children}
    </p>
  );
}

export function Loading({ text }: { text: string }): JSX.Element {
  return (
    <p className="text-muted" role="status" aria-live="polite">
      {text}
    </p>
  );
}

export function EmptyState({ text }: { text: string }): JSX.Element {
  return <p className="text-muted">{text}</p>;
}
