import { useState } from 'react';
import { useAuth } from '../../auth';
import { useLang, type Lang } from '../../i18n';
import { useTheme } from '../../theme';
import { Container } from '../ui/Card';
import type { Route } from '../../routes';
import { Wordmark } from '../ui/Wordmark';
import { NotificationEntry } from '../../features/notifications/components/NotificationEntry';
import { Button } from '../ui/Button';
import { Notice } from '../ui/Notice';
import { useConfirmNavigation } from '../ui/UnsavedChanges';

type Icon = 'home' | 'discover' | 'learning' | 'account' | 'courses' | 'recharge';
function NavIcon({ kind }: { kind: Icon }): JSX.Element {
  const paths: Record<Icon, string> = {
    home: 'm3 10 9-7 9 7M5 9v11h5v-6h4v6h5V9',
    discover: 'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z',
    learning: 'M3 4h7l2 2 2-2h7v15h-7l-2 2-2-2H3V4Zm9 2v15',
    account: 'M20 21a8 8 0 0 0-16 0M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
    courses: 'M4 3h16v18H4V3Zm4 5h8M8 12h8M8 16h5',
    recharge: 'M3 6h18v14H3V6Zm0 4h18M7 15h3',
  };
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[kind]} />
    </svg>
  );
}
export function Header({
  onSwitch,
  route,
}: {
  onSwitch: (lang: Lang) => void;
  route: Route;
}): JSX.Element {
  const { lang, t } = useLang();
  const { theme, toggleTheme } = useTheme();
  const { status, user, logout } = useAuth();
  const confirmLeave = useConfirmNavigation();
  const [signingOut, setSigningOut] = useState(false);
  const [logoutError, setLogoutError] = useState(false);
  async function signOut(): Promise<void> {
    if (signingOut || !confirmLeave()) return;
    setSigningOut(true);
    setLogoutError(false);
    try { setLogoutError((await logout()) !== null); }
    finally { setSigningOut(false); }
  }
  const signedIn = status === 'authenticated';
  const admin = signedIn && user?.role === 'ADMIN';
  const label = (ar: string, en: string): string => (lang === 'ar' ? ar : en);
  // Desktop keeps the full top navbar (including practice + wallet shortcuts).
  // Mobile uses exactly four dock destinations per the owner reference; practice
  // lives in the account workspace while preserving its entitlement behavior.
  const desktopEntries: { href: string; label: string; icon: Icon; active: boolean }[] = admin
    ? [
        { href: '#/admin/practice', label: label('التدريب', 'Practice'), icon: 'learning', active: route === 'admin-practice' },
        {
          href: '#/admin/summary',
          label: label('الإدارة', 'Overview'),
          icon: 'home',
          active: route === 'admin' || route === 'admin-summary',
        },
        {
          href: '#/admin/catalog',
          label: t.navCourses,
          icon: 'courses',
          active:
            route === 'admin-catalog' || route === 'admin-course' || route === 'admin-packages',
        },
        {
          href: '#/admin/recharge',
          label: t.navRecharge,
          icon: 'recharge',
          active: route === 'admin-recharge',
        },
        {
          href: '#/account',
          label: label('حسابي', 'Account'),
          icon: 'account',
          active: route === 'account' || (route as string) === 'account-profile',
        },
      ]
    : [
        ...(signedIn ? [{ href: '#/practice', label: label('مختبر البرمجة', 'Practice IDE'), icon: 'learning' as const, active: route === 'practice' }] : []),
        { href: '#/', label: t.navHome, icon: 'home', active: route === 'home' },
        {
          href: '#/courses',
          label: label('اكتشف', 'Discover'),
          icon: 'discover',
          active: ['courses', 'course-detail', 'purchase', 'package'].includes(route),
        },
        {
          href: signedIn ? '#/dashboard' : '#/login',
          label: label('تعلّمي', 'My learning'),
          icon: 'learning',
          active: route === 'dashboard' || route === 'learn' || route === 'assessment',
        },
        {
          href: '#/account',
          label: label('حسابي', 'Profile'),
          icon: 'account',
          active: [
            'account',
            'account-profile',
            'login',
            'register',
            'wallet',
            'wallet-recharge',
            'purchases',
            'notifications',
          ].includes(route as string),
        },
      ];
  // Mobile dock: exactly four evenly spaced destinations, icon above label.
  // Anonymous protected destinations lead through the existing login flow.
  const mobileEntries: { href: string; label: string; icon: Icon; active: boolean }[] = admin
    ? [
        {
          href: '#/admin/summary',
          label: label('نظرة عامة', 'Overview'),
          icon: 'home',
          active: route === 'admin-summary',
        },
        {
          href: '#/admin/catalog',
          label: label('الكورسات', 'Courses'),
          icon: 'courses',
          active:
            route === 'admin-catalog' || route === 'admin-course' || route === 'admin-packages',
        },
        {
          href: '#/admin/recharge',
          label: label('الشحن', 'Recharge'),
          icon: 'recharge',
          active: route === 'admin-recharge',
        },
        {
          href: '#/account',
          label: t.navAccount,
          icon: 'account',
          active: ((): boolean => {
            const r = route as string;
            return [
              'account',
              'account-profile',
              'admin-practice',
              'admin-students',
              'admin',
              'admin-policies',
              'admin-support',
              'notifications',
              'register',
            ].includes(r);
          })(),
        },
      ]
    : [
        { href: '#/', label: t.navHome, icon: 'home', active: route === 'home' },
        {
          href: '#/courses',
          label: label('اكتشف', 'Discover'),
          icon: 'discover',
          active: ['courses', 'course-detail', 'purchase', 'package'].includes(route),
        },
        {
          href: signedIn ? '#/dashboard' : '#/login',
          label: label('تعلّمي', 'My learning'),
          icon: 'learning',
          active: signedIn && ['dashboard', 'learn', 'practice', 'assessment'].includes(route),
        },
        {
          href: '#/account',
          label: t.navAccount,
          icon: 'account',
          active: [
            'account',
            'account-profile',
            'login',
            'register',
            'wallet',
            'wallet-recharge',
            'purchases',
            'notifications',
          ].includes(route as string),
        },
      ];
  return (
    <>
      <header className="site-header">
        <Container>
          <div className="site-header__inner">
            <a className="site-brand" href="#/" aria-label={`${t.brand} — ${t.slogan}`}>
              <Wordmark variant="compact" markSize={36} />
            </a>
            <nav
              className="desktop-navigation"
              aria-label={label('التنقل الرئيسي', 'Main navigation')}
            >
              {desktopEntries.map((entry) => (
                <a
                  key={entry.href}
                  href={entry.href}
                  aria-current={entry.active ? 'page' : undefined}
                >
                  {entry.label}
                </a>
              ))}
              {signedIn && !admin ? (
                <a
                  href="#/wallet"
                  aria-current={
                    route === 'wallet' || route === 'wallet-recharge' ? 'page' : undefined
                  }
                >
                  {t.navWallet}
                </a>
              ) : null}
            </nav>
            <div className="site-header__tools">
              {signedIn ? <NotificationEntry current={route === 'notifications'} compact /> : null}
              <div className="header-auth-actions">
                {status === 'anonymous' ? <a href="#/login" data-testid="header-login" aria-label={t.navLogin}
                  className="inline-flex min-h-[44px] items-center justify-center rounded-control bg-primary px-4 py-2 font-bold text-primary-ink whitespace-nowrap">
                  <span className="hidden lg:inline">{t.navLogin}</span><span className="lg:hidden">{label('دخول', 'Login')}</span>
                </a> : signedIn ? <Button variant="secondary" className="whitespace-nowrap px-4" aria-label={t.logout}
                  data-testid="header-logout" disabled={signingOut} onClick={() => void signOut()}>
                  <span className="hidden lg:inline">{signingOut ? t.loading : t.logout}</span><span className="lg:hidden">{label('خروج', 'Logout')}</span>
                </Button> : null}
              </div>
              <button
                type="button"
                className="header-tool"
                onClick={toggleTheme}
                aria-pressed={theme === 'dark'}
                aria-label={t.themeToggle}
                title={t.themeToggle}
              >
                <span aria-hidden="true">{theme === 'dark' ? '☾' : '☀'}</span>
              </button>
              <button
                type="button"
                className="header-tool language-tool"
                onClick={() => onSwitch(lang === 'ar' ? 'en' : 'ar')}
                aria-label={lang === 'ar' ? 'Switch to English' : 'التبديل إلى العربية'}
                lang={lang === 'ar' ? 'en' : 'ar'}
              >
                {lang === 'ar' ? 'EN' : 'ع'}
              </button>
            </div>
          </div>
          {logoutError ? <Notice kind="error">{label('تعذّر تسجيل الخروج. حاول مرة أخرى.', 'Could not log out. Please retry.')}</Notice> : null}
        </Container>
      </header>
      <nav
        className="mobile-dock"
        style={{ gridTemplateColumns: `repeat(${mobileEntries.length}, minmax(0, 1fr))` }}
        aria-label={label('التنقل الرئيسي', 'Main navigation')}
        data-testid="mobile-dock"
      >
        {mobileEntries.map((entry) => (
          <a key={entry.href} href={entry.href} aria-current={entry.active ? 'page' : undefined}>
            <span className="mobile-dock__icon">
              <NavIcon kind={entry.icon} />
            </span>
            <span>{entry.label}</span>
          </a>
        ))}
      </nav>
    </>
  );
}
