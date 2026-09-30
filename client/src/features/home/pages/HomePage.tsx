import { useCallback, useEffect, useState } from 'react';
import { fetchFoundationStatus, type HealthState } from '../../../api';
import { Button } from '../../../components/ui/Button';
import { Card, Container } from '../../../components/ui/Card';
import { PublicCatalogSections } from '../../catalog/pages/PublicCatalogPage';
import { useLang } from '../../../i18n';
import { Wordmark } from '../../../components/ui/Wordmark';

function FeatureIcon({ kind }: { kind: 'learn' | 'code' | 'ai' | 'progress' }): JSX.Element {
  const paths = {
    learn: <path d="M4 7.5 12 3l8 4.5-8 4.5-8-4.5Zm3 3.2V15c2.8 2 7.2 2 10 0v-4.3M20 8v6" />,
    code: <path d="m8 7-4 5 4 5m8-10 4 5-4 5m-3-12-2 14" />,
    ai: <path d="M9 4a3 3 0 0 0-3 3v1a3 3 0 0 0-2 3 3 3 0 0 0 2 3v1a3 3 0 0 0 3 3m6-14a3 3 0 0 1 3 3v1a3 3 0 0 1 2 3 3 3 0 0 1-2 3v1a3 3 0 0 1-3 3M9 4v14m6-14v14M9 8h3m-3 5h3m3-5h-3m3 5h-3" />,
    progress: <path d="M5 19V9m5 10V5m5 14v-7m5 7V3" />,
  } as const;
  return <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[kind]}</svg>;
}

function StatusDot({ state }: { state: HealthState }): JSX.Element {
  const colors = { loading: 'bg-pending-fg', up: 'bg-success-fg', down: 'bg-error-fg' } as const;
  return <span className={`mt-1.5 h-4 w-4 flex-none rounded-full ${colors[state]}`} aria-hidden="true" />;
}

