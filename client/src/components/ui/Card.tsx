import type { HTMLAttributes, ReactNode } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  className?: string;
}

export function Card({ children, className = '', ...rest }: CardProps): JSX.Element {
  return (
    <div
      className={`rounded-card border border-border bg-surface p-6 shadow-rest ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

export function Container({ children, id }: { children: ReactNode; id?: string }): JSX.Element {
  return (
    <div className="mx-auto w-full max-w-content px-6 max-[480px]:px-4" id={id}>
      {children}
    </div>
  );
}
