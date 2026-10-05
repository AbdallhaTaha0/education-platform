import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { ApiError } from '../../../auth';
import { useAuth } from '../../../auth';
import { localizeCode, useLang } from '../../../i18n';
import { Button } from '../../../components/ui/Button';
import { FormActions } from '../../../components/ui/FormActions';
import { Card, Container } from '../../../components/ui/Card';
import { Field, textInputClassName } from '../../../components/ui/Field';
import { EmptyState, Loading, Notice } from '../../../components/ui/Notice';
import { StatusBadge } from '../../../components/ui/Dialog';
import { createAdminCourse, fetchAdminCourses } from '../api/client';
import type { AdminCourseSummary } from '../types/models';
import { CourseForm } from './CourseForm';
import { businessState } from '../../../components/ui/AdminNavigation';
import { PaginatedCollection } from '../../../components/ui/Pagination';
import { AdminCourseTabs } from '../components/AdminCourseTabs';

export function AdminListPage({ go }: { go: (h: string) => void }): JSX.Element {
  const { t, lang } = useLang();
  const { status, user } = useAuth();
  const [courses, setCourses] = useState<AdminCourseSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [creating,setCreating]=useState(false); const [query,setQuery]=useState(''); const [state,setState]=useState(''); const [grade,setGrade]=useState(''); const [term,setTerm]=useState('');
  const filtered=courses.filter(c=>(!query || `${c.titleAr} ${c.titleEn} ${c.slug}`.toLowerCase().includes(query.toLowerCase())) && (!state || c.status===state) && (!grade || c.grade===grade) && (!term || c.term===Number(term)));

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
  }): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      await createAdminCourse(input);
      await load();
      setCreating(false); return true;
    } catch (err) {
      setError(err instanceof ApiError ? err.code : 'SERVICE_ERROR');
      return false;
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
          <AdminCourseTabs courses={courses} />
          <a href="#/admin/packages" className="footer-discovery inline-block my-4">
            {lang === 'ar' ? 'إدارة باقات الشهور' : 'Manage monthly packages'} →
          </a>
          {error !== null ? <Notice kind="error">{localizeCode(t, error)}</Notice> : null}
          <a href="#/admin/summary" className="footer-discovery inline-block mx-4">
            {lang === 'ar' ? 'ملخص المنصة' : 'Platform overview'}
          </a>
          <FormActions>
            <Button onClick={()=>setCreating(true)}>{t.courseCreateTitle}</Button>
          </FormActions>
          {creating ? <CourseForm busy={busy} onSubmit={submit} /> : null}
          <h2 className="mt-6 text-2xl font-bold">
            {t.navCourses} ({filtered.length}/{courses.length})
          </h2>
          <div className="my-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><AdminSearchField value={query} onChange={setQuery}/>{[
            [lang==='ar'?'الحالة':'Status',state,setState,['DRAFT','PROCESSING','READY','PUBLISHED','ARCHIVED']],
            [lang==='ar'?'الصف':'Grade',grade,setGrade,['FIRST_SECONDARY','SECOND_SECONDARY']],
            [lang==='ar'?'الترم':'Term',term,setTerm,['1','2']],
          ].map(([label,value,setter,options],i)=><label key={i}>{label as string}<select aria-label={label as string} className={textInputClassName(false)} value={value as string} onChange={e=>(setter as (s:string)=>void)(e.target.value)}><option value="">{lang==='ar'?'الكل':'All'}</option>{(options as string[]).map(s=><option key={s} value={s}>{i===0?businessState(s,lang==='ar'):i===1?(s==='FIRST_SECONDARY'?(lang==='ar'?'الأول الثانوي':'First secondary'):(lang==='ar'?'الثاني الثانوي':'Second secondary')):s}</option>)}</select></label>)}</div>
          <Button variant="secondary" onClick={()=>{setQuery('');setState('');setGrade('');setTerm('');}}>{lang==='ar'?'مسح البحث والتصفية':'Clear search and filters'}</Button>
          {loading ? <Loading text={t.loading} /> : null}
          {!loading && filtered.length === 0 ? <EmptyState text={lang==='ar'?'لا توجد نتائج. غيّر البحث أو امسح التصفية.':'No matching courses. Change your search or clear the filters.'} /> : null}
          <PaginatedCollection id="admin-courses" resetKey={JSON.stringify([query,state,grade,term])} className="mt-4 grid grid-cols-3 gap-6 max-lg:grid-cols-2 max-sm:grid-cols-1">
            {filtered.map((c) => (
              <Card key={c.id} className="flex flex-col gap-3">
                <h3 className="m-0 text-xl">
                  {lang === 'ar' ? c.titleAr : c.titleEn}{' '}
                  <StatusBadge
                    text={businessState(c.status,lang==='ar')}
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
          </PaginatedCollection>
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
  const { lang } = useLang();
  return (
    <form onSubmit={(e: FormEvent) => e.preventDefault()} noValidate>
      <Field id="admin-search" label={lang==='ar'?'البحث بالاسم أو المعرّف':'Search by name or slug'}>
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
