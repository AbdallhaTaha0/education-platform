import { useLang } from '../../i18n';
import { PRODUCT_NAME, brandFor } from '../../brand';
export type WordmarkVariant = 'full' | 'compact' | 'monogram';
/** Editable reconstruction of the supplied board, not an original vector export. */
export function FayqMark({ size = 40 }: { size?: number }): JSX.Element {
  return <svg width={size} height={size} viewBox="0 0 90 96" aria-hidden="true" focusable="false">
    <path d="M69 68a27 27 0 1 0-15 13" fill="none" stroke="var(--color-primary-strong)" strokeWidth="18" />
    <path d="M48 49 87 86H61L34 57Z" fill="var(--fayq-lime)" />
    <path d="m29 15-4-8m24 4V2m18 14 6-7" stroke="var(--fayq-amber)" strokeWidth="6" strokeLinecap="round" />
  </svg>;
}
export interface WordmarkProps { variant?: WordmarkVariant; tagline?: string; markSize?: number }
export function Wordmark({ variant = 'compact', tagline, markSize = 40 }: WordmarkProps): JSX.Element {
  const { lang } = useLang();
  if (variant === 'monogram') return <span role="img" aria-label={PRODUCT_NAME}><FayqMark size={markSize} /></span>;
  return <span className="fayq-wordmark" data-testid="fayq-wordmark">
    <span className="sr-only">{PRODUCT_NAME}</span>
    <svg viewBox="0 0 272 100" width={markSize * 3.5} height={markSize * 1.3} aria-hidden="true" focusable="false" className="fayq-wordmark__letters">
      <g fill="currentColor"><path d="M0 84V35L12 21H68L58 37H20V48H56L46 63H20V84Z" /><path fillRule="evenodd" d="M59 84 87 21H111L135 84H114L108 69H84L78 84ZM91 54H103L97 38Z" /><path d="M115 21H137L152 44 171 21H194L162 64 159 84H138L142 63Z" /></g>
      <path d="M239 67a27 27 0 1 0-15 13" fill="none" stroke="var(--color-primary-strong)" strokeWidth="18" />
      <path d="M218 50 260 86H235L204 57Z" fill="var(--fayq-lime)" />
      <path d="m200 15-4-8m23 4V2m19 14 6-7" stroke="var(--fayq-amber)" strokeWidth="6" strokeLinecap="round" />
    </svg>
    {variant === 'full' ? <small>{tagline ?? brandFor(lang).tagline}</small> : null}
  </span>;
}
