import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  children: ReactNode;
}

const VARIANTS: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary: 'bg-primary text-white hover:bg-primary-hover border border-transparent',
  secondary: 'bg-surface text-primary border border-primary hover:bg-primary/5',
  danger: 'bg-error-bg text-error-fg border border-error-fg hover:brightness-95',
};

export function Button({ variant = 'primary', children, className = '', ...rest }: ButtonProps): JSX.Element {
  return (
    <button
      className={`inline-flex min-h-[44px] items-center justify-center rounded-control px-6 py-2 text-base font-semibold no-underline disabled:cursor-wait disabled:opacity-60 ${VARIANTS[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
