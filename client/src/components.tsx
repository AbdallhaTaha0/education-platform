import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary';
  children: ReactNode;
}

export function Button({ variant = 'primary', children, ...rest }: ButtonProps): JSX.Element {
  return (
    <button className={`btn btn--${variant}`} type="button" {...rest}>
      {children}
    </button>
  );
}

export function Container({ children, id }: { children: ReactNode; id?: string }): JSX.Element {
  return (
    <div className="container" id={id}>
      {children}
    </div>
  );
}
