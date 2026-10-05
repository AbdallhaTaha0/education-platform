export function progressPercent(value: number): number {
  return Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 0;
}

/** Omit the value while the operation has no measurable total. */
export function ProgressBar({ value, label, className = '' }: {
  value?: number;
  label: string;
  className?: string;
}): JSX.Element {
  const percent = value === undefined ? undefined : progressPercent(value);
  return <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100}
    aria-valuenow={percent} className={`h-2 w-full overflow-hidden rounded-full bg-canvas ${className}`}>
    <div className={`h-full rounded-full bg-primary ${percent === undefined ? 'w-1/3 motion-safe:animate-pulse' : 'motion-safe:transition-[width]'}`}
      style={percent === undefined ? undefined : { width: `${percent}%` }} />
  </div>;
}
