import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type Lang = 'ar' | 'en';
export type Dir = 'rtl' | 'ltr';

/** Language preference only (no auth/session tokens ever live in storage). */
const STORAGE_KEY = 'edu-platform-lang';
const DEFAULT_LANG: Lang = (import.meta.env['VITE_DEFAULT_LANG'] as Lang) === 'en' ? 'en' : 'ar';

const STRINGS = {
  ar: {
    brand: 'منصة التعلم',
    brandSub: 'دورات برمجية مسجلة',
    navHome: 'الرئيسية',
    navStatus: 'حالة المنصة',
    langLabel: 'اللغة',
    heroBadge: 'الأساس التقني — الإصدار الأول',
    heroTitle: 'تعلّم البرمجة بالعربية، بدروس مسجلة منظمة',
    heroBody:
      'منصة مصرية تقدم دورات برمجية مسجلة باشتراكات محددة المدة. هذه الصفحة التأسيسية تعرض حالة تشغيل المنصة فقط؛ المزايا الكاملة (الحسابات، المحفظة، الاشتراكات) ستتوفر في المراحل التالية.',
    heroPrimary: 'عرض حالة المنصة',
    heroSecondary: 'كيف تعمل المنصة؟',
    howTitle: 'كيف ستعمل المنصة؟',
    howBody:
      'تشحن محفظتك بالجنيه المصري عبر طلب تحويل يدوي يعتمده الإدارة بعد التحقق من الاستلام، ثم تشتري الدورة صراحة وتبدأ مدة الوصول فور الشراء. عند انتهاء المدة يتوقف الوصول ويتطلب التجديد.',
    statusTitle: 'حالة البيئة التأسيسية',
    statusBody: 'فحوصات حية للخدمات الأساسية عبر بوابة المنصة. لا تعرض أي بيانات تشغيلية حساسة.',
    liveLabel: 'الخادم (Liveness)',
    readyLabel: 'الجاهزية (PostgreSQL و Redis)',
    stateLoading: 'جارٍ الفحص…',
    stateUp: 'متاح',
    stateDown: 'غير متاح',
    retry: 'إعادة الفحص',
    footer: 'منصة التعلم — بيئة تأسيسية (M1). لا توجد مزايا شراء أو دخول بعد.',
    skipToContent: 'تخطَّ إلى المحتوى',
  },
  en: {
    brand: 'Learning Platform',
    brandSub: 'Recorded programming courses',
    navHome: 'Home',
    navStatus: 'Platform status',
    langLabel: 'Language',
    heroBadge: 'Technical foundation — first release',
    heroTitle: 'Learn programming in Arabic, with organized recorded lessons',
    heroBody:
      'An Egyptian platform offering recorded programming courses on fixed-duration subscriptions. This foundation page only reports platform health; full features (accounts, wallet, subscriptions) arrive in later milestones.',
    heroPrimary: 'View platform status',
    heroSecondary: 'How will it work?',
    howTitle: 'How will the platform work?',
    howBody:
      'You top up your EGP wallet with a manual transfer request approved by administration after verifying receipt, then explicitly purchase a course and access starts immediately. When the duration ends, access stops and requires renewal.',
    statusTitle: 'Foundation environment status',
    statusBody: 'Live checks of core services through the platform gateway. No sensitive operational data is shown.',
    liveLabel: 'Server (Liveness)',
    readyLabel: 'Readiness (PostgreSQL & Redis)',
    stateLoading: 'Checking…',
    stateUp: 'Available',
    stateDown: 'Unavailable',
    retry: 'Retry checks',
    footer: 'Learning Platform — foundation environment (M1). No purchase or login features yet.',
    skipToContent: 'Skip to content',
  },
} as const;

export type Strings = (typeof STRINGS)[keyof typeof STRINGS];

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
    document.title = lang === 'ar' ? 'منصة التعلم | Learning Platform' : 'Learning Platform | منصة التعلم';
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
  if (!ctx) throw new Error('useLang must be used inside LanguageProvider');
  return ctx;
}
