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
    navAccount: 'حسابي',
    navLogin: 'تسجيل الدخول',
    navAdmin: 'الإدارة',
    authChecking: 'جارٍ التحقق من الجلسة…',
    loginTitle: 'تسجيل الدخول',
    loginBody: 'ادخل باستخدام بريدك الإلكتروني أو رقم هاتفك المصري وكلمة المرور.',
    registerTitle: 'إنشاء حساب طالب',
    registerBody: 'البريد الإلكتروني ورقم الهاتف كلاهما مطلوبان للتسجيل.',
    fieldName: 'الاسم المعروض',
    fieldEmail: 'البريد الإلكتروني',
    fieldPhone: 'رقم الهاتف',
    fieldPassword: 'كلمة المرور',
    fieldPasswordConfirm: 'تأكيد كلمة المرور',
    fieldIdentifier: 'البريد الإلكتروني أو رقم الهاتف',
    passwordHint: '12 حرفًا على الأقل. يمكنك استخدام عبارة مرور طويلة.',
    submitRegister: 'إنشاء الحساب',
    submitLogin: 'دخول',
    submitAdminCreate: 'إنشاء حساب إدارة',
    logout: 'تسجيل الخروج',
    logoutAll: 'تسجيل الخروج من كل الأجهزة',
    accountTitle: 'حسابي',
    accountRole: 'الدور',
    roleStudent: 'طالب',
    roleAdmin: 'إدارة',
    accountSince: 'عضو منذ',
    adminTitle: 'إدارة الهوية',
    adminBody: 'إنشاء حساب إدارة جديد. يتطلب دور الإدارة.',
    adminLoginRequired: 'سجّل الدخول بحساب إدارة للوصول إلى هذه الصفحة.',
    forbiddenTitle: 'غير مسموح',
    forbiddenBody: 'حسابك الحالي لا يملك صلاحية الوصول إلى هذه الصفحة.',
    successRegister: 'تم إنشاء حسابك وتسجيل دخولك.',
    successLogin: 'تم تسجيل الدخول بنجاح.',
    successLogout: 'تم تسجيل الخروج.',
    successLogoutAll: 'تم تسجيل الخروج من كل الجلسات.',
    successAdminCreate: 'تم إنشاء حساب الإدارة.',
    needLogin: 'سجّل الدخول أولًا للوصول إلى هذه الصفحة.',
    sessionExpiredNotice: 'انتهت جلستك. سجّل الدخول مجددًا.',
    passwordsMismatch: 'كلمتا المرور غير متطابقتين.',
    err_REQUIRED: 'هذا الحقل مطلوب.',
    err_INVALID_CREDENTIALS: 'بيانات الدخول غير صحيحة.',
    err_VALIDATION_ERROR: 'تحقق من الحقول المدخلة.',
    err_EMAIL_TAKEN: 'هذا البريد مسجل بالفعل.',
    err_PHONE_TAKEN: 'هذا الهاتف مسجل بالفعل.',
    err_RATE_LIMITED: 'محاولات كثيرة. انتظر قليلًا ثم أعد المحاولة.',
    err_SESSION_EXPIRED: 'انتهت الجلسة. سجّل الدخول مجددًا.',
    err_SESSION_REVOKED: 'أُنهيت الجلسة. سجّل الدخول مجددًا.',
    err_TOKEN_INVALID: 'الجلسة غير صالحة. سجّل الدخول مجددًا.',
    err_FORBIDDEN: 'لا تملك صلاحية تنفيذ هذا الإجراء.',
    err_CSRF_INVALID: 'تعذر التحقق من الطلب. حدّث الصفحة وحاول مجددًا.',
    err_ORIGIN_FORBIDDEN: 'مصدر الطلب غير مسموح.',
    err_SERVICE_ERROR: 'عطل في الخدمة. حاول لاحقًا.',
    err_UNKNOWN: 'حدث خطأ غير متوقع.',
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
    navAccount: 'My account',
    navLogin: 'Log in',
    navAdmin: 'Admin',
    authChecking: 'Checking your session…',
    loginTitle: 'Log in',
    loginBody: 'Sign in with your email or Egyptian phone number and password.',
    registerTitle: 'Create a student account',
    registerBody: 'Both an email address and a phone number are required.',
    fieldName: 'Display name',
    fieldEmail: 'Email',
    fieldPhone: 'Phone number',
    fieldPassword: 'Password',
    fieldPasswordConfirm: 'Confirm password',
    fieldIdentifier: 'Email or phone number',
    passwordHint: 'At least 12 characters. A long passphrase works well.',
    submitRegister: 'Create account',
    submitLogin: 'Log in',
    submitAdminCreate: 'Create admin account',
    logout: 'Log out',
    logoutAll: 'Log out everywhere',
    accountTitle: 'My account',
    accountRole: 'Role',
    roleStudent: 'Student',
    roleAdmin: 'Admin',
    accountSince: 'Member since',
    adminTitle: 'Identity administration',
    adminBody: 'Create a new admin account. Requires the admin role.',
    adminLoginRequired: 'Sign in with an admin account to open this page.',
    forbiddenTitle: 'Not allowed',
    forbiddenBody: 'Your current account may not open this page.',
    successRegister: 'Your account was created and you are signed in.',
    successLogin: 'Signed in successfully.',
    successLogout: 'Signed out.',
    successLogoutAll: 'Signed out of all sessions.',
    successAdminCreate: 'Admin account created.',
    needLogin: 'Sign in first to open this page.',
    sessionExpiredNotice: 'Your session ended. Sign in again.',
    passwordsMismatch: 'The two passwords do not match.',
    err_REQUIRED: 'This field is required.',
    err_INVALID_CREDENTIALS: 'Incorrect email/phone or password.',
    err_VALIDATION_ERROR: 'Check the entered fields.',
    err_EMAIL_TAKEN: 'This email is already registered.',
    err_PHONE_TAKEN: 'This phone is already registered.',
    err_RATE_LIMITED: 'Too many attempts. Wait a little, then retry.',
    err_SESSION_EXPIRED: 'Session expired. Sign in again.',
    err_SESSION_REVOKED: 'Session was ended. Sign in again.',
    err_TOKEN_INVALID: 'Invalid session. Sign in again.',
    err_FORBIDDEN: 'You may not perform this action.',
    err_CSRF_INVALID: 'Could not verify the request. Reload and retry.',
    err_ORIGIN_FORBIDDEN: 'Request origin is not allowed.',
    err_SERVICE_ERROR: 'Service unavailable. Try again later.',
    err_UNKNOWN: 'An unexpected error occurred.',
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
