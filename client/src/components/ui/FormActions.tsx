import type { ReactNode } from 'react';

interface FormActionsProps {
  children: ReactNode;
  className?: string;
  align?: 'center' | 'start';
  testId?: string;
}

/**
 * Centred standalone form/page action group.
 *
 * Centres the button group relative to its containing form or panel at every
 * supported width and in both directions (RTL/LTR), including when buttons
 * wrap. Use for standalone submits and page-level actions (login, register,
 * profile saves, logout, support save, authoring saves, recharge/purchase
 * confirmations, dialog confirmations).
 *
 * Do NOT use for contextual row/table/filter/toolbar/disclosure controls —
 * those remain attached to their context.
 */
export function FormActions({
  children,
  className = '',
  align = 'center',
  testId,
}: FormActionsProps): JSX.Element {
  const alignClass = align === 'start' ? 'form-actions--start' : '';
  return (
    <div
      className={`form-actions ${alignClass} ${className}`.trim()}
      data-testid={testId}
    >
      {children}
    </div>
  );
}
