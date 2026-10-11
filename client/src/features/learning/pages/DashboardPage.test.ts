import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, expect, it, vi } from 'vitest';
import { LanguageProvider } from '../../../i18n';
const state = vi.hoisted(() => ({ error: null as string | null, reload: vi.fn() }));
vi.mock('../hooks/useLearning', () => ({ useDashboard: () => ({
  loading: false, errorCode: state.error, reload: state.reload,
  data: { active: [{ titleEn: 'STALE PRIVATE COURSE', titleAr: 'STALE PRIVATE COURSE' }], expired: [] },
}) }));
import { DashboardPage } from './DashboardPage';
function render(lang: 'ar' | 'en'): string {
  return renderToStaticMarkup(createElement(LanguageProvider, { initialLang: lang,
    children: createElement(DashboardPage, { onContinue: vi.fn(), onRenew: vi.fn(), onBrowse: vi.fn() }) }));
}
beforeEach(() => { state.error = null; state.reload.mockClear(); });
for (const lang of ['ar', 'en'] as const) {
  for (const code of ['TOKEN_MISSING', 'TOKEN_INVALID', 'SESSION_EXPIRED', 'SESSION_REVOKED']) {
    it(`${lang} dashboard ${code}: sign in without Retry or stale course actions (mocked hook)`, () => {
      state.error = code;
      const html = render(lang);
      expect(html).toContain('href="#/login"');
      expect(html).toContain(lang === 'ar' ? 'انتهت جلسة الدخول' : 'Your sign-in session has ended');
      expect(html).not.toContain('<button');
      expect(html).not.toContain('STALE PRIVATE COURSE');
    });
  }
  it(`${lang} dashboard load failure retains Retry and hides stale courses`, () => {
    state.error = 'UNKNOWN';
    const html = render(lang);
    expect(html).not.toContain('href="#/login"');
    expect(html).toContain('<button');
    expect(html).not.toContain('STALE PRIVATE COURSE');
  });
}
