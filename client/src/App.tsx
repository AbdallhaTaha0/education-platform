import { useCallback, useEffect, useState } from 'react';
import { fetchFoundationStatus, type HealthState } from './api';
import { Button, Container } from './components';
import { useLang, type Lang } from './i18n';

function StatusDot({ state }: { state: HealthState }): JSX.Element {
  return <span className={`dot dot--${state}`} aria-hidden="true" />;
}

function stateText(state: HealthState, t: { stateLoading: string; stateUp: string; stateDown: string }): string {
  if (state === 'loading') return t.stateLoading;
  return state === 'up' ? t.stateUp : t.stateDown;
}

function Header({ onSwitch }: { onSwitch: (lang: Lang) => void }): JSX.Element {
  const { lang, t } = useLang();
  return (
    <header className="site-header">
      <Container>
        <div className="header-inner">
          <a className="brand" href="#top" aria-label={t.brand}>
            <span className="brand-mark" aria-hidden="true">
              {'</>'}
            </span>
            <span className="brand-text">
              <strong>{t.brand}</strong>
              <small>{t.brandSub}</small>
            </span>
          </a>
          <nav className="site-nav" aria-label={t.brand}>
            <a href="#top">{t.navHome}</a>
            <a href="#status">{t.navStatus}</a>
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

export default function App(): JSX.Element {
  const { t, setLang } = useLang();
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
    <div id="top" className="page">
      <a className="skip-link" href="#main">
        {t.skipToContent}
      </a>
      <Header onSwitch={setLang} />
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
      <footer className="site-footer">
        <Container>
          <p>{t.footer}</p>
        </Container>
      </footer>
    </div>
  );
}
