import { useCallback, useEffect, useState } from 'react';
import { fetchFoundationStatus, type HealthState } from './api';
import { AuthProvider, useAuth } from './auth';
import { Button, Container } from './components';
import { useLang, type Lang } from './i18n';
import { AccountScreen, AdminScreen, LoginScreen, RegisterScreen } from './screens';

type Route = 'home' | 'register' | 'login' | 'account' | 'admin';

function routeFromHash(): Route {
  const hash = window.location.hash;
  if (hash === '#/register') return 'register';
  if (hash === '#/login') return 'login';
  if (hash === '#/account') return 'account';
  if (hash === '#/admin') return 'admin';
  return 'home';
}

function StatusDot({ state }: { state: HealthState }): JSX.Element {
  return <span className={`dot dot--${state}`} aria-hidden="true" />;
}

function stateText(state: HealthState, t: { stateLoading: string; stateUp: string; stateDown: string }): string {
  if (state === 'loading') return t.stateLoading;
  return state === 'up' ? t.stateUp : t.stateDown;
}

function Header({ onSwitch, route }: { onSwitch: (lang: Lang) => void; route: Route }): JSX.Element {
  const { lang, t } = useLang();
  const { status, user } = useAuth();
  return (
    <header className="site-header">
      <Container>
        <div className="header-inner">
          <a className="brand" href="#/" aria-label={t.brand}>
            <span className="brand-mark" aria-hidden="true">
              {'</>'}
            </span>
            <span className="brand-text">
              <strong>{t.brand}</strong>
              <small>{t.brandSub}</small>
            </span>
          </a>
          <nav className="site-nav" aria-label={t.brand}>
            <a href="#/" aria-current={route === 'home' ? 'page' : undefined}>
              {t.navHome}
            </a>
            <a href="#/account" aria-current={route === 'account' ? 'page' : undefined}>
              {status === 'authenticated' && user ? t.navAccount : t.navLogin}
            </a>
            {status === 'authenticated' && user?.role === 'ADMIN' ? (
              <a href="#/admin" aria-current={route === 'admin' ? 'page' : undefined}>
                {t.navAdmin}
              </a>
            ) : null}
          </nav>
          <div className="lang-switch" role="group" aria-label={t.langLabel}>
            <button
              type="button"
              className={lang === 'ar' ? 'is-active' : ''}
              aria-pressed={lang === 'ar'}
              onClick={() => onSwitch('ar')}
            >
              العربية
            </button>
            <button
              type="button"
              className={lang === 'en' ? 'is-active' : ''}
              aria-pressed={lang === 'en'}
              onClick={() => onSwitch('en')}
            >
              English
            </button>
          </div>
        </div>
      </Container>
    </header>
  );
}

function HomeView(): JSX.Element {
  const { t } = useLang();
  const [live, setLive] = useState<HealthState>('loading');
  const [ready, setReady] = useState<HealthState>('loading');
  const [checking, setChecking] = useState(true);

  const check = useCallback(async () => {
    setChecking(true);
    setLive('loading');
    setReady('loading');
    try {
      const status = await fetchFoundationStatus();
      setLive(status.live);
      setReady(status.ready);
    } catch {
      setLive('down');
      setReady('down');
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    void check();
  }, [check]);

  return (
    <main id="main">
      <section className="hero">
        <Container>
          <p className="eyebrow">{t.heroBadge}</p>
          <h1>{t.heroTitle}</h1>
          <p className="lede">{t.heroBody}</p>
          <div className="hero-actions">
            <a className="btn btn--primary" href="#status">
              {t.heroPrimary}
            </a>
            <a className="btn btn--secondary" href="#how">
              {t.heroSecondary}
            </a>
            <a className="btn btn--secondary" href="#/register">
              {t.submitRegister}
            </a>
          </div>
        </Container>
      </section>

      <section id="how" className="section" aria-labelledby="how-title">
        <Container>
          <div className="card">
            <h2 id="how-title">{t.howTitle}</h2>
            <p>{t.howBody}</p>
          </div>
        </Container>
      </section>

      <section id="status" className="section" aria-labelledby="status-title" aria-live="polite">
        <Container>
          <h2 id="status-title">{t.statusTitle}</h2>
          <p className="muted">{t.statusBody}</p>
          <div className="status-grid">
            <div className="card status-card">
              <StatusDot state={live} />
              <div>
                <h3>{t.liveLabel}</h3>
                <p className={`state state--${live}`}>{stateText(live, t)}</p>
              </div>
            </div>
            <div className="card status-card">
              <StatusDot state={ready} />
              <div>
                <h3>{t.readyLabel}</h3>
                <p className={`state state--${ready}`}>{stateText(ready, t)}</p>
              </div>
            </div>
          </div>
          <div className="status-actions">
            <Button variant="secondary" onClick={() => void check()} disabled={checking}>
              {t.retry}
            </Button>
          </div>
        </Container>
      </section>
    </main>
  );
}

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
    <div id="top" className="page">
      <a className="skip-link" href="#main">
        {t.skipToContent}
      </a>
      <Header onSwitch={setLang} route={route} />
      {route === 'home' ? <HomeView /> : null}
      {route === 'register' ? (
        <main id="main">
          <section className="section">
            <RegisterScreen onDone={() => go('#/account')} />
          </section>
        </main>
      ) : null}
      {route === 'login' ? (
        <main id="main">
          <section className="section">
            <LoginScreen onDone={() => go('#/account')} />
          </section>
        </main>
      ) : null}
      {route === 'account' ? (
        <main id="main">
          <section className="section">
            <AccountScreen go={go} />
          </section>
        </main>
      ) : null}
      {route === 'admin' ? (
        <main id="main">
          <section className="section">
            <AdminScreen go={go} />
          </section>
        </main>
      ) : null}
      <footer className="site-footer">
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
