import { useCallback, useEffect, useState } from 'react';
import { fetchFoundationStatus, type HealthState } from '../../../api';
import { Button } from '../../../components/ui/Button';
import { Card, Container } from '../../../components/ui/Card';
import { PublicCatalogSections } from '../../catalog/pages/PublicCatalogPage';
import { useLang } from '../../../i18n';

function StatusDot({ state }: { state: HealthState }): JSX.Element {
  const colors = { loading: 'bg-pending-fg', up: 'bg-success-fg', down: 'bg-error-fg' } as const;
  return <span className={`mt-1.5 h-4 w-4 flex-none rounded-full ${colors[state]}`} aria-hidden="true" />;
}

export function HomePage({ onSelectCourse }: { onSelectCourse: (slug: string) => void }): JSX.Element {
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
      <PublicCatalogSections onSelect={onSelectCourse} />
      <section className="py-16 pb-12">
        <Container>
          <p className="mb-4 inline-block rounded-full bg-ink px-3 py-1 text-sm font-semibold text-white">{t.heroBadge}</p>
          <h2 className="text-4xl font-bold">{t.heroTitle}</h2>
          <p className="mt-4 max-w-[68ch] text-lg text-muted">{t.heroBody}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a className="inline-flex min-h-[44px] items-center justify-center rounded-control border border-transparent bg-primary px-6 font-semibold text-white no-underline hover:bg-primary-hover" href="#status">
              {t.heroPrimary}
            </a>
            <a className="inline-flex min-h-[44px] items-center justify-center rounded-control border border-primary bg-surface px-6 font-semibold text-primary no-underline" href="#how">
              {t.heroSecondary}
            </a>
            <a className="inline-flex min-h-[44px] items-center justify-center rounded-control border border-primary bg-surface px-6 font-semibold text-primary no-underline" href="#/register">
              {t.submitRegister}
            </a>
          </div>
        </Container>
      </section>
      <section id="how" className="py-8" aria-labelledby="how-title">
        <Container>
          <Card>
            <h2 id="how-title" className="text-2xl font-bold">{t.howTitle}</h2>
            <p className="mt-2">{t.howBody}</p>
          </Card>
        </Container>
      </section>
      <section id="status" className="py-8" aria-labelledby="status-title" aria-live="polite">
        <Container>
          <h2 id="status-title" className="text-2xl font-bold">{t.statusTitle}</h2>
          <p className="text-muted">{t.statusBody}</p>
          <div className="mt-6 grid grid-cols-2 gap-6 max-sm:grid-cols-1">
            <Card className="flex items-start gap-4">
              <StatusDot state={live} />
              <div>
                <h3 className="text-lg">{t.liveLabel}</h3>
                <p className="m-0">{live === 'loading' ? t.stateLoading : live === 'up' ? t.stateUp : t.stateDown}</p>
              </div>
            </Card>
            <Card className="flex items-start gap-4">
              <StatusDot state={ready} />
              <div>
                <h3 className="text-lg">{t.readyLabel}</h3>
                <p className="m-0">{ready === 'loading' ? t.stateLoading : ready === 'up' ? t.stateUp : t.stateDown}</p>
              </div>
            </Card>
          </div>
          <div className="mt-6">
            <Button variant="secondary" onClick={() => void check()} disabled={checking}>{t.retry}</Button>
          </div>
        </Container>
      </section>
    </main>
  );
}
