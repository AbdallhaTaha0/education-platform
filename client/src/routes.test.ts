import { afterEach, describe, expect, it, vi } from 'vitest';
import { adminCourseIdFromHash, learnLessonFromHash, learnResumeFromHash, learnSlugFromHash, routeFromHash, type Route } from './routes';

afterEach(() => vi.unstubAllGlobals());

function location(hash: string, pathname = '/ar/courses'): void {
  vi.stubGlobal('window', { location: { hash, pathname } });
}

describe('student and admin journey route mapping', () => {
  const destinations: Array<[string, Route]> = [
    ['#/register', 'register'], ['#/login', 'login'], ['#/account', 'account'],
    ['#/account/profile', 'account-profile'], ['#/dashboard', 'dashboard'],
    ['#/wallet', 'wallet'], ['#/wallet/recharge', 'wallet-recharge'],
    ['#/purchases', 'purchases'], ['#/purchase/plan', 'purchase'],
    ['#/notifications', 'notifications'], ['#/courses', 'courses'],
    ['#/courses/aim', 'course-detail'], ['#/package/pkg', 'package'],
    ['#/learn/aim?lesson=second&resume=1', 'learn'], ['#/assessment/quiz', 'assessment'],
    ['#/admin', 'admin'], ['#/admin/summary', 'admin-summary'],
    ['#/admin/catalog', 'admin-catalog'], ['#/admin/courses/course', 'admin-course'],
    ['#/admin/packages', 'admin-packages'], ['#/admin/recharge', 'admin-recharge'],
    ['#/admin/students', 'admin-students'], ['#/admin/support', 'admin-support'],
    ['#/admin/policies', 'admin-policies'], ['#/support', 'support'],
    ['#/terms', 'terms'], ['#/privacy', 'privacy'], ['#/refunds', 'refunds'],
  ];
  it.each(destinations)('maps %s to %s', (hash, expected) => {
    location(hash);
    expect(routeFromHash()).toBe(expected);
  });
  it.each(['ar', 'en'])('maps public %s paths without a fragment', (lang) => {
    location('', `/${lang}/courses/aim`);
    expect(routeFromHash()).toBe('course-detail');
  });
  it('keeps protected fragments authoritative over the public pathname', () => {
    location('#/wallet', '/en/courses/aim');
    expect(routeFromHash()).toBe('wallet');
  });
  it('decodes selected learning course, lesson and resume intent independently', () => {
    location('#/learn/course%20name?lesson=lesson+2&resume=1');
    expect(learnSlugFromHash()).toBe('course name');
    expect(learnLessonFromHash()).toBe('lesson 2');
    expect(learnResumeFromHash()).toBe(true);
  });
  it('does not infer resume intent from an absent or false flag', () => {
    location('#/learn/aim?lesson=second&resume=0');
    expect(learnResumeFromHash()).toBe(false);
    location('#/learn/aim');
    expect(learnLessonFromHash()).toBeNull();
    expect(learnResumeFromHash()).toBe(false);
  });
  it('extracts the correct admin course identity', () => {
    location('#/admin/courses/course%20id');
    expect(adminCourseIdFromHash()).toBe('course id');
  });
  it('maps unknown destinations to the not-found screen', () => {
    location('#/does-not-exist');
    expect(routeFromHash()).toBe('not-found');
  });
});
