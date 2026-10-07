import { Footer } from './components/layout/Footer';
import { FeaturesProvider, useCodingIde } from './features';
import { usePublicData } from './seo/publicData';
import { updateDocumentMetadata } from './seo/metadata';
import { publicHref } from './seo/paths';
import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './auth';
import { Container } from './components/ui/Card';
import { ErrorFeedbackProvider } from './components/ui/ErrorFeedback';
import { UnsavedChangesProvider, useConfirmNavigation } from './components/ui/UnsavedChanges';
import { useLang } from './i18n';
import { ThemeProvider } from './theme';
import { Header } from './components/layout/Header';
import {
  adminCourseIdFromHash,
  learnSlugFromHash,
  learnLessonFromHash,
  learnResumeFromHash,
  planIdFromHash,
  packageIdFromHash,
  routeFromHash,
  slugFromHash,
  type Route,
} from './routes';
import { PackagePage } from './features/academic/PackagePage';
const AdminPackagesPage = lazy(() => import('./features/academic/AdminPackagesPage').then(module => ({ default: module.AdminPackagesPage })));
const AdminSummaryPage = lazy(() => import('./features/academic/AdminSummaryPage').then(module => ({ default: module.AdminSummaryPage })));
import { AdminScreen, LoginScreen, RegisterScreen } from './screens';
import { AccountWorkspace } from './features/identity/pages/AccountWorkspace';
import { AccountOverview } from './features/identity/pages/AccountOverview';
import { AccountProfile } from './features/identity/pages/AccountProfile';
import { PublicCatalogPage } from './features/catalog/pages/PublicCatalogPage';
import { OfferPage } from './features/catalog/pages/OfferPage';
const AdminListPage = lazy(() => import('./features/catalog/pages/AdminListPage').then(module => ({ default: module.AdminListPage })));
const AdminDetailPage = lazy(() => import('./features/catalog/pages/AdminDetailPage').then(module => ({ default: module.AdminDetailPage })));
import { HomePage } from './features/home/pages/HomePage';
const WalletPage = lazy(() => import('./features/wallet/pages/WalletPage').then(module => ({ default: module.WalletPage })));
const RechargePage = lazy(() => import('./features/wallet/pages/RechargePage').then(module => ({ default: module.RechargePage })));
const AdminRechargePage = lazy(() => import('./features/wallet/pages/AdminRechargePage').then(module => ({ default: module.AdminRechargePage })));
const PurchasePage = lazy(() => import('./features/purchase/pages/PurchasePage').then(module => ({ default: module.PurchasePage })));
const PurchaseHistoryPage = lazy(() => import('./features/purchase/pages/PurchaseHistoryPage').then(module => ({ default: module.PurchaseHistoryPage })));
const DashboardPage = lazy(() => import('./features/learning/pages/DashboardPage').then(module => ({ default: module.DashboardPage })));
import { Loading } from './components/ui/Notice';
const CourseLearningPage = lazy(() =>
  import('./features/learning/pages/CourseLearningPage').then((module) => ({
    default: module.CourseLearningPage,
  })),
);
import { NotificationsProvider } from './features/notifications/context';
const NotificationsPage = lazy(() => import('./features/notifications/pages/NotificationsPage').then(module => ({ default: module.NotificationsPage })));
const StudentDirectoryPage = lazy(() => import('./features/identity/pages/StudentDirectoryPage').then(module => ({ default: module.StudentDirectoryPage })));
import { SupportPage, PolicyPage, NotFoundPage } from './features/identity/pages/HelpPages';
const SupportSettings = lazy(() => import('./features/identity/pages/SupportSettings').then(module => ({ default: module.SupportSettings })));
const PracticePage = lazy(() => import('./features/ide/PracticePage').then((m) => ({ default: m.PracticePage })));
const AssessmentPage = lazy(() => import('./features/assessments/AssessmentPage').then((m) => ({ default: m.AssessmentPage })));
const AdminQuotaPage = lazy(() => import('./features/assessments/AdminQuotaPage').then((m) => ({ default: m.AdminQuotaPage })));

