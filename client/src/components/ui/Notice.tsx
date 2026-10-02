import type { ReactNode } from 'react';
import { BrandMark } from './BrandMark';
import { ErrorFeedback } from './ErrorFeedback';

type Kind = 'error' | 'success' | 'info' | 'pending';

const CLASSES: Record<Kind, string> = {
  error: 'border-error-fg bg-error-bg text-error-fg',
  success: 'border-success-fg bg-success-bg text-success-fg',
  info: 'border-border bg-canvas text-ink',
  pending: 'border-pending-fg bg-pending-bg text-pending-fg',
};

export function Notice({
  kind,
  children,
}: {
  kind: Kind;
  children: ReactNode;
}): JSX.Element | null {
  if (children === null || children === undefined || children === '') return null;
  if (kind === 'error') return <ErrorFeedback>{children}</ErrorFeedback>;
  return (
    <div
      className={`mb-4 flex items-start gap-3 rounded-control border px-4 py-3 font-semibold [&:empty]:hidden ${CLASSES[kind]}`}
      role="status"
    >
      <span aria-hidden="true" className="mt-0.5 text-lg">
        {kind === 'success' ? '✓' : kind === 'pending' ? '…' : 'i'}
      </span>
      {children}
    </div>
  );
}

export function Loading({ text }: { text: string }): JSX.Element {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="flex flex-col gap-2">
      <BrandMark size="sm" withSlogan={false} />
      <p className="text-muted">{text}</p>
    </div>
  );
}

export function EmptyState({ text }: { text: string }): JSX.Element {
  return (
    <div className="flex flex-col gap-2">
      <BrandMark size="sm" withSlogan={false} />
      <p className="text-muted">{text}</p>
    </div>
  );
}
