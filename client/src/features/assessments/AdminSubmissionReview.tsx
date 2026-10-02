import { useEffect, useState, useRef } from 'react';
import { useFocusedWorkspace } from '../../components/ui/useFocusedWorkspace';
import { useLang } from '../../i18n';
import { Button } from '../../components/ui/Button';
import { Loading, Notice } from '../../components/ui/Notice';
import { assessmentApi, errorLabel } from './api';

interface Summary {
  id: string; state: string; createdAt: string;
  student: { displayName: string; email: string | null };
  version: { version: number };
}
interface Page { submissions: Summary[]; nextCursor: string | null }
interface Detail extends Summary { answers: unknown; result: unknown }

/** Only bounded summaries are loaded for browsing. Source/result are fetched
 * for one explicitly selected submission and rendered as escaped text. */
export function AdminSubmissionReview({ assessmentId, title, onClose }: {
  assessmentId: string; title: string; onClose: () => void;
}): JSX.Element {
  const { lang } = useLang(); const ar = lang === 'ar';
  const label = (a: string, e: string): string => ar ? a : e;
  const [cursors, setCursors] = useState<Array<string | null>>([null]);
  const [page, setPage] = useState<Page | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState(''); const [result, setResult] = useState('');
  const shown = page?.submissions.filter(s => (!search || `${s.student.displayName} ${s.student.email ?? ''}`.toLowerCase().includes(search.toLowerCase())) && (!result || s.state === result)) ?? [];
  const cursor = cursors[cursors.length - 1];
  const workspace=useRef<HTMLElement>(null);useFocusedWorkspace(true,workspace,onClose);
  useEffect(() => {
    let active = true; setPage(null); setSelected(null); setDetail(null); setError('');
    void assessmentApi<Page>(`/admin/assessments/${assessmentId}/submissions?limit=10${cursor ? `&cursor=${cursor}` : ''}`)
      .then((data) => { if (active) setPage(data); })
      .catch((e: unknown) => { if (active) setError(errorLabel(e, ar)); });
    return () => { active = false; };
  }, [assessmentId, cursor, ar]);
  useEffect(() => {
    let active = true; setDetail(null);
    if (selected) {
      setError('');
      void assessmentApi<Detail>(`/admin/assessments/${assessmentId}/submissions/${selected}`)
        .then((data) => { if (active) setDetail(data); })
        .catch((e: unknown) => { if (active) setError(errorLabel(e, ar)); });
    }
    return () => { active = false; };
  }, [assessmentId, selected, ar]);
  const stateLabel = (state: string): string => state === 'CORRECT' ? label('صحيح', 'Correct') : state === 'INCORRECT' ? label('غير صحيح', 'Incorrect') : state === 'ERROR' ? label('تعذر التقييم', 'Checking failed') : label('جارٍ التقييم', 'Checking');
  return <section ref={workspace} data-testid="submission-review" className="admin-focused-workspace space-y-3" aria-label={label('مراجعة الحلول', 'Review submissions')}>
    <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-bold">{label('الحلول المرسلة', 'Submissions')}: {title}</h3><Button variant="secondary" onClick={onClose}>{label('إغلاق', 'Close')}</Button></div>
    {error ? <Notice kind="error">{error}</Notice> : null}
    {!page && !error ? <Loading text={label('تحميل…', 'Loading…')} /> : null}
    {page ? <>
      <div className="flex flex-wrap gap-3"><label>{label('ابحث في هذه الصفحة بالطالب','Find a student on this page')}<input value={search} onChange={e=>setSearch(e.target.value)} className="block rounded-control border border-border bg-surface p-2" /></label><label>{label('نتيجة في هذه الصفحة','Result on this page')}<select value={result} onChange={e=>setResult(e.target.value)} className="block rounded-control border border-border bg-surface p-2"><option value="">{label('كل النتائج','All results')}</option>{['CORRECT','INCORRECT','ERROR'].map(s=><option key={s} value={s}>{stateLabel(s)}</option>)}</select></label><Button variant="secondary" onClick={()=>{setSearch('');setResult('');}}>{label('مسح عوامل التصفية','Clear filters')}</Button></div>
      {page.submissions.length && !shown.length ? <p>{label('لا توجد نتائج مطابقة في هذه الصفحة. امسح التصفية أو انتقل لصفحة أخرى.','No matches on this page. Clear filters or try another page.')}</p> : null}
      {!page.submissions.length ? <p>{label('لا توجد حلول مرسلة بعد.', 'No submissions yet.')}</p> : <div className="overflow-x-auto"><table className="w-full text-start text-sm">
        <thead><tr>{[label('الطالب', 'Student'), label('التاريخ', 'Date'), label('النتيجة', 'Result'), label('النسخة', 'Revision'), label('التفاصيل', 'Details')].map((h) => <th key={h} scope="col" className="p-2 text-start">{h}</th>)}</tr></thead>
        <tbody>{shown.map((s) => <tr key={s.id} data-testid="submission-row" data-submission-id={s.id} className="border-t border-border"><td className="p-2"><p>{s.student.displayName}</p><p dir="ltr" className="text-xs text-muted">{s.student.email}</p></td><td className="p-2">{new Date(s.createdAt).toLocaleString(ar ? 'ar-EG' : 'en')}</td><td className="p-2">{stateLabel(s.state)}</td><td className="p-2">{s.version.version}</td><td className="p-2"><Button variant="secondary" aria-pressed={selected === s.id} onClick={() => setSelected(s.id)}>{label('عرض الحل', 'View answer')}</Button></td></tr>)}</tbody>
      </table></div>}
      <nav aria-label={label('صفحات الحلول', 'Submission pages')} className="flex items-center gap-3"><Button variant="secondary" disabled={cursors.length === 1} onClick={() => setCursors((old) => old.slice(0, -1))}>{label('السابق', 'Previous')}</Button><span>{label('صفحة', 'Page')} {cursors.length}</span><Button variant="secondary" disabled={!page.nextCursor} onClick={() => { if (page.nextCursor) setCursors((old) => [...old, page.nextCursor]); }}>{label('التالي', 'Next')}</Button></nav>
    </> : null}
    {selected ? <div data-testid="submission-detail" className="border-t border-border pt-3">
      {!detail && !error ? <Loading text={label('تحميل الحل…', 'Loading answer…')} /> : null}
      {detail ? <><div className="mb-2 flex flex-wrap items-center justify-between gap-2"><strong>{detail.student.displayName} · {stateLabel(detail.state)}</strong><Button variant="secondary" onClick={() => setSelected(null)}>{label('إغلاق الحل', 'Close answer')}</Button></div><div className="max-h-96 space-y-3 overflow-auto"><h4>{label('كود الطالب وإجاباته', 'Student code and answers')}</h4><pre dir="ltr" className="whitespace-pre-wrap break-words rounded-control bg-surface p-3 text-xs">{JSON.stringify(detail.answers, null, 2)}</pre><h4>{label('نتيجة التقييم', 'Grading result')}</h4><pre dir="ltr" className="whitespace-pre-wrap break-words rounded-control bg-surface p-3 text-xs">{JSON.stringify(detail.result, null, 2)}</pre></div></> : null}
    </div> : null}
  </section>;
}
