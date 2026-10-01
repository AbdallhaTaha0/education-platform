import { useEffect, useRef, type ReactNode } from 'react';
import { Button } from './Button';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Keyboard-operable confirmation dialog with visible focus and sane tab order. */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: ConfirmDialogProps): JSX.Element | null {
  const confirmRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (open) confirmRef.current?.focus();
  }, [open]);
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="w-full max-w-md rounded-card border border-border bg-surface p-6 shadow-rest">
        <h2 className="mb-2 text-xl font-bold">{title}</h2>
        <p className="mb-6 text-muted">{body}</p>
        <div className="flex flex-wrap gap-3">
          <span ref={confirmRef as never} tabIndex={-1} className="contents">
            <Button variant="primary" onClick={onConfirm}>
              {confirmLabel}
            </Button>
          </span>
          <Button variant="secondary" onClick={onCancel}>
            {cancelLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

interface DialogProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

/** Generic accessible dialog shell with initial focus and Escape-to-close. */
export function Dialog({ open, title, onClose, children }: DialogProps): JSX.Element | null {
  const titleRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (open) titleRef.current?.focus();
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-ink/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="w-full max-w-lg rounded-card border border-border bg-surface p-6 shadow-rest">
        <h2 ref={titleRef} tabIndex={-1} className="mb-2 text-xl font-bold">
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}

export function StatusBadge({
  text,
  tone,
}: {
  text: string;
  tone: 'success' | 'pending' | 'error' | 'info';
  label?: string;
}): JSX.Element {
  const tones = {
    success: 'border-success-fg bg-success-bg text-success-fg',
    pending: 'border-pending-fg bg-pending-bg text-pending-fg',
    error: 'border-error-fg bg-error-bg text-error-fg',
    info: 'border-border bg-canvas text-ink',
  } as const;
  return (
    <span
      className={`inline-block rounded-full border px-3 py-1 text-sm font-bold ${tones[tone]}`}
      aria-label={text}
    >
      {text as ReactNode}
    </span>
  );
}
