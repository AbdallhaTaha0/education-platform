import type { ReactNode } from 'react';
import { useAuth } from '../../../auth';
import { useLang } from '../../../i18n';
import type { Route } from '../../../routes';

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

function AdminLinks(route: Route): WorkspaceLink[] {
  const r = route as string;
  return [
    { href: '#/admin/summary', ar: 'نظرة عامة', en: 'Overview', active: r === 'admin-summary' },
    { href: '#/admin/catalog', ar: 'الكورسات', en: 'Courses', active: r === 'admin-catalog' || r === 'admin-course' },
    { href: '#/admin/packages', ar: 'الباقات', en: 'Packages', active: r === 'admin-packages' },
    { href: '#/admin/recharge', ar: 'مراجعة الشحن', en: 'Recharge', active: r === 'admin-recharge' },
    { href: '#/admin/practice', ar: 'حدود التدريب', en: 'Practice limits', active: r === 'admin-practice' },
    { href: '#/admin/students', ar: 'الطلاب', en: 'Students', active: r === 'admin-students' },
    { href: '#/admin', ar: 'إضافة مسؤول', en: 'Create admin', active: r === 'admin' },
    { href: '#/admin/policies', ar: 'مسودات السياسات', en: 'Policy drafts', active: r === 'admin-policies' },
    { href: '#/admin/support', ar: 'بيانات الدعم', en: 'Support contacts', active: r === 'admin-support' },
    { href: '#/notifications', ar: 'الإشعارات', en: 'Notifications', active: r === 'notifications' },
    { href: '#/account', ar: 'حسابي', en: 'My account', active: r === 'account' },
    { href: '#/account/profile', ar: 'الملف والأمان', en: 'Profile & security', active: r === 'account-profile' },
  ];
}

/**
 * Shared role-aware account workspace shell.
 *
 * Sidebar on desktop, accessible compact inline section menu on mobile.
 * This shell provides NO <main> landmark itself; inner pages keep their
 * single <main> so landmarks are never nested and id="main" is never
 * duplicated. Anonymous/loading states render children directly without
 * fetching protected role data.
 */
export function AccountWorkspace({
  route,
  children,
}: {
  route: Route;
  children: ReactNode;
}): JSX.Element {
  const { status, user } = useAuth();
  const { lang } = useLang();
  const ar = lang === 'ar';

  if (status !== 'authenticated' || !user) {
    return <>{children}</>;
  }

  const links = user.role === 'ADMIN' ? AdminLinks(route) : StudentLinks(route);
  const current = links.find((l) => l.active);
  const menuLabel = ar ? 'أقسام الحساب' : 'Account sections';
  const currentLabel = current ? (ar ? current.ar : current.en) : menuLabel;
  const sidebarTitle = user.role === 'ADMIN'
    ? (ar ? 'إدارة المنصة وحسابي' : 'Platform management and my account')
    : (ar ? 'حسابي وتعلّمي' : 'My account and learning');

  return (
    <div className="account-workspace" data-testid="account-workspace">
      <aside className="workspace-sidebar" aria-label={sidebarTitle}>
        <div className="workspace-sidebar__card">
          <p className="workspace-sidebar__title">{sidebarTitle}</p>
          <nav aria-label={menuLabel}>
            <ul>
              {links.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    aria-current={link.active ? 'page' : undefined}
                  >
                    {ar ? link.ar : link.en}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </aside>
      <details key={route} className="workspace-mobile-menu" data-testid="workspace-section-menu">
        <summary>
          <span>
            {menuLabel}: {currentLabel}
          </span>
          <span aria-hidden="true">▾</span>
        </summary>
        <nav aria-label={menuLabel}>
          <ul>
            {links.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  aria-current={link.active ? 'page' : undefined}
                >
                  {ar ? link.ar : link.en}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </details>
      <div className="workspace-content">{children}</div>
    </div>
  );
}
