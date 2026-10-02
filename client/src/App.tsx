import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './auth';
import { Container } from './components/ui/Card';
import { ErrorFeedbackProvider } from './components/ui/ErrorFeedback';
import { UnsavedChangesProvider, useConfirmNavigation } from './components/ui/UnsavedChanges';
import { useLang } from './i18n';
import { routeDocumentTitle } from './pageTitles';
import { ThemeProvider } from './theme';
import { Header } from './components/layout/Header';
import {
  adminCourseIdFromHash,
  learnSlugFromHash,
  planIdFromHash,
  packageIdFromHash,
  routeFromHash,
  slugFromHash,
  type Route,
} from './routes';
import { PackagePage } from './features/academic/PackagePage';
import { AdminPackagesPage } from './features/academic/AdminPackagesPage';
import { AdminSummaryPage } from './features/academic/AdminSummaryPage';
import { AdminScreen, LoginScreen, RegisterScreen } from './screens';
import { AccountWorkspace } from './features/identity/pages/AccountWorkspace';
import { AccountOverview } from './features/identity/pages/AccountOverview';
import { AccountProfile } from './features/identity/pages/AccountProfile';
import { PublicCatalogPage } from './features/catalog/pages/PublicCatalogPage';
import { OfferPage } from './features/catalog/pages/OfferPage';
import { AdminListPage } from './features/catalog/pages/AdminListPage';
import { AdminDetailPage } from './features/catalog/pages/AdminDetailPage';
import { HomePage } from './features/home/pages/HomePage';
import { WalletPage } from './features/wallet/pages/WalletPage';
import { RechargePage } from './features/wallet/pages/RechargePage';
import { AdminRechargePage } from './features/wallet/pages/AdminRechargePage';
import { PurchasePage } from './features/purchase/pages/PurchasePage';
import { PurchaseHistoryPage } from './features/purchase/pages/PurchaseHistoryPage';
import { DashboardPage } from './features/learning/pages/DashboardPage';
import { Loading } from './components/ui/Notice';
const CourseLearningPage = lazy(() =>
  import('./features/learning/pages/CourseLearningPage').then((module) => ({
    default: module.CourseLearningPage,
  })),
);
import { NotificationsProvider } from './features/notifications/context';
import { NotificationsPage } from './features/notifications/pages/NotificationsPage';
import { StudentDirectoryPage } from './features/identity/pages/StudentDirectoryPage';
import { SupportPage, PolicyPage, NotFoundPage } from './features/identity/pages/HelpPages';
import { SupportSettings } from './features/identity/pages/SupportSettings';
const PracticePage = lazy(() => import('./features/ide/PracticePage').then((m) => ({ default: m.PracticePage })));
const AssessmentPage = lazy(() => import('./features/assessments/AssessmentPage').then((m) => ({ default: m.AssessmentPage })));
const AdminQuotaPage = lazy(() => import('./features/assessments/AdminQuotaPage').then((m) => ({ default: m.AdminQuotaPage })));

function Shell(): JSX.Element {
  const confirmNavigation = useConfirmNavigation();
  const { lang, t, setLang } = useLang();
  const { user } = useAuth();
  const [route, setRoute] = useState<Route>(() => routeFromHash());
  const [hash, setHash] = useState(() => window.location.hash);

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
    document.title = routeDocumentTitle(lang, route, t);
  }, [lang, route, t]);

  const go = useCallback((hash: string) => {
    if (window.location.hash === hash) {
      setRoute(routeFromHash());
      window.scrollTo(0, 0);
    } else {
      window.location.hash = hash;
    }
  }, []);

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
        <OfferPage slug={slugFromHash()} onBack={() => go('#/courses')} />
      ) : null}
      {route === 'admin-catalog' ? <AccountWorkspace route={route}><AdminListPage go={go} /></AccountWorkspace> : null}
      {route === 'admin-packages' ? <AccountWorkspace route={route}><AdminPackagesPage /></AccountWorkspace> : null}
      {route === 'admin-summary' ? <AccountWorkspace route={route}><AdminSummaryPage /></AccountWorkspace> : null}
      {route === 'package' ? (
        <PackagePage key={packageIdFromHash()} id={packageIdFromHash()} />
      ) : null}
      {route === 'admin-course' ? <AccountWorkspace route={route}><AdminDetailPage courseId={adminCourseIdFromHash()} /></AccountWorkspace> : null}
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
      {route === 'admin-practice' ? (
        <AccountWorkspace route={route}>
          <Suspense fallback={<main id="main"><Container><Loading text={t.loading} /></Container></main>}>
            <AdminQuotaPage key={user?.id ?? 'anonymous'} />
          </Suspense>
        </AccountWorkspace>
      ) : null}
      {['practice', 'assessment'].includes(route) ? <Suspense fallback={<main id="main"><Container><Loading text={t.loading} /></Container></main>}>
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
          <CourseLearningPage courseSlug={learnSlugFromHash()} onRenew={() => go('#/wallet')} />
        </Suspense>
      ) : null}
      <footer className="mt-auto border-t border-border bg-surface py-8 text-sm text-muted">
        <Container>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-semibold text-ink">{t.footer}</p>
            <a className="footer-discovery" href="#/courses">
              {t.navCourses} ↗
            </a>
            <p>{t.slogan}</p>
            <nav className="flex flex-wrap gap-4" aria-label={lang==='ar'?'المساعدة والسياسات':'Help and policies'}>{[['support','المساعدة','Help'],['terms','الشروط','Terms'],['privacy','الخصوصية','Privacy'],['refunds','الاسترداد','Refunds']].map(([id,a,e])=><a key={id} href={`#/${id}`} className="underline">{lang==='ar'?a:e}</a>)}</nav>
          </div>
        </Container>
      </footer>
    </div>
  );
}

export default function App(): JSX.Element {
  return (
    <ThemeProvider>
      <AuthProvider>
        <NotificationsProvider>
          <ErrorFeedbackProvider><UnsavedChangesProvider><Shell /></UnsavedChangesProvider></ErrorFeedbackProvider>
        </NotificationsProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
