import { useAuth } from '../../auth';
import { useLang, type Lang } from '../../i18n';
import { useTheme } from '../../theme';
import { Container } from '../ui/Card';
import type { Route } from '../../routes';

export function Header({ onSwitch, route }: { onSwitch: (lang: Lang) => void; route: Route }): JSX.Element {
  const { lang, t } = useLang();
  const { theme, toggleTheme } = useTheme();
  const { status, user } = useAuth();
  return (
    <header className="sticky top-0 z-10 border-b border-border bg-surface">
      <Container>
        <div className="flex flex-wrap items-center gap-6 py-3 max-sm:gap-3">
          <a className="me-auto flex items-center gap-3 text-ink no-underline" href="#/" aria-label={t.brand}>
            <span className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-control bg-ink px-2 font-bold text-white" dir="ltr" aria-hidden="true">
              {'</>'}
            </span>
            <span className="flex flex-col leading-tight">
              <strong>{t.brand}</strong>
              <small className="text-sm text-muted">{t.brandSub}</small>
            </span>
          </a>
          <nav className="flex gap-4 max-sm:order-3 max-sm:w-full max-sm:flex-wrap max-sm:gap-y-1" aria-label={t.brand}>
            <a href="#/" aria-current={route === 'home' ? 'page' : undefined} className="p-2 font-semibold text-ink no-underline hover:text-primary">
              {t.navHome}
            </a>
            <a href="#/courses" aria-current={route === 'courses' || route === 'course-detail' ? 'page' : undefined} className="p-2 font-semibold text-ink no-underline hover:text-primary">
              {t.navCourses}
            </a>
            <a href="#/account" aria-current={route === 'account' ? 'page' : undefined} className="p-2 font-semibold text-ink no-underline hover:text-primary">
              {status === 'authenticated' && user !== null ? t.navAccount : t.navLogin}
            </a>
            {status === 'authenticated' && user?.role === 'STUDENT' ? (
              <a href="#/wallet" aria-current={route === 'wallet' || route === 'wallet-recharge' ? 'page' : undefined} className="p-2 font-semibold text-ink no-underline hover:text-primary">
                {t.navWallet}
              </a>
            ) : null}
            {status === 'authenticated' && user?.role === 'ADMIN' ? (
              <>
                <a href="#/admin" aria-current={route === 'admin' ? 'page' : undefined} className="p-2 font-semibold text-ink no-underline hover:text-primary">
                  {t.navAdmin}
                </a>
                <a href="#/admin/catalog" aria-current={route === 'admin-catalog' || route === 'admin-course' ? 'page' : undefined} className="p-2 font-semibold text-ink no-underline hover:text-primary">
                  {t.navCatalog}
                </a>
                <a href="#/admin/recharge" aria-current={route === 'admin-recharge' ? 'page' : undefined} className="p-2 font-semibold text-ink no-underline hover:text-primary">
                  {t.navRecharge}
                </a>
              </>
            ) : null}
          </nav>
          <button
            type="button"
            onClick={toggleTheme}
            aria-pressed={theme === 'dark'}
            aria-label={t.themeToggle}
            title={t.themeToggle}
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-control border border-border bg-surface px-3 text-lg"
          >
            <span aria-hidden="true">{theme === 'dark' ? '☾' : '☀'}</span>
          </button>
          <div className="lang-switch flex overflow-hidden rounded-control border border-border" role="group" aria-label={t.langLabel}>
            <button type="button" className={`min-h-[44px] px-4 text-sm font-semibold ${lang === 'ar' ? 'bg-primary text-white' : 'bg-surface text-muted'}`} aria-pressed={lang === 'ar'} onClick={() => onSwitch('ar')}>
              العربية
            </button>
            <button type="button" className={`min-h-[44px] px-4 text-sm font-semibold ${lang === 'en' ? 'bg-primary text-white' : 'bg-surface text-muted'}`} aria-pressed={lang === 'en'} onClick={() => onSwitch('en')}>
              English
            </button>
          </div>
        </div>
      </Container>
    </header>
  );
}
