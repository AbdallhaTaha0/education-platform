import { useLang } from '../../../i18n';
import { localizeCode } from '../../../i18n';
import { Button } from '../../../components/ui/Button';
import { Card, Container } from '../../../components/ui/Card';
import { EmptyState, Loading, Notice } from '../../../components/ui/Notice';
import { usePublicCourses } from '../hooks/usePublicCourses';
import { PriceDisplay } from '../components/PriceDisplay';

export function PublicCatalogSections({ onSelect, compact = false }: { onSelect: (slug: string) => void; compact?: boolean }): JSX.Element {
  const { t, lang } = useLang();
  const { loading, courses, error, reload } = usePublicCourses();
  return (
    <>
      {!compact ? <section className="brand-banner py-14 md:py-16">
        <Container>
          <p className="mb-4 inline-block rounded-full border border-primary/60 bg-primary/10 px-4 py-1 text-sm font-bold text-primary-strong">{t.brand}</p>
          <h1 className="page-title">{t.catalogTitle}</h1>
          <p className="mt-4 max-w-[68ch] text-lg text-muted">{t.catalogBody}</p>
        </Container>
      </section> : null}
      <section className={compact ? 'py-14' : 'py-10'} aria-labelledby="catalog-title" aria-live="polite">
        <Container>
          <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-bold uppercase tracking-[.14em] text-primary-strong">{lang === 'ar' ? 'تعلّم بطريقتك' : 'Learn your way'}</p><h2 id="catalog-title" className="section-title mt-1">{compact ? (lang === 'ar' ? 'ابدأ بدورة تناسبك' : 'Start with the right course') : t.navCourses}</h2></div>{compact ? <a href="#/courses" className="font-bold text-primary-strong underline-offset-4 hover:underline">{lang === 'ar' ? 'عرض كل الدورات' : 'View all courses'} →</a> : null}</div>
          {loading ? <Loading text={t.catalogLoading} /> : null}
          {error !== null ? (
            <div>
              <Notice kind="error">{localizeCode(t, error)}</Notice>
              <Button variant="secondary" onClick={reload}>
                {t.retryLabel}
              </Button>
            </div>
          ) : null}
          {!loading && error === null && courses.length === 0 ? <EmptyState text={t.catalogEmpty} /> : null}
          <div className="mt-6 grid grid-cols-3 gap-6 max-lg:grid-cols-2 max-sm:grid-cols-1">
            {courses.map((c) => (
              <article key={c.id}>
                <Card className="group relative flex h-full flex-col gap-3 overflow-hidden border-border-strong transition-[border-color,transform,box-shadow] hover:-translate-y-1 hover:border-primary hover:shadow-lift">
                  <div className="-mx-6 -mt-6 mb-2 flex h-28 items-end bg-[linear-gradient(135deg,var(--fayq-forest),#1d3927)] p-5"><span className="font-mono text-sm font-bold text-lime">&lt;/&gt; FAYQ</span></div>
                  <h3 className="m-0 text-xl font-bold">{lang === 'ar' ? c.titleAr : c.titleEn}</h3>
                  <p className="line-clamp-3 text-muted">{lang === 'ar' ? c.descriptionAr : c.descriptionEn}</p>
                  {c.plans[0] !== undefined ? (
                    <PriceDisplay current={c.plans[0].currentPricePiastres} previous={c.plans[0].previousPricePiastres} durationDays={c.plans[0].durationDays} />
                  ) : null}
                  <Button variant="primary" className="mt-auto w-full" onClick={() => onSelect(c.slug)}>
                    {lang === 'ar' ? 'عرض العرض' : 'View offer'}
                  </Button>
                </Card>
              </article>
            ))}
          </div>
        </Container>
      </section>
    </>
  );
}

export function PublicCatalogPage({ onSelect }: { onSelect: (slug: string) => void }): JSX.Element {
  return (
    <main id="main">
      <PublicCatalogSections onSelect={onSelect} />
    </main>
  );
}
