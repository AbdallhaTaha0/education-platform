import { useLang } from '../../../i18n';
import { formatEgp } from '../types/models';
import { displayDeadline } from '../../academic/model';

export function PriceDisplay({
  current,
  previous,
  durationDays,
  accessEndsAt,
  accessMode,
}: {
  current: number;
  previous: number | null;
  durationDays: number | null;
  accessEndsAt?: string | null;
  accessMode?: string;
}): JSX.Element {
  const { t, lang } = useLang();
  return (
    <p className="m-0 flex flex-wrap items-baseline gap-2">
      <span
        className="text-xl font-extrabold text-ink"
        aria-label={`${t.priceLabel}: ${current === 0 ? (lang === 'ar' ? 'مجاني' : 'Free') : formatEgp(current, lang)}`}
      >
        {current === 0 ? (lang === 'ar' ? 'مجاني' : 'Free') : formatEgp(current, lang)}
      </span>
      {previous !== null ? (
        <s
          className="text-base text-muted"
          aria-label={`${t.previousPriceLabel}: ${formatEgp(previous, lang)}`}
        >
          {formatEgp(previous, lang)}
        </s>
      ) : null}
      <span className="inline-block rounded-full border border-border bg-canvas px-3 py-1 text-sm font-bold text-ink">
        {accessMode === 'UNTIL_REMOVAL'
          ? lang === 'ar'
            ? 'بدون انتهاء • حتى الحذف النهائي'
            : 'No expiry • until permanent removal'
          : durationDays !== null
            ? `${durationDays} ${t.daysUnit}`
            : accessEndsAt
              ? `${t.validUntil}: ${displayDeadline(accessEndsAt, lang)} (${lang === 'ar' ? 'القاهرة' : 'Cairo'})`
              : t.planUnavailable}
      </span>
      {previous !== null ? (
        <span className="inline-block rounded-full border border-success-fg bg-success-bg px-3 py-1 text-sm font-bold text-success-fg">
          {t.offerBadge}
        </span>
      ) : null}
    </p>
  );
}
