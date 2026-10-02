export type Route =
  | 'home'
  | 'register'
  | 'login'
  | 'account'
  | 'account-profile'
  | 'admin'
  | 'courses'
  | 'course-detail'
  | 'admin-catalog'
  | 'admin-course'
  | 'wallet'
  | 'wallet-recharge'
  | 'purchases'
  | 'purchase'
  | 'package'
  | 'admin-packages'
  | 'admin-summary'
  | 'admin-recharge'
  | 'dashboard'
  | 'notifications'
  | 'learn'
  | 'practice'
  | 'assessment'
  | 'admin-practice' | 'admin-students' | 'admin-policies' | 'admin-support' | 'support' | 'terms' | 'privacy' | 'refunds' | 'not-found';

export function routeFromHash(): Route {
  const hash = window.location.hash;
  if (hash === '#/admin/support') return 'admin-support';
  if (hash === '#/admin/students') return 'admin-students';
  if (hash === '#/admin/policies') return 'admin-policies';
  if (hash === '#/support') return 'support';
  if (hash === '#/terms') return 'terms';
  if (hash === '#/privacy') return 'privacy';
  if (hash === '#/refunds') return 'refunds';
  if (hash === '#/practice') return 'practice';
  if (hash === '#/admin/practice') return 'admin-practice';
  if (hash.startsWith('#/assessment/')) return 'assessment';
  if (hash === '#/register') return 'register';
  if (hash === '#/login') return 'login';
  if (hash === '#/account/profile') return 'account-profile';
  if (hash === '#/account') return 'account';
  if (hash === '#/admin') return 'admin';
  if (hash.startsWith('#/package/')) return 'package';
  if (hash === '#/admin/packages') return 'admin-packages';
  if (hash === '#/admin/summary') return 'admin-summary';
  if (hash.startsWith('#/purchase/')) return 'purchase';
  if (hash === '#/purchases') return 'purchases';
  if (hash === '#/wallet/recharge') return 'wallet-recharge';
  if (hash === '#/wallet') return 'wallet';
  if (hash === '#/dashboard') return 'dashboard';
  if (hash === '#/notifications') return 'notifications';
  if (hash.startsWith('#/learn/')) return 'learn';
  if (hash === '#/admin/recharge') return 'admin-recharge';
  if (hash.startsWith('#/courses/')) return 'course-detail';
  if (hash === '#/courses') return 'courses';
  if (hash.startsWith('#/admin/courses/')) return 'admin-course';
  if (hash === '#/admin/catalog') return 'admin-catalog';
  return !hash || hash==='#/' || hash==='#' ? 'home' : 'not-found';
}

export function planIdFromHash(): string {
  const hash = window.location.hash;
  if (hash.startsWith('#/purchase/')) return decodeURIComponent(hash.slice('#/purchase/'.length));
  return '';
}

export function packageIdFromHash(): string {
  return window.location.hash.startsWith('#/package/')
    ? decodeURIComponent(window.location.hash.slice('#/package/'.length))
    : '';
}

export function slugFromHash(): string {
  const hash = window.location.hash;
  if (hash.startsWith('#/courses/')) return decodeURIComponent(hash.slice('#/courses/'.length));
  return '';
}

export function adminCourseIdFromHash(): string {
  const hash = window.location.hash;
  if (hash.startsWith('#/admin/courses/'))
    return decodeURIComponent(hash.slice('#/admin/courses/'.length));
  return '';
}

/** Course slug for the protected learning route (#/learn/:slug). */
export function learnSlugFromHash(): string {
  const hash = window.location.hash;
  if (hash.startsWith('#/learn/')) return decodeURIComponent(hash.slice('#/learn/'.length));
  return '';
}
