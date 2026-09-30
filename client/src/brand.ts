/**
 * FAYQ product identity (single source of truth).
 *
 * The product name is a proper noun and is never translated, transliterated or
 * respelled: it is the literal string `FAYQ` in the Arabic and the English
 * interface, in the document title, and in metadata. Only the surrounding
 * descriptor and the slogan are localized.
 *
 * Components must import from here instead of repeating the name, so a future
 * rebrand is a single-file change.
 */

export const PRODUCT_NAME = 'FAYQ';

/** Approved English slogan, used exactly as written. */
export const SLOGAN_EN = 'Learn It. Code It. Get It.';

/**
 * Natural Arabic rendering of the approved English slogan. The Arabic interface
 * shows this; the product name itself stays `FAYQ`.
 *
 * Owner-specified wording (correction round): "تعلمها. برمجها. حققها."
 */
export const SLOGAN_AR = 'تعلمها. برمجها. حققها.';

export type BrandLang = 'ar' | 'en';

export interface BrandStrings {
  /** Always the literal product name, in both languages. */
  name: typeof PRODUCT_NAME;
  tagline: string;
  /** Short descriptor shown under the name in the header. */
  sub: string;
  /** Footer line. */
  footer: string;
  /** `<meta name="description">` content. */
  description: string;
  /** `lang` attribute value for the Arabic interface. */
  htmlLang: 'ar' | 'en';
}

const AR: BrandStrings = {
  name: PRODUCT_NAME,
  tagline: SLOGAN_AR,
  sub: 'دورات برمجية مسجلة',
  footer: `${PRODUCT_NAME} — دورات برمجية مسجلة.`,
  description: `${PRODUCT_NAME} — منصة مصرية لتقديم دورات برمجية مسجلة باشتراكات محددة المدة. ${SLOGAN_AR}`,
  htmlLang: 'ar',
};

const EN: BrandStrings = {
  name: PRODUCT_NAME,
  tagline: SLOGAN_EN,
  sub: 'Recorded programming courses',
  footer: `${PRODUCT_NAME} — recorded programming courses.`,
  description: `${PRODUCT_NAME} — a learning platform for recorded programming courses on fixed-duration subscriptions. ${SLOGAN_EN}`,
  htmlLang: 'en',
};

const BY_LANG: Record<BrandLang, BrandStrings> = { ar: AR, en: EN };

export function brandFor(lang: BrandLang): BrandStrings {
  return BY_LANG[lang === 'en' ? 'en' : 'ar'];
}

/**
 * Document title for a screen. The product name always leads so the tab is
 * identifiable in both languages, and the name itself is never localized.
 */
export function documentTitleFor(lang: BrandLang, section?: string): string {
  const base = brandFor(lang);
  return section === undefined || section === '' ? `${base.name} — ${base.tagline}` : `${section} | ${base.name}`;
}
