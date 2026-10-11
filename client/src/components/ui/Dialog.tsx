import { useEffect, useRef, type ReactNode, type RefObject } from 'react';
import { Button } from './Button';
import { FormActions } from './FormActions';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

function useModalKeyboard(open: boolean, onClose: () => void, container: RefObject<HTMLDivElement>): void {
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const root = container.current;
    (root?.querySelector<HTMLElement>('[data-dialog-initial]') ?? root)?.focus();
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close.current();
      }
      if (event.key !== 'Tab' || !container.current) return;
      const controls = [...container.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')]
        .filter(element => element.getClientRects().length > 0);
      if (!controls.length) { event.preventDefault(); container.current.focus(); return; }
      const first = controls[0], last = controls[controls.length - 1];
      const initial = container.current.querySelector<HTMLElement>('[data-dialog-initial]');
      if (!container.current.contains(document.activeElement)) { event.preventDefault(); first?.focus(); }
      else if (event.shiftKey && document.activeElement === initial) { event.preventDefault(); last?.focus(); }
      else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [open, container]);
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
  const dialogRef = useRef<HTMLDivElement>(null);
  useModalKeyboard(open, onCancel, dialogRef);
  if (!open) return null;
  return (
    <div
      ref={dialogRef}
      tabIndex={-1}
      className="fixed inset-0 z-50 flex items-center justify-center bg-scrim p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto overscroll-contain rounded-card border border-border-strong bg-elevated p-6 shadow-lift">
        <h2 className="mb-2 text-xl font-bold">{title}</h2>
        <p className="mb-6 text-muted">{body}</p>
        <FormActions className="mt-0">
          <Button variant="primary" onClick={onConfirm}>
            {confirmLabel}
          </Button>
          <Button data-dialog-initial variant="secondary" onClick={onCancel}>
            {cancelLabel}
          </Button>
        </FormActions>
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
  const dialogRef = useRef<HTMLDivElement>(null);
  useModalKeyboard(open, onClose, dialogRef);
  if (!open) return null;
  return (
    <div
      ref={dialogRef}
      tabIndex={-1}
      className="fixed inset-0 z-50 flex items-center justify-center bg-scrim p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="max-h-[calc(100dvh-2rem)] min-w-0 w-full max-w-lg overflow-y-auto overscroll-contain rounded-card border border-border-strong bg-elevated p-4 shadow-lift sm:p-6">
        <h2 data-dialog-initial tabIndex={-1} className="mb-2 text-xl font-bold">
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
    info: 'border-info-fg bg-info-bg text-info-fg',
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
