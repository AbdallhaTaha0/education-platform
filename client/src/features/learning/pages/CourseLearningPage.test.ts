import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LanguageProvider } from '../../../i18n';

const state = vi.hoisted(() => ({ outlineError: null as string | null, playbackError: null as string | null, materials: vi.fn() }));
vi.mock('../hooks/useLearning', () => ({
  useOutline: () => ({ data: null, loading: false, errorCode: state.outlineError, reload: vi.fn() }),
  usePlayback: () => ({ errorCode: state.playbackError, progress: {}, grant: null, release: vi.fn(), end: vi.fn() }),
}));
vi.mock('../components/CoursePlan', () => ({ CoursePlan: () => null, useLearningLabels: () => ({}) }));
vi.mock('../player/Player', () => ({ DashLessonPlayer: () => null }));
vi.mock('../player/session', () => ({ clear: vi.fn() }));
vi.mock('../../assessments/LessonAssessments', () => ({ LessonAssessments: () => null }));
vi.mock('../materials/LessonMaterials', () => ({ ResourcesPanel: () => null }));
vi.mock('../materials/useLessonMaterials', () => ({ useLessonMaterials: (...args: unknown[]) => state.materials(...args) }));
vi.mock('../sessions/OwnSessionRecovery', () => ({ OwnSessionRecovery: () => null }));
import { CourseLearningPage } from './CourseLearningPage';

function markup(lang: 'ar' | 'en'): string {
  return renderToStaticMarkup(createElement(LanguageProvider, { initialLang: lang,
    children: createElement(CourseLearningPage, { courseSlug: 'synthetic-course', onRenew: vi.fn() }) }));
}
beforeEach(() => { state.outlineError = null; state.playbackError = null; state.materials.mockClear(); });

describe('learning access recovery presentation (mocked hooks, no browser/playback evidence)', () => {
  for (const lang of ['ar', 'en'] as const) {
    for (const code of ['TOKEN_MISSING', 'TOKEN_INVALID', 'SESSION_EXPIRED', 'SESSION_REVOKED']) {
      for (const source of ['outline', 'playback']) {
        it(`${lang} ${source} ${code}: sign in before any retry`, () => {
          if (source === 'outline') state.outlineError = code;
          else state.playbackError = code;
          const html = markup(lang);
          expect(html).toContain('href="#/login"');
          expect(html).toContain(lang === 'ar' ? 'انتهت جلسة الدخول' : 'Your sign-in session has ended');
          expect(html).not.toContain('<button');
          expect(state.materials).toHaveBeenCalledWith(null, true);
        });
      }
    }
    it(`${lang}: subscription expiry retains renewal instead of sign-in guidance`, () => {
      state.outlineError = 'SUBSCRIPTION_EXPIRED';
      const html = markup(lang);
      expect(html).not.toContain('href="#/login"');
      expect(html).toContain('<button');
      expect(state.materials).toHaveBeenCalledWith(null, true);
    });
    it(`${lang}: unrelated load failures retain Retry`, () => {
      state.outlineError = 'UNKNOWN';
      const html = markup(lang);
      expect(html).not.toContain('href="#/login"');
      expect(html).toContain('<button');
      expect(state.materials).toHaveBeenCalledWith(null, false);
    });
  }
});
