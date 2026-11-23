import type { ReactNode } from 'react';
import { useAuth } from '../../../auth';
import { useLang } from '../../../i18n';
import type { Route } from '../../../routes';
import { AdminWorkspace } from './AdminWorkspace';
import { useCodingIde } from '../../../features';
import { Container } from '../../../components/ui/Card';
import { Loading, Notice } from '../../../components/ui/Notice';

interface WorkspaceLink {
  href: string;
  ar: string;
  en: string;
  active: boolean;
}

function StudentLinks(route: Route): WorkspaceLink[] {
  const r = route as string;
  return [
    { href: '#/account', ar: 'حسابي', en: 'My account', active: r === 'account' },
    { href: '#/dashboard', ar: 'تعلّمي', en: 'My learning', active: r === 'dashboard' || r === 'learn' },
    { href: '#/practice', ar: 'IDE', en: 'IDE', active: r === 'practice' || r === 'assessment' },
    { href: '#/wallet', ar: 'المحفظة', en: 'Wallet', active: r === 'wallet' || r === 'wallet-recharge' },
    { href: '#/purchases', ar: 'مشترياتي', en: 'My purchases', active: r === 'purchases' },
    { href: '#/notifications', ar: 'الإشعارات', en: 'Notifications', active: r === 'notifications' },
    { href: '#/account/profile', ar: 'الملف والأمان', en: 'Profile & security', active: r === 'account-profile' },
  ];
}

/**
 * Shared role-aware account workspace shell.
 *
 * Sticky sidebar on Desktop (>=1024px), always-visible 1-tap horizontal
 * scrollable pill strip on Tablet & Mobile (<1024px) so 15-18 students never
 * hit a hidden dropdown trap. This shell provides NO <main> landmark itself;
 * inner pages keep their single <main>.
 */
export function AccountWorkspace({
  route,
  children,
}: {
  route: Route;
  children: ReactNode;
}): JSX.Element {
  const { status, user } = useAuth();
  const { lang, t } = useLang();
  const codingEnabled = useCodingIde();
  const ar = lang === 'ar';

  if (route.startsWith('admin') && status !== 'authenticated') {
    return (
      <main id="main">
        <section className="py-8">
          <Container>
            {status === 'loading' ? (
              <Loading text={t.loading} />
            ) : (
              <>
                <Notice kind="info">{t.needLogin}</Notice>
                <a
                  href="#/login"
                  className="mt-4 inline-flex min-h-[48px] items-center rounded-control bg-primary px-5 py-3 font-bold text-primary-ink no-underline hover:bg-primary-hover"
                >
                  {ar ? 'تسجيل الدخول' : 'Log in'}
                </a>
              </>
            )}
          </Container>
        </section>
      </main>
    );
  }

  if (status !== 'authenticated' || !user) {
    return <>{children}</>;
  }

  if (user.role === 'ADMIN') return <AdminWorkspace route={route}>{children}</AdminWorkspace>;

  const links = StudentLinks(route).filter((l) => codingEnabled || l.href !== '#/practice');
  const menuLabel = ar ? 'أقسام الحساب' : 'Account sections';
  const sidebarTitle = ar ? 'حسابي وتعلّمي' : 'My account and learning';

  return (
    <div className="account-workspace" data-testid="account-workspace">
      <aside className="workspace-sidebar" aria-label={sidebarTitle}>
        <div className="workspace-sidebar__card">
          <p className="workspace-sidebar__title">{sidebarTitle}</p>
          <nav aria-label={menuLabel}>
            <ul>
              {links.map((link) => (
                <li key={link.href}>
                  <a href={link.href} aria-current={link.active ? 'page' : undefined}>
                    {ar ? link.ar : link.en}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </aside>
      <nav
        className="workspace-mobile-menu"
        aria-label={menuLabel}
        data-testid="workspace-section-menu"
      >
        <ul className="workspace-mobile-menu__strip">
          {links.map((link) => (
            <li key={link.href} className="shrink-0">
              <a href={link.href} aria-current={link.active ? 'page' : undefined}>
                {ar ? link.ar : link.en}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <div className="workspace-content">{children}</div>
    </div>
  );
}
