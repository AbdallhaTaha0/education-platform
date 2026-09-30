/**
 * Brand identity tests (M5 correction round).
 *
 * The product name is a proper noun: it must be the literal string FAYQ in both
 * languages, never translated, transliterated or respelled. The English slogan
 * is fixed by the owner; the Arabic interface shows a natural Arabic rendering.
 */
import { describe, expect, it } from 'vitest';
import { PRODUCT_NAME, SLOGAN_AR, SLOGAN_EN, brandFor, documentTitleFor } from './brand';
import { routeDocumentTitle } from './pageTitles';
import { ar } from './locales/ar';
import { en } from './locales/en';

describe('FAYQ identity', () => {
  it('uses the exact product name in both languages', () => {
    expect(PRODUCT_NAME).toBe('FAYQ');
    expect(brandFor('ar').name).toBe('FAYQ');
    expect(brandFor('en').name).toBe('FAYQ');
    expect(ar.brand).toBe('FAYQ');
    expect(en.brand).toBe('FAYQ');
  });

  it('never transliterates or respells the name in either locale', () => {
    for (const strings of [ar, en]) {
      const localized = JSON.stringify(strings);
      for (const forbidden of ['فايق', 'فايكو', 'Faiq', 'FAIQ', 'FaYq', 'Learning Platform', 'منصة التعلم']) {
        expect(localized, `legacy branding still present: ${forbidden}`).not.toContain(forbidden);
      }
    }
  });

  it('uses the approved English slogan exactly', () => {
    expect(SLOGAN_EN).toBe('Learn It. Code It. Get It.');
    expect(brandFor('en').tagline).toBe('Learn It. Code It. Get It.');
    expect(en.slogan).toBe('Learn It. Code It. Get It.');
  });

  it('gives the Arabic interface a natural Arabic slogan, not a copy of the English one', () => {
    expect(SLOGAN_AR).not.toBe(SLOGAN_EN);
    // Arabic script, same three-beat structure, and no Latin letters.
    expect(SLOGAN_AR).toMatch(/^[\u0600-\u06FF.\s]+$/);
    expect(SLOGAN_AR.split('.').filter((s) => s.trim() !== '').length).toBe(3);
    expect(ar.slogan).toBe(SLOGAN_AR);
  });

  it('centralizes branding instead of repeating it per component', () => {
    expect(brandFor('ar').footer).toContain('FAYQ');
    expect(brandFor('en').footer).toContain('FAYQ');
    expect(ar.footer).toBe(brandFor('ar').footer);
    expect(en.footer).toBe(brandFor('en').footer);
    // The localized descriptor still differs per language; only the name is fixed.
    expect(ar.brandSub).not.toBe(en.brandSub);
  });

  it('builds metadata descriptions that carry the name', () => {
    expect(brandFor('ar').description).toContain('FAYQ');
    expect(brandFor('en').description).toContain('FAYQ');
    expect(brandFor('en').htmlLang).toBe('en');
    expect(brandFor('ar').htmlLang).toBe('ar');
  });
});

describe('document titles', () => {
  it('falls back to the brand headline when a screen has no label', () => {
    expect(documentTitleFor('en')).toBe('FAYQ — Learn It. Code It. Get It.');
    expect(documentTitleFor('ar')).toContain('FAYQ');
  });

  it('always keeps the product name in the title, in both languages', () => {
    expect(documentTitleFor('ar', 'تسجيل الدخول')).toContain('FAYQ');
    expect(documentTitleFor('en', 'Log in')).toBe('Log in | FAYQ');
  });

  it('resolves every route to a title containing FAYQ', () => {
    const routes = [
      'home',
      'courses',
      'course-detail',
      'register',
      'login',
      'account',
      'admin',
      'admin-catalog',
      'admin-course',
      'admin-recharge',
      'wallet',
      'wallet-recharge',
      'purchases',
      'purchase',
      'dashboard',
      'learn',
    ] as const;
    for (const route of routes) {
      const titleEn = routeDocumentTitle('en', route, en as unknown as Record<string, string>);
      const titleAr = routeDocumentTitle('ar', route, ar as unknown as Record<string, string>);
      expect(titleEn, `en title for ${route}`).toContain('FAYQ');
      expect(titleAr, `ar title for ${route}`).toContain('FAYQ');
    }
  });
});
