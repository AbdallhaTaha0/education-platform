import { useLang } from '../../../i18n';
import { formatEgp } from '../types/models';

/** Localized integer-EGP amount. Piastres in, formatted string out. */
export function Money({
  piastres,
  className,
}: {
  piastres: number;
  className?: string;
}): JSX.Element {
  const { lang } = useLang();
  return (
    <span className={className} dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      {formatEgp(piastres, lang)}
    </span>
  );
}
