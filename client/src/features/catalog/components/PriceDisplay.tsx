import { useLang } from '../../../i18n';
import { formatEgp } from '../types/models';

export function PriceDisplay({ current, previous, durationDays }: { current: number; previous: number | null; durationDays: number }): JSX.Element {
  const { t, lang } = useLang();
  return (
    <p className="m-0 flex flex-wrap items-baseline gap-2">
      <span className="text-xl font-extrabold text-ink" aria-label={`${t.priceLabel}: ${formatEgp(current, lang)}`}>
        {formatEgp(current, lang)}
      </span>
      {previous !== null ? (
        <s className="text-base text-muted" aria-label={`${t.previousPriceLabel}: ${formatEgp(previous, lang)}`}>
          {formatEgp(previous, lang)}
        </s>
      ) : null}
      <span className="inline-block rounded-full border border-border bg-canvas px-3 py-1 text-sm font-bold text-ink" aria-label={`${t.durationLabel}: ${durationDays} ${t.daysUnit}`}>
        {durationDays} {t.daysUnit}
      </span>
      {previous !== null ? (
        <span className="inline-block rounded-full border border-success-fg bg-success-bg px-3 py-1 text-sm font-bold text-success-fg">{t.offerBadge}</span>
      ) : null}
    </p>
  );
}
