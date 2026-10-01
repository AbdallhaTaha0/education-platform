import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { ar } from './locales/ar';
import { en } from './locales/en';

export type Lang = 'ar' | 'en';
export type Dir = 'rtl' | 'ltr';
export type Strings = typeof ar | typeof en;

const STRINGS = { ar, en } as const;

/** Language preference only (no auth/session tokens ever live in storage). */
const STORAGE_KEY = 'edu-platform-lang';
const DEFAULT_LANG: Lang = (import.meta.env['VITE_DEFAULT_LANG'] as Lang) === 'en' ? 'en' : 'ar';

interface LangContextValue {
  lang: Lang;
  dir: Dir;
  t: Strings;
  setLang: (lang: Lang) => void;
}

const LangContext = createContext<LangContextValue | null>(null);

function readInitialLang(): Lang {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'ar' || stored === 'en') return stored;
  } catch {
    // Storage may be unavailable (private mode); fall back to default.
  }
  return DEFAULT_LANG;
}

export function LanguageProvider({ children }: { children: ReactNode }): JSX.Element {
  const [lang, setLangState] = useState<Lang>(readInitialLang);
  const dir: Dir = lang === 'ar' ? 'rtl' : 'ltr';

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
  }, [lang, dir]);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Non-fatal: preference simply won't persist.
    }
  }, []);

  const value = useMemo<LangContextValue>(
    () => ({ lang, dir, t: STRINGS[lang], setLang }),
    [lang, dir, setLang],
  );
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang(): LangContextValue {
  const ctx = useContext(LangContext);
  if (ctx === null) throw new Error('useLang must be used inside LanguageProvider');
  return ctx;
}

/** Key-based translate function for components that prefer t('key'). */
export function useTranslate(): (key: keyof Strings) => string {
  const { t } = useLang();
  return useCallback((key: keyof Strings) => t[key] as string, [t]);
}

export function localizeCode(t: Strings, code: string | null | undefined): string {
  if (code === null || code === undefined) return t.err_UNKNOWN;
  const key = `err_${code}` as keyof Strings;
  const value = t[key];
  return typeof value === 'string' ? value : t.err_UNKNOWN;
}
