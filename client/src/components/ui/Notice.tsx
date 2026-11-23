import type { ReactNode } from 'react';
import { BrandMark } from './BrandMark';
import { ErrorFeedback, SuccessFeedback } from './ErrorFeedback';

type Kind = 'error' | 'success' | 'info' | 'pending';

const CLASSES: Record<Kind, string> = {
  error: 'border-error-fg/70 bg-error-bg text-error-fg',
  success: 'border-success-fg/70 bg-success-bg text-success-fg',
  info: 'border-info-fg/60 bg-info-bg text-info-fg',
  pending: 'border-pending-fg/70 bg-pending-bg text-pending-fg',
};

export function Notice({
  kind,
  children,
  inline = false,
}: {
  kind: Kind;
  children: ReactNode;
  inline?: boolean;
}): JSX.Element | null {
  if (children === null || children === undefined || children === '') return null;
  if (kind === 'error') return <ErrorFeedback>{children}</ErrorFeedback>;
  if (kind === 'success' && !inline) return <SuccessFeedback>{children}</SuccessFeedback>;
  return (
    <div
      className={`mb-4 flex items-start gap-3 rounded-card border px-4 py-3.5 text-sm font-semibold leading-relaxed shadow-rest [&:empty]:hidden ${CLASSES[kind]}`}
      role="status"
    >
      <span
        aria-hidden="true"
        className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-current/30 bg-canvas/30 text-xs font-extrabold"
      >
        {kind === 'success' ? '✓' : kind === 'pending' ? '…' : 'i'}
      </span>
      <span className="min-w-0 flex-1">{children}</span>
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
