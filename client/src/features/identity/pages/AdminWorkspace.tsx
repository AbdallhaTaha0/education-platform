import type { ReactNode } from 'react';
import { useLang } from '../../../i18n';
import type { Route } from '../../../routes';
import { useCodingIde } from '../../../features';
import { useConfirmNavigation } from '../../../components/ui/UnsavedChanges';

const groups = [
  { id: 'overview', ar: 'نظرة عامة', en: 'Overview', descriptionAr: 'أرقام المنصة والمهام التي تحتاج متابعة.', descriptionEn: 'Platform totals and tasks needing attention.', links: [{ href: '#/admin/summary', ar: 'ملخص المنصة', en: 'Platform summary', routes: ['admin-summary', 'account'] }] },
  { id: 'content', ar: 'الكورسات والباقات', en: 'Courses & packages', descriptionAr: 'عدّل بيانات الكورسات والدروس والتقييمات والأسعار، وأدر الباقات والنشر.', descriptionEn: 'Edit course details, lessons, assessments and prices; manage packages and publishing.', links: [{ href: '#/admin/catalog', ar: 'إدارة الكورسات', en: 'Manage courses', routes: ['admin-catalog','admin-course'] }, { href: '#/admin/packages', ar: 'إدارة الباقات', en: 'Manage packages', routes: ['admin-packages'] }] },
  { id: 'students', ar: 'الطلاب والتدريب', en: 'Students & practice', descriptionAr: 'راجع بيانات الطلاب والاشتراكات وحدود تشغيل IDE لكل طالب.', descriptionEn: 'Review student details, subscriptions and each student’s IDE allowance.', links: [{ href: '#/admin/students', ar: 'بيانات الطلاب', en: 'Student details', routes: ['admin-students'] }, { href: '#/admin/practice', ar: 'حدود تشغيل IDE', en: 'IDE Run limits', routes: ['admin-practice'] }] },
  { id: 'payments', ar: 'الشحن والتحويلات', en: 'Recharge & payments', descriptionAr: 'راجع إثباتات التحويل، واعتمد الشحن، وعدّل بيانات استقبال الدفع في تبويبات منفصلة.', descriptionEn: 'Review transfer receipts, approve recharge and edit receiving details in separate tabs.', links: [{ href: '#/admin/recharge', ar: 'طلبات الشحن وطرق الدفع', en: 'Recharge requests & payment methods', routes: ['admin-recharge'] }] },
  { id: 'settings', ar: 'إعدادات المنصة', en: 'Platform settings', descriptionAr: 'عدّل بيانات الدعم، وراجع مسودات السياسات، وأضف حسابات الإدارة.', descriptionEn: 'Edit support contacts, review policy drafts and create administrator accounts.', links: [{ href: '#/admin/support', ar: 'تعديل بيانات الدعم', en: 'Edit support contacts', routes: ['admin-support'] }, { href: '#/admin/policies', ar: 'مسودات السياسات', en: 'Policy drafts', routes: ['admin-policies'] }, { href: '#/admin', ar: 'إضافة مسؤول', en: 'Create administrator', routes: ['admin'] }] },
  { id: 'personal', ar: 'حسابي والإشعارات', en: 'My account & inbox', descriptionAr: 'عدّل ملفك وكلمة المرور وتابع إشعارات حساب الإدارة.', descriptionEn: 'Edit your profile and password, and review your administrator notifications.', links: [{ href: '#/account/profile', ar: 'الملف وكلمة المرور', en: 'Profile & password', routes: ['account-profile'] }, { href: '#/notifications', ar: 'صندوق الإشعارات', en: 'Notification inbox', routes: ['notifications'] }] },
];

export function AdminWorkspace({ route, children }: { route: Route; children: ReactNode }): JSX.Element {
  const { lang } = useLang(); const ar = lang === 'ar';
  const codingEnabled = useCodingIde();
  const confirmLeave = useConfirmNavigation();
  const visibleGroups = groups.map(group => ({ ...group, ...(group.id === 'students' && !codingEnabled ? { ar: 'الطلاب', en: 'Students', descriptionAr: 'راجع بيانات الطلاب والاشتراكات.', descriptionEn: 'Review student details and subscriptions.' } : {}), links: group.links.filter(link => codingEnabled || link.href !== '#/admin/practice') }));
  const current = visibleGroups.find(group => group.links.some(link => link.routes.includes(route))) ?? visibleGroups[0];
  return <div className="mx-auto w-full max-w-[1440px] px-4 pb-6 sm:px-6" data-testid="admin-workspace">
    <header className="mt-6 rounded-card border border-border bg-surface p-4 sm:p-6">
      <p className="text-xl font-bold">{ar ? 'لوحة الإدارة' : 'Admin dashboard'}</p>
      <label htmlFor="admin-mobile-destination" className="mt-3 block text-sm font-semibold sm:hidden">
        {ar ? 'الانتقال إلى' : 'Go to'}
        <select id="admin-mobile-destination" value={(current.links.find(link => link.routes.includes(route)) ?? current.links[0]).href}
          className="mt-2 min-h-[48px] w-full rounded-control border border-border-strong bg-field px-3 text-base text-ink"
          onChange={event => { if (confirmLeave()) window.location.hash = event.target.value; }}>
          {visibleGroups.map(group => <optgroup key={group.id} label={ar ? group.ar : group.en}>
            {group.links.map(link => <option key={link.href} value={link.href}>{ar ? link.ar : link.en}</option>)}
          </optgroup>)}
        </select>
      </label>
      <nav aria-label={ar ? 'تبويبات لوحة الإدارة' : 'Admin dashboard tabs'} className="mt-4 hidden grid-cols-2 gap-2 sm:grid sm:grid-cols-3 xl:grid-cols-6" data-testid="admin-dashboard-tabs">
        {visibleGroups.map(group => <a key={group.id} href={group.links[0].href} aria-current={group.id === current.id ? 'page' : undefined}
          className={`flex min-h-[48px] items-center justify-center rounded-control border px-3 py-3 text-center text-sm font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus ${group.id === current.id ? 'border-primary bg-primary text-canvas' : 'border-border text-ink hover:bg-elevated'}`}>{ar ? group.ar : group.en}</a>)}
      </nav>
      <p className="mt-4 hidden text-sm leading-7 text-muted sm:block">{ar ? current.descriptionAr : current.descriptionEn}</p>
      <nav aria-label={ar ? 'الأقسام القابلة للإدارة' : 'Management sections'} className="mt-3 hidden flex-wrap gap-2 sm:flex" data-testid="admin-section-links">
        {current.links.map(link => <a key={link.href} href={link.href} aria-current={link.routes.includes(route) ? 'page' : undefined}
          className="min-h-[44px] rounded-control border border-border px-4 py-3 text-sm font-semibold text-ink aria-[current=page]:bg-elevated focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus">{ar ? link.ar : link.en}</a>)}
      </nav>
    </header>
    <div className="min-w-0">{children}</div>
  </div>;
}