export function HomePage({ onSelectCourse }: { onSelectCourse: (slug: string) => void }): JSX.Element {
  const { t, lang } = useLang();
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
      <section className="hero-grid relative overflow-hidden border-b border-border py-14 md:py-20">
        <Container>
          <div className="grid items-center gap-10 lg:grid-cols-[1.08fr_.92fr]">
            <div>
              <div className="mb-6"><Wordmark variant="full" markSize={56} /></div>
              <p className="mb-4 inline-flex rounded-full border border-primary/60 bg-primary/10 px-4 py-1.5 text-sm font-bold text-primary-strong">
                {lang === 'ar' ? 'برمجة وذكاء اصطناعي لطلاب المرحلة الثانوية' : 'Programming & AI for secondary students'}
              </p>
              <h1 className="max-w-[14ch] text-4xl font-extrabold leading-[1.15] md:text-6xl">
                {lang === 'ar' ? <>فهم حقيقي في <span className="text-primary-strong">البرمجة والذكاء الاصطناعي</span></> : <>Real understanding in <span className="text-primary-strong">Programming & AI</span></>}
              </h1>
              <p className="mt-5 max-w-[60ch] text-lg text-muted md:text-xl">
                {lang === 'ar' ? 'نحوّل الموضوعات المعقدة إلى دروس واضحة وعملية تساعدك على الفهم والتطبيق وبناء مهارات حقيقية.' : 'We turn complex topics into clear, practical lessons that help you understand, apply, and build real skills.'}
              </p>
              <p className="mt-4 text-xl font-bold text-accent" data-testid="brand-slogan">{t.slogan}</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <a className="inline-flex min-h-[48px] items-center justify-center gap-3 rounded-control bg-primary px-7 font-extrabold text-primary-ink no-underline shadow-lift transition-transform hover:-translate-y-0.5 hover:bg-primary-hover" href="#/courses">
                  {lang === 'ar' ? 'ابدأ التعلم' : 'Start learning'} <span aria-hidden="true">→</span>
                </a>
                <a className="inline-flex min-h-[48px] items-center justify-center rounded-control border border-border-strong bg-surface px-7 font-bold text-ink no-underline hover:border-primary hover:bg-interactive" href="#how">
                  {lang === 'ar' ? 'كيف تعمل FAYQ؟' : 'How FAYQ works'}
                </a>
              </div>
            </div>
            <div className="code-scene" aria-label={lang === 'ar' ? 'مسار تعلم البرمجة' : 'Programming learning path'}>
              <div className="code-scene__glow" aria-hidden="true" />
              <div className="code-scene__panel" dir="ltr">
                <div className="flex items-center gap-2 border-b border-border px-5 py-3"><span className="h-2.5 w-2.5 rounded-full bg-error-fg" /><span className="h-2.5 w-2.5 rounded-full bg-amber" /><span className="h-2.5 w-2.5 rounded-full bg-primary" /><span className="ms-auto font-mono text-xs text-muted">python-basics.py</span></div>
                <pre className="overflow-hidden p-6 text-sm leading-7 text-cream"><code><span className="text-lime">skills</span> = [<span className="text-amber">"understand"</span>,{`\n`}          <span className="text-amber">"practice"</span>,{`\n`}          <span className="text-amber">"build"</span>]{`\n\n`}for skill in skills:{`\n`}    <span className="text-lime">learn</span>(skill){`\n\n`}print(<span className="text-amber">"Hello, FAYQ!"</span>)</code></pre>
              </div>
              <div className="code-scene__note" aria-hidden="true">✓ Understand<br />✓ Practice<br />✓ Build<br />✓ Get ready</div>
            </div>
          </div>
        </Container>
      </section>
      <section className="border-b border-border bg-surface py-10" aria-label={lang === 'ar' ? 'مزايا FAYQ' : 'FAYQ benefits'}>
        <Container>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {([
              ['learn', lang === 'ar' ? 'شرح واضح' : 'Clear explanations', lang === 'ar' ? 'لغة بسيطة وفهم حقيقي.' : 'Simple language, real understanding.'],
              ['code', lang === 'ar' ? 'تطبيق عملي' : 'Practical practice', lang === 'ar' ? 'اكتب الكود وحل المشكلات.' : 'Write code and solve problems.'],
              ['ai', lang === 'ar' ? 'جاهز للذكاء الاصطناعي' : 'AI ready', lang === 'ar' ? 'مهارات تبني بها مستقبلك.' : 'Build skills for the future.'],
              ['progress', lang === 'ar' ? 'تقدم حقيقي' : 'Real progress', lang === 'ar' ? 'تابع تعلمك وشاهد نتائجك.' : 'Track learning and see results.'],
            ] as const).map(([kind, title, body]) => (
              <article key={kind} className="group rounded-card border border-border bg-canvas p-5 transition-colors hover:border-primary">
                <span className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-control border border-primary/60 bg-primary/10 text-primary-strong"><FeatureIcon kind={kind} /></span>
                <h2 className="text-lg font-bold">{title}</h2><p className="mt-1 text-sm text-muted">{body}</p>
              </article>
            ))}
          </div>
        </Container>
      </section>
      <PublicCatalogSections onSelect={onSelectCourse} compact />
      <section id="how" className="py-12" aria-labelledby="how-title">
        <Container>
          <Card className="overflow-hidden border-border-strong bg-elevated md:p-8">
            <div className="grid gap-8 md:grid-cols-[.8fr_1.2fr] md:items-center">
              <div><p className="text-sm font-bold uppercase tracking-[.14em] text-primary-strong">{lang === 'ar' ? 'خطوات واضحة' : 'A clear path'}</p><h2 id="how-title" className="section-title mt-2">{lang === 'ar' ? 'من أول درس إلى مهارة حقيقية' : 'From the first lesson to a real skill'}</h2></div>
              <ol className="grid gap-3 sm:grid-cols-3">
                {(lang === 'ar' ? ['اختر دورتك', 'اشترك وتعلّم', 'تقدّم خطوة بخطوة'] : ['Choose a course', 'Subscribe and learn', 'Progress step by step']).map((step, index) => <li key={step} className="rounded-control border border-border bg-surface p-4"><span className="mb-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary font-extrabold text-primary-ink">{index + 1}</span><p className="font-bold">{step}</p></li>)}
              </ol>
            </div>
          </Card>
        </Container>
      </section>
      <section id="status" className="py-10" aria-labelledby="status-title" aria-live="polite">
        <Container>
          <h2 id="status-title" className="section-title">{t.statusTitle}</h2>
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
