import { useCallback, useEffect, useState } from 'react';
import { AuthProvider } from './auth';
import { Container } from './components/ui/Card';
import { useLang } from './i18n';
import { routeDocumentTitle } from './pageTitles';
import { ThemeProvider } from './theme';
import { Header } from './components/layout/Header';
import { adminCourseIdFromHash, learnSlugFromHash, planIdFromHash, routeFromHash, slugFromHash, type Route } from './routes';
import { AccountScreen, AdminScreen, LoginScreen, RegisterScreen } from './screens';
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
import { CourseLearningPage } from './features/learning/pages/CourseLearningPage';

function Shell(): JSX.Element {
  const { lang, t, setLang } = useLang();
  const [route, setRoute] = useState<Route>(() => routeFromHash());

  useEffect(() => {
    const onHash = (): void => {
      setRoute(routeFromHash());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

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
    <div id="top" className="flex min-h-screen flex-col">
      <a className="skip-link" href="#main">
        {t.skipToContent}
      </a>
      <Header onSwitch={setLang} route={route} />
      {route === 'home' ? <HomePage onSelectCourse={(slug) => go(`#/courses/${encodeURIComponent(slug)}`)} /> : null}
      {route === 'courses' ? <PublicCatalogPage onSelect={(slug) => go(`#/courses/${encodeURIComponent(slug)}`)} /> : null}
      {route === 'course-detail' ? <OfferPage slug={slugFromHash()} onBack={() => go('#/courses')} /> : null}
      {route === 'admin-catalog' ? <AdminListPage go={go} /> : null}
      {route === 'admin-course' ? <AdminDetailPage courseId={adminCourseIdFromHash()} /> : null}
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
        <main id="main">
          <section className="py-8">
            <AccountScreen go={go} />
          </section>
        </main>
      ) : null}
      {route === 'admin' ? (
        <main id="main">
          <section className="py-8">
            <AdminScreen go={go} />
          </section>
        </main>
      ) : null}
      {route === 'wallet' ? <WalletPage go={go} /> : null}
      {route === 'wallet-recharge' ? <RechargePage go={go} /> : null}
      {route === 'purchases' ? <PurchaseHistoryPage /> : null}
      {route === 'purchase' ? <PurchasePage planId={planIdFromHash()} go={go} /> : null}
      {route === 'admin-recharge' ? <AdminRechargePage /> : null}
      {route === 'dashboard' ? (
        <DashboardPage
          onContinue={(slug) => go(`#/learn/${encodeURIComponent(slug)}`)}
          onRenew={() => go('#/wallet')}
          onBrowse={() => go('#/courses')}
        />
      ) : null}
      {route === 'learn' ? (
        <CourseLearningPage courseSlug={learnSlugFromHash()} onRenew={() => go('#/wallet')} />
      ) : null}
      <footer className="mt-auto border-t border-border bg-surface py-8 text-sm text-muted">
        <Container>
          <div className="flex flex-wrap items-center justify-between gap-3"><p className="font-semibold text-ink">{t.footer}</p><p dir="ltr">Learn It. Code It. <span className="font-bold text-primary-strong">Get It.</span></p></div>
        </Container>
      </footer>
    </div>
  );
}

export default function App(): JSX.Element {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Shell />
      </AuthProvider>
    </ThemeProvider>
  );
}
