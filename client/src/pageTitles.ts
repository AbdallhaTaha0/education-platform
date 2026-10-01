/**
 * Per-screen document titles built from the centralized FAYQ identity.
 *
 * The product name always comes from `brand.ts`, so no screen hard-codes it.
 * A screen without an explicit label falls back to the brand headline.
 */
import { documentTitleFor, type BrandLang } from './brand';
import type { Route } from './routes';

type SectionLabels = Record<string, string>;

const KEYS: Record<Route, string | null> = {
  home: null,
  courses: 'navCourses',
  'course-detail': 'navCourses',
  register: 'registerTitle',
  login: 'loginTitle',
  account: 'navAccount',
  admin: 'navAdmin',
  'admin-catalog': 'navCatalog',
  'admin-course': 'navCatalog',
  'admin-recharge': 'navRecharge',
  wallet: 'navWallet',
  'wallet-recharge': 'navRecharge',
  purchases: 'purchaseHistory',
  purchase: 'purchaseTitle',
  package: 'purchaseTitle',
  'admin-packages': 'navCatalog',
  'admin-summary': 'navAdmin',
  dashboard: 'navDashboard',
  notifications: 'navNotifications',
  learn: 'learningTitle',
};

/** Resolve the document title for a route from localized labels. */
export function routeDocumentTitle(lang: BrandLang, route: Route, labels: SectionLabels): string {
  const key = KEYS[route];
  const section = key === null ? undefined : labels[key];
  return documentTitleFor(lang, typeof section === 'string' && section !== '' ? section : undefined);
}
