/**
 * FAYQ wordmark (single source of truth for brand markup).
 *
 * Variants: `full` (mark + name + tagline), `compact` (mark + name),
 * `monogram` (mark only). The SVG mark is decorative and hidden from assistive
 * technology; the product name stays real HTML text so it is never trapped in
 * a path, never reshaped, and never reversed in RTL (`dir="ltr"` is forced on
 * the Latin name in both languages).
 */
import { useLang } from '../../i18n';
import { PRODUCT_NAME, brandFor } from '../../brand';

export type WordmarkVariant = 'full' | 'compact' | 'monogram';

export function FayqMark({ size = 40 }: { size?: number }): JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      role="presentation"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="2" y="2" width="44" height="44" rx="12" fill="var(--fayq-forest)" />
      <rect x="2" y="2" width="44" height="44" rx="12" fill="none" stroke="var(--fayq-lime)" strokeOpacity="0.35" strokeWidth="2" />
      {/* Stylized Q: open ring in lime with an amber energy tail. */}
      <path
        d="M24 10a11 11 0 1 0 7.8 18.8"
        fill="none"
        stroke="var(--fayq-lime)"
        strokeWidth="4.5"
        strokeLinecap="round"
      />
      <line x1="29.5" y1="29.5" x2="37" y2="37" stroke="var(--fayq-lime)" strokeWidth="4.5" strokeLinecap="round" />
      <circle cx="35.5" cy="12.5" r="3.4" fill="var(--fayq-amber)" />
    </svg>
  );
}

export interface WordmarkProps {
  variant?: WordmarkVariant;
  /** Tagline under the name in the `full` variant; defaults to the slogan. */
  tagline?: string;
  /** Rendered size of the mark in px. */
  markSize?: number;
}

export function Wordmark({ variant = 'compact', tagline, markSize = 40 }: WordmarkProps): JSX.Element {
  const { lang } = useLang();
  const brand = brandFor(lang);
  if (variant === 'monogram') {
    return <FayqMark size={markSize} />;
  }
  return (
    <span className="inline-flex items-center gap-2.5" data-testid="fayq-wordmark">
      <FayqMark size={markSize} />
      <span className="flex flex-col leading-tight">
        <strong dir="ltr" className="text-start font-display text-xl font-extrabold tracking-tight text-ink">
          {PRODUCT_NAME}
        </strong>
        {variant === 'full' ? (
          <small className="text-sm text-muted">{tagline ?? brand.tagline}</small>
        ) : (
          <small className="text-sm text-muted">{brand.sub}</small>
        )}
      </span>
    </span>
  );
}
