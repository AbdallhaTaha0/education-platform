import { useId, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { useLang } from '../../i18n';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  children: ReactNode;
  /** Omit only for actions disabled while their current request is in flight. */
  disabledReason?: string | { ar: string; en: string };
  /** Preserve the styling of existing custom controls. */
  unstyled?: boolean;
}

const VARIANTS: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary:
    'bg-primary text-primary-ink hover:bg-primary-hover active:bg-primary-pressed border border-transparent shadow-rest hover:shadow-lift',
  secondary:
    'bg-surface text-ink border border-border-strong hover:border-primary hover:bg-interactive',
  danger: 'bg-error-bg text-error-fg border border-error-fg hover:brightness-95',
};

export function Button({
  variant = 'primary',
  children,
  className = '',
  disabledReason,
  unstyled = false,
  ...rest
}: ButtonProps): JSX.Element {
  const { lang } = useLang();
  const id = useId();
  const reason = rest.disabled ? typeof disabledReason === 'string' ? disabledReason
    : disabledReason?.[lang] ?? (lang === 'ar'
      ? 'انتظر انتهاء الطلب الحالي، ثم حاول مجددًا.'
      : 'Wait for the current request to finish, then try again.') : undefined;
  return (
    <button
      className={`${unstyled ? '' : `inline-flex min-h-[44px] items-center justify-center gap-2 rounded-control px-6 py-2 text-base font-bold no-underline transition-[background-color,border-color,box-shadow,transform] duration-150 hover:-translate-y-px disabled:translate-y-0 disabled:opacity-75 ${VARIANTS[variant]}`} ${className} ${reason ? 'flex-col !cursor-not-allowed' : ''}`}
      {...rest}
      aria-labelledby={rest['aria-labelledby'] ?? (rest['aria-label'] ? undefined : `${id}-label`)}
      aria-describedby={[rest['aria-describedby'], reason ? `${id}-reason` : undefined].filter(Boolean).join(' ') || undefined}
      title={reason ?? rest.title}
    >
      <span id={`${id}-label`} className={unstyled ? 'contents' : 'inline-flex min-w-0 max-w-full items-center justify-center gap-2'}>{children}</span>
      {reason ? <span id={`${id}-reason`} data-disabled-reason className="block max-w-[22rem] whitespace-normal text-xs font-normal leading-relaxed">{reason}</span> : null}
    </button>
  );
}
