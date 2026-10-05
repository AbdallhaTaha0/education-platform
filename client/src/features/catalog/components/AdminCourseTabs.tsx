import { useEffect, useState } from 'react';
import { useAuth } from '../../../auth';
import { useLang } from '../../../i18n';
import { fetchAdminCourses } from '../api/client';
import type { AdminCourseSummary } from '../types/models';
import { PaginatedCollection } from '../../../components/ui/Pagination';
import { textInputClassName } from '../../../components/ui/Field';
import { Notice } from '../../../components/ui/Notice';

/** Each course has a bookmarkable workspace; these are route links, not local panels. */
export function AdminCourseTabs({ current, currentTitle, courses: supplied }: { current?: string; currentTitle?: { ar: string; en: string }; courses?: AdminCourseSummary[] }): JSX.Element {
  const { user } = useAuth(); const { lang } = useLang(); const ar = lang === 'ar';
  const [loaded, setLoaded] = useState<AdminCourseSummary[]>([]), [query, setQuery] = useState(''), [failed, setFailed] = useState(false);
  useEffect(() => {
    if (supplied || user?.role !== 'ADMIN') return;
    let active = true; setFailed(false);
    void fetchAdminCourses().then(rows => { if (active) setLoaded(rows); }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [supplied, user?.role]);
  const courses = (supplied ?? loaded).map(c => c.id === current && currentTitle ? { ...c, titleAr: currentTitle.ar, titleEn: currentTitle.en } : c);
  const filtered = courses.filter(c => `${c.titleAr} ${c.titleEn} ${c.slug}`.toLowerCase().includes(query.trim().toLowerCase()));
  return <nav aria-label={ar ? 'مساحات عمل الكورسات' : 'Course workspaces'} data-testid="admin-course-switcher" className="my-5 rounded-card border border-border bg-surface p-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-bold">{ar ? 'اختَر الكورس' : 'Choose a course'}</h2><a href="#/admin/catalog" aria-current={!current ? 'page' : undefined} className="min-h-[44px] rounded-control border border-border px-4 py-2 font-semibold">{ar ? 'كل الكورسات وإضافة كورس' : 'All courses & create course'}</a></div>
    <label className="mt-3 block text-sm" htmlFor="course-switcher-search">{ar ? 'ابحث للوصول إلى كورس' : 'Find a course workspace'}</label>
    <input id="course-switcher-search" value={query} maxLength={100} onChange={e => setQuery(e.target.value)} className={`${textInputClassName(false)} mt-2`} />
    {failed ? <Notice kind="error">{ar ? 'تعذر تحميل اختصارات الكورسات. استخدم قائمة الكورسات.' : 'Course shortcuts could not load. Use the course list.'}</Notice> : null}
    <PaginatedCollection id="course-shortcuts" resetKey={query} className="mt-3 flex flex-wrap gap-2">
      {filtered.map(c => <a key={c.id} href={`#/admin/courses/${c.workingCopyId ?? c.id}`} aria-current={c.id === current ? 'page' : undefined} className={`min-h-[44px] max-w-full break-words rounded-control border px-4 py-3 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus ${c.id === current ? 'border-primary bg-primary text-canvas' : 'border-border bg-elevated text-ink'}`}>{ar ? c.titleAr : c.titleEn}</a>)}
    </PaginatedCollection>
    {query && !filtered.length ? <p className="mt-3 text-sm text-muted">{ar ? 'لا توجد نتائج.' : 'No matching courses.'}</p> : null}
  </nav>;
}
