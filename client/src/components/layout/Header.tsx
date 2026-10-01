import { useAuth } from '../../auth';
import { useLang, type Lang } from '../../i18n';
import { useTheme } from '../../theme';
import { Container } from '../ui/Card';
import type { Route } from '../../routes';
import { Wordmark } from '../ui/Wordmark';
import { NotificationEntry } from '../../features/notifications/components/NotificationEntry';

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
  const { status, user } = useAuth();
  const signedIn = status === 'authenticated';
  const admin = signedIn && user?.role === 'ADMIN';
  const label = (ar: string, en: string): string => (lang === 'ar' ? ar : en);
  const entries: { href: string; label: string; icon: Icon; active: boolean }[] = admin
    ? [
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
          active: route === 'account',
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
          active: route === 'dashboard' || route === 'learn',
        },
        {
          href: '#/account',
          label: label('حسابي', 'Profile'),
          icon: 'account',
          active: [
            'account',
            'login',
            'register',
            'wallet',
            'wallet-recharge',
            'purchases',
          ].includes(route),
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
              {entries.map((entry) => (
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
        </Container>
      </header>
      <nav
        className="mobile-dock"
        aria-label={label('التنقل الرئيسي', 'Main navigation')}
        data-testid="mobile-dock"
      >
        {entries.map((entry) => (
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
