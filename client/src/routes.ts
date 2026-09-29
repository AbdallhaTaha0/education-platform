export type Route =
  | 'home'
  | 'register'
  | 'login'
  | 'account'
  | 'admin'
  | 'courses'
  | 'course-detail'
  | 'admin-catalog'
  | 'admin-course';

export function routeFromHash(): Route {
  const hash = window.location.hash;
  if (hash === '#/register') return 'register';
  if (hash === '#/login') return 'login';
  if (hash === '#/account') return 'account';
  if (hash === '#/admin') return 'admin';
  if (hash.startsWith('#/courses/')) return 'course-detail';
  if (hash === '#/courses') return 'courses';
  if (hash.startsWith('#/admin/courses/')) return 'admin-course';
  if (hash === '#/admin/catalog') return 'admin-catalog';
  return 'home';
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
