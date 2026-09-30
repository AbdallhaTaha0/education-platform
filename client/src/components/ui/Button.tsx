import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  children: ReactNode;
}

const VARIANTS: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary: 'bg-primary text-primary-ink hover:bg-primary-hover active:bg-primary-pressed border border-transparent shadow-rest hover:shadow-lift',
  secondary: 'bg-surface text-ink border border-border-strong hover:border-primary hover:bg-interactive',
  danger: 'bg-error-bg text-error-fg border border-error-fg hover:brightness-95',
};

export function Button({ variant = 'primary', children, className = '', ...rest }: ButtonProps): JSX.Element {
  return (
    <button
      className={`inline-flex min-h-[44px] items-center justify-center gap-2 rounded-control px-6 py-2 text-base font-bold no-underline transition-[background-color,border-color,box-shadow,transform] duration-150 hover:-translate-y-px disabled:cursor-wait disabled:translate-y-0 disabled:opacity-60 ${VARIANTS[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
