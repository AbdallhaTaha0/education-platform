import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { ApiError } from '../../../auth';
import { useAuth } from '../../../auth';
import { localizeCode, useLang } from '../../../i18n';
import { Button } from '../../../components/ui/Button';
import { Card, Container } from '../../../components/ui/Card';
import { Field, textInputClassName } from '../../../components/ui/Field';
import { EmptyState, Loading, Notice } from '../../../components/ui/Notice';
import { StatusBadge } from '../../../components/ui/Dialog';
import { createAdminCourse, fetchAdminCourses } from '../api/client';
import type { AdminCourseSummary } from '../types/models';
import { CourseForm } from './CourseForm';

export function AdminListPage({ go }: { go: (h: string) => void }): JSX.Element {
  const { t, lang } = useLang();
  const { status, user } = useAuth();
  const [courses, setCourses] = useState<AdminCourseSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setCourses(await fetchAdminCourses());
    } catch (err) {
      setError(err instanceof ApiError ? err.code : 'SERVICE_ERROR');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === 'authenticated' && user?.role === 'ADMIN') void load();
  }, [status, user, load]);

  if (status === 'loading') {
    return (
      <Container>
        <Loading text={t.authChecking} />
      </Container>
    );
  }
  if (status === 'anonymous' || user === null) {
    return (
      <Container>
        <Card>
          <h1 className="text-2xl font-bold">{t.adminCatalogTitle}</h1>
          <Notice kind="info">{t.needLogin}</Notice>
        </Card>
      </Container>
    );
  }
  if (user.role !== 'ADMIN') {
    return (
      <Container>
        <Card>
          <h1 className="text-2xl font-bold">{t.forbiddenTitle}</h1>
          <Notice kind="error">{t.forbiddenBody}</Notice>
        </Card>
      </Container>
    );
  }

  async function submit(input: {
    slug: string;
    titleAr: string;
    titleEn: string;
    descriptionAr: string;
    descriptionEn: string;
  }): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      await createAdminCourse(input);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.code : 'SERVICE_ERROR');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main id="main">
      <section className="py-8">
        <Container>
          <h1 className="text-3xl font-bold">{t.adminCatalogTitle}</h1>
          <p className="mt-2 text-muted">{t.adminCatalogBody}</p>
          <a href="#/admin/packages" className="footer-discovery inline-block my-4">
            {lang === 'ar' ? 'إدارة باقات الشهور' : 'Manage monthly packages'} →
          </a>
          {error !== null ? <Notice kind="error">{localizeCode(t, error)}</Notice> : null}
          <a href="#/admin/summary" className="footer-discovery inline-block mx-4">
            {lang === 'ar' ? 'ملخص المنصة' : 'Platform overview'}
          </a>
          <CourseForm busy={busy} onSubmit={(v) => void submit(v)} />
          <h2 className="mt-6 text-2xl font-bold">
            {t.navCourses} ({courses.length})
          </h2>
          {loading ? <Loading text={t.loading} /> : null}
          {!loading && courses.length === 0 ? <EmptyState text={t.empty} /> : null}
          <div className="mt-4 grid grid-cols-3 gap-6 max-lg:grid-cols-2 max-sm:grid-cols-1">
            {courses.map((c) => (
              <Card key={c.id} className="flex flex-col gap-3">
                <h3 className="m-0 text-xl">
                  {lang === 'ar' ? c.titleAr : c.titleEn}{' '}
                  <StatusBadge
                    text={c.status}
                    tone={c.status === 'PUBLISHED' ? 'success' : 'info'}
                  />
                </h3>
                <p className="text-muted" dir="ltr">
                  {c.slug}
                </p>
                <div>
                  <Button variant="secondary" onClick={() => go(`#/admin/courses/${c.id}`)}>
                    {t.actionEdit}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </Container>
      </section>
    </main>
  );
}

export function AdminSearchField({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}): JSX.Element {
  const { t } = useLang();
  return (
    <form onSubmit={(e: FormEvent) => e.preventDefault()} noValidate>
      <Field id="admin-search" label={t.navCourses}>
        <input
          id="admin-search"
          dir="ltr"
          className={textInputClassName(false)}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </Field>
    </form>
  );
}
