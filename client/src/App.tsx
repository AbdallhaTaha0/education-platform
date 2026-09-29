import { useCallback, useEffect, useState } from 'react';
import { AuthProvider } from './auth';
import { Container } from './components/ui/Card';
import { useLang } from './i18n';
import { Header } from './components/layout/Header';
import { adminCourseIdFromHash, routeFromHash, slugFromHash, type Route } from './routes';
import { AccountScreen, AdminScreen, LoginScreen, RegisterScreen } from './screens';
import { PublicCatalogPage } from './features/catalog/pages/PublicCatalogPage';
import { OfferPage } from './features/catalog/pages/OfferPage';
import { AdminListPage } from './features/catalog/pages/AdminListPage';
import { AdminDetailPage } from './features/catalog/pages/AdminDetailPage';
import { HomePage } from './features/home/pages/HomePage';

function Shell(): JSX.Element {
  const { t, setLang } = useLang();
  const [route, setRoute] = useState<Route>(() => routeFromHash());

  useEffect(() => {
    const onHash = (): void => {
      setRoute(routeFromHash());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const go = useCallback((hash: string) => {
    if (window.location.hash === hash) {
      setRoute(routeFromHash());
      window.scrollTo(0, 0);
    } else {
      window.location.hash = hash;
    }
  }, []);

  return (
    <div id="top">
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
      <footer className="mt-12 border-t border-border py-6 text-sm text-muted">
        <Container>
          <p>{t.footer}</p>
        </Container>
      </footer>
    </div>
  );
}

export default function App(): JSX.Element {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  );
}
