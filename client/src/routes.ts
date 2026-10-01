export type Route =
  | 'home'
  | 'register'
  | 'login'
  | 'account'
  | 'admin'
  | 'courses'
  | 'course-detail'
  | 'admin-catalog'
  | 'admin-course'
  | 'wallet'
  | 'wallet-recharge'
  | 'purchases'
  | 'purchase'
  | 'admin-recharge'
  | 'dashboard'
  | 'notifications'
  | 'learn';

export function routeFromHash(): Route {
  const hash = window.location.hash;
  if (hash === '#/register') return 'register';
  if (hash === '#/login') return 'login';
  if (hash === '#/account') return 'account';
  if (hash === '#/admin') return 'admin';
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
  return 'home';
}

export function planIdFromHash(): string {
  const hash = window.location.hash;
  if (hash.startsWith('#/purchase/')) return decodeURIComponent(hash.slice('#/purchase/'.length));
  return '';
}

export function slugFromHash(): string {
  const hash = window.location.hash;
  if (hash.startsWith('#/courses/')) return decodeURIComponent(hash.slice('#/courses/'.length));
  return '';
}

export function adminCourseIdFromHash(): string {
  const hash = window.location.hash;
  if (hash.startsWith('#/admin/courses/')) return decodeURIComponent(hash.slice('#/admin/courses/'.length));
  return '';
}

/** Course slug for the protected learning route (#/learn/:slug). */
export function learnSlugFromHash(): string {
  const hash = window.location.hash;
  if (hash.startsWith('#/learn/')) return decodeURIComponent(hash.slice('#/learn/'.length));
  return '';
}