function Shell(): JSX.Element {
  const codingEnabled = useCodingIde();
  const confirmNavigation = useConfirmNavigation();
  const { lang, t, setLang } = useLang();
  const { user } = useAuth();
  const publicData = usePublicData();
  const [route, setRoute] = useState<Route>(() => typeof window === "undefined" ? publicData?.page ?? "home" : routeFromHash());
  const [hash, setHash] = useState(() => typeof window === "undefined" ? "" : window.location.hash);

  useEffect(() => {
    const onHash = (): void => {
      if (window.location.hash !== hash && !confirmNavigation()) {
        window.history.replaceState(window.history.state, '', hash || window.location.pathname);
        return;
      }
      setHash(window.location.hash);
      setRoute(routeFromHash());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, [hash, confirmNavigation]);

  // Document title follows the route and the language, always from the
  // centralized FAYQ identity.
  useEffect(() => {
    updateDocumentMetadata(lang, route, publicData);
  }, [lang, route, publicData]);

  const go = useCallback((hash: string) => {
    const href = publicHref(hash, lang);
    if (href !== hash) { window.location.assign(href); return; }
    if (window.location.hash === hash) {
      setRoute(routeFromHash());
      window.scrollTo(0, 0);
    } else {
      window.location.hash = hash;
    }
  }, [lang]);

  return (
    <div id="top" className="site-shell flex min-h-screen flex-col">
      <a
        className="skip-link"
        href="#main"
        onClick={(event) => {
          event.preventDefault();
          const main = document.getElementById('main');
          if (main) {
            main.tabIndex = -1;
            main.focus();
            main.scrollIntoView();
          }
        }}
      >
        {t.skipToContent}
      </a>
      <Header onSwitch={setLang} route={route} />
      <Suspense fallback={<main id="main"><Container><Loading text={t.loading} /></Container></main>}>
      {route==='admin-students'?<AccountWorkspace route={route}><StudentDirectoryPage/></AccountWorkspace>:null}
      {route==='support'?<SupportPage/>:null}
      {route==='admin-support'?<AccountWorkspace route={route}><SupportSettings/></AccountWorkspace>:null}
      {route==='admin-policies'?<AccountWorkspace route={route}><PolicyPage kind={route} review={true}/></AccountWorkspace>:null}
      {['terms','privacy','refunds'].includes(route)?<PolicyPage kind={route} review={false}/>:null}
      {route==='not-found'?<NotFoundPage/>:null}
      {route === 'home' ? (
        <HomePage onSelectCourse={(slug) => go(`#/courses/${encodeURIComponent(slug)}`)} />
      ) : null}
      {route === 'courses' ? (
        <PublicCatalogPage onSelect={(slug) => go(`#/courses/${encodeURIComponent(slug)}`)} />
      ) : null}
      {route === 'course-detail' ? (
        <OfferPage slug={publicData?.course?.slug ?? slugFromHash()} onBack={() => go('#/courses')} />
      ) : null}
      {route === 'admin-catalog' ? <AccountWorkspace route={route}><AdminListPage go={go} /></AccountWorkspace> : null}
      {route === 'admin-packages' ? <AccountWorkspace route={route}><AdminPackagesPage /></AccountWorkspace> : null}
      {route === 'admin-summary' ? <AccountWorkspace route={route}><AdminSummaryPage /></AccountWorkspace> : null}
      {route === 'package' ? (
        <PackagePage key={publicData?.pkg?.id ?? packageIdFromHash()} id={publicData?.pkg?.id ?? packageIdFromHash()} />
      ) : null}
      {route === 'admin-course' ? <AccountWorkspace route={route}><AdminDetailPage key={adminCourseIdFromHash()} courseId={adminCourseIdFromHash()} /></AccountWorkspace> : null}
      {route === 'register' ? (
        <main id="main">
          <section className="py-8">
            <RegisterScreen onDone={() => go('#/account')} />
          </section>
        </main>
      ) : null}
      {route === 'login' ? (
        <main id="main">
          <section className="py-8">
            <LoginScreen onDone={() => go('#/account')} />
          </section>
        </main>
      ) : null}
      {route === 'account' ? (
        <AccountWorkspace route={route}>
          <AccountOverview key={user?.id ?? 'anonymous'} go={go} />
        </AccountWorkspace>
      ) : null}
      {route === 'account-profile' ? (
        <AccountWorkspace route={route}>
          <AccountProfile go={go} />
        </AccountWorkspace>
      ) : null}
      {route === 'admin' ? (
        <AccountWorkspace route={route}>
          <main id="main">
            <section className="py-8">
              <AdminScreen go={go} />
            </section>
          </main>
        </AccountWorkspace>
      ) : null}
      {route === 'wallet' ? <AccountWorkspace route={route}><WalletPage go={go} /></AccountWorkspace> : null}
      {route === 'wallet-recharge' ? <AccountWorkspace route={route}><RechargePage go={go} /></AccountWorkspace> : null}
      {route === 'purchases' ? <AccountWorkspace route={route}><PurchaseHistoryPage /></AccountWorkspace> : null}
      {route === 'purchase' ? (
        <PurchasePage key={planIdFromHash()} planId={planIdFromHash()} go={go} />
      ) : null}
      {route === 'admin-recharge' ? <AccountWorkspace route={route}><AdminRechargePage /></AccountWorkspace> : null}
      {route === 'dashboard' ? (
        <AccountWorkspace route={route}>
          <DashboardPage
            onContinue={(slug) => go(`#/learn/${encodeURIComponent(slug)}`)}
            onRenew={() => go('#/wallet')}
            onBrowse={() => go('#/courses')}
          />
        </AccountWorkspace>
      ) : null}
      {route === 'notifications' ? <AccountWorkspace route={route}><NotificationsPage /></AccountWorkspace> : null}
      {route === 'admin-practice' && codingEnabled ? (
        <AccountWorkspace route={route}>
          <Suspense fallback={<main id="main"><Container><Loading text={t.loading} /></Container></main>}>
            <AdminQuotaPage key={user?.id ?? 'anonymous'} />
          </Suspense>
        </AccountWorkspace>
      ) : null}
      {!codingEnabled && ['practice', 'admin-practice'].includes(route) ? <main id="main"><Container><p className="py-10" role="status">{lang === 'ar' ? 'المحرر متوقف مؤقتًا في هذا الإصدار. أعمالك محفوظة؛ الاختبارات متعددة الخيارات متاحة داخل الدروس.' : 'The IDE is temporarily disabled in this version. Your work is preserved; multiple-choice quizzes remain available in lessons.'}</p></Container></main> : null}
      {(route === 'assessment' || (route === 'practice' && codingEnabled)) ? <Suspense fallback={<main id="main"><Container><Loading text={t.loading} /></Container></main>}>
        {route === 'practice' ? <PracticePage key={user?.id ?? 'anonymous'} /> : <AssessmentPage key={`${user?.id ?? 'anonymous'}:${hash}`} id={decodeURIComponent(hash.slice('#/assessment/'.length))} />}
      </Suspense> : null}
      {route === 'learn' ? (
        <Suspense
          fallback={
            <main id="main">
              <Container>
                <Loading text={t.loading} />
              </Container>
            </main>
          }
        >
          <CourseLearningPage key={`${user?.id ?? 'anonymous'}:${learnSlugFromHash()}`} courseSlug={learnSlugFromHash()} initialLessonId={learnLessonFromHash()} autoResume={learnResumeFromHash()} onRenew={() => go('#/wallet')} />
        </Suspense>
      ) : null}
      </Suspense>
      <Footer />
    </div>
  );
}

export default function App(): JSX.Element {
  const publicData = usePublicData();
  return (
    <ThemeProvider initialTheme={publicData ? "dark" : undefined}>
      <AuthProvider initialLang={publicData?.lang}>
        <NotificationsProvider>
          <FeaturesProvider><ErrorFeedbackProvider><UnsavedChangesProvider><Shell /></UnsavedChangesProvider></ErrorFeedbackProvider></FeaturesProvider>
        </NotificationsProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
