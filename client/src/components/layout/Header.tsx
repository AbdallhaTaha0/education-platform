import { useAuth } from '../../auth';
import { useLang, type Lang } from '../../i18n';
import { useTheme } from '../../theme';
import { Container } from '../ui/Card';
import type { Route } from '../../routes';
import { Wordmark } from '../ui/Wordmark';
import { NotificationEntry } from '../../features/notifications/components/NotificationEntry';

function NavLink({ href, current, children }: { href: string; current: boolean; children: string }): JSX.Element {
  return (
    <a
      href={href}
      aria-current={current ? 'page' : undefined}
      className="relative inline-flex min-h-[44px] shrink-0 items-center rounded-control px-3 py-2 text-sm font-bold text-muted no-underline transition-colors hover:bg-interactive hover:text-ink aria-[current=page]:bg-interactive aria-[current=page]:text-primary-strong"
    >
      {children}
      {current ? <span className="absolute inset-x-3 bottom-1 h-0.5 rounded-full bg-primary" aria-hidden="true" /> : null}
    </a>
  );
}

export function Header({ onSwitch, route }: { onSwitch: (lang: Lang) => void; route: Route }): JSX.Element {
  const { lang, t } = useLang();
  const { theme, toggleTheme } = useTheme();
  const { status, user } = useAuth();
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface/95 shadow-rest backdrop-blur">
      <Container>
        <div className="flex flex-wrap items-center gap-3 py-3 lg:flex-nowrap">
          <a className="me-auto flex min-h-[48px] items-center text-ink no-underline" href="#/" aria-label={`${t.brand} — ${t.slogan}`}>
            <Wordmark variant="compact" markSize={42} />
          </a>
          <nav className="order-3 flex w-full gap-1 overflow-x-auto pb-1 lg:order-none lg:w-auto lg:overflow-visible lg:pb-0" aria-label={t.brand}>
            <NavLink href="#/" current={route === 'home'}>{t.navHome}</NavLink>
            <NavLink href="#/courses" current={route === 'courses' || route === 'course-detail'}>{t.navCourses}</NavLink>
            <NavLink href="#/account" current={route === 'account'}>{status === 'authenticated' && user !== null ? t.navAccount : t.navLogin}</NavLink>
            {status === 'authenticated' && user?.role === 'STUDENT' ? (
              <>
                <NavLink href="#/dashboard" current={route === 'dashboard' || route === 'learn'}>{t.navDashboard}</NavLink>
                <NavLink href="#/wallet" current={route === 'wallet' || route === 'wallet-recharge'}>{t.navWallet}</NavLink>
              </>
            ) : null}
            {status === 'authenticated' && user?.role === 'ADMIN' ? (
              <>
                <NavLink href="#/admin" current={route === 'admin'}>{t.navAdmin}</NavLink>
                <NavLink href="#/admin/catalog" current={route === 'admin-catalog' || route === 'admin-course'}>{t.navCatalog}</NavLink>
                <NavLink href="#/admin/recharge" current={route === 'admin-recharge'}>{t.navRecharge}</NavLink>
              </>
            ) : null}
            {status === 'authenticated' ? <NotificationEntry current={route === 'notifications'} /> : null}
          </nav>
          <button
            type="button"
            onClick={toggleTheme}
            aria-pressed={theme === 'dark'}
            aria-label={t.themeToggle}
            title={t.themeToggle}
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-control border border-border-strong bg-elevated px-3 text-lg text-ink transition-colors hover:border-primary"
          >
            <span aria-hidden="true">{theme === 'dark' ? '☾' : '☀'}</span>
          </button>
          <div className="lang-switch flex overflow-hidden rounded-control border border-border-strong bg-elevated" role="group" aria-label={t.langLabel}>
            <button type="button" className={`min-h-[44px] px-3 text-sm font-bold ${lang === 'ar' ? 'bg-primary text-primary-ink' : 'text-muted hover:text-ink'}`} aria-pressed={lang === 'ar'} onClick={() => onSwitch('ar')}>
              العربية
            </button>
            <button type="button" className={`min-h-[44px] px-3 text-sm font-bold ${lang === 'en' ? 'bg-primary text-primary-ink' : 'text-muted hover:text-ink'}`} aria-pressed={lang === 'en'} onClick={() => onSwitch('en')}>
              English
            </button>
          </div>
        </div>
      </Container>
    </header>
  );
}
