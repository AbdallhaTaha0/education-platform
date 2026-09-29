import { useLang } from '../../../i18n';
import { localizeCode } from '../../../i18n';
import { Button } from '../../../components/ui/Button';
import { Card, Container } from '../../../components/ui/Card';
import { EmptyState, Loading, Notice } from '../../../components/ui/Notice';
import { usePublicCourses } from '../hooks/usePublicCourses';
import { PriceDisplay } from '../components/PriceDisplay';

export function PublicCatalogSections({ onSelect }: { onSelect: (slug: string) => void }): JSX.Element {
  const { t, lang } = useLang();
  const { loading, courses, error, reload } = usePublicCourses();
  return (
    <>
      <section className="py-16 pb-12">
        <Container>
          <p className="mb-4 inline-block rounded-full bg-ink px-3 py-1 text-sm font-semibold text-white">{t.brand}</p>
          <h1 className="text-4xl font-bold">{t.catalogTitle}</h1>
          <p className="mt-4 max-w-[68ch] text-lg text-muted">{t.catalogBody}</p>
        </Container>
      </section>
      <section className="py-8" aria-labelledby="catalog-title" aria-live="polite">
        <Container>
          <h2 id="catalog-title" className="text-2xl font-bold">
            {t.navCourses}
          </h2>
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
                <Card className="flex h-full flex-col gap-3">
                  <h3 className="m-0 text-xl">{lang === 'ar' ? c.titleAr : c.titleEn}</h3>
                  <p className="line-clamp-3 text-muted">{lang === 'ar' ? c.descriptionAr : c.descriptionEn}</p>
                  {c.plans[0] !== undefined ? (
                    <PriceDisplay current={c.plans[0].currentPricePiastres} previous={c.plans[0].previousPricePiastres} durationDays={c.plans[0].durationDays} />
                  ) : null}
                  <Button variant="primary" onClick={() => onSelect(c.slug)}>
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
