import { useEffect, useState } from 'react';
import { useLang } from '../../i18n';
import { assessmentApi, errorLabel } from './api';
import { Notice } from '../../components/ui/Notice';
export function LessonAssessments({ lessonId }: { lessonId: string }): JSX.Element {
  const { lang } = useLang(); const ar = lang === 'ar';
  const [items, setItems] = useState<Array<{ id: string; titleAr: string; titleEn: string; required: boolean; passed: boolean }>>([]); const [error, setError] = useState('');
  useEffect(() => { let active = true; void assessmentApi<{ assessments: typeof items }>(`/assessments/lessons/${lessonId}`).then((r) => { if (active) setItems(r.assessments); }).catch((e) => { if (active) setError(errorLabel(e, ar)); }); return () => { active = false; }; }, [lessonId, ar]);
  return <section className="mt-6 rounded-card border border-border bg-surface p-4"><h2 className="mb-3 text-xl font-semibold">{ar ? 'الواجبات والاختبارات' : 'Assignments and quizzes'}</h2>{error ? <Notice kind="error">{error}</Notice> : null}{!items.length && !error ? <p className="text-muted">{ar ? 'لا توجد تقييمات منشورة لهذا الدرس.' : 'No published assessments for this lesson.'}</p> : <ul className="space-y-3">{items.map((a) => <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-control border border-border p-3"><div><p className="font-semibold">{ar ? a.titleAr : a.titleEn}</p><p className="text-sm text-muted">{a.required ? ar ? 'مطلوب للمتابعة' : 'Required' : ar ? 'اختياري' : 'Optional'}{a.passed ? ar ? ' · تم الاجتياز' : ' · Passed' : ''}</p></div><a href={`#/assessment/${a.id}`} className="min-h-[44px] rounded-control bg-primary px-4 py-2 font-bold text-primary-ink">{ar ? 'حل التمرين' : 'Solve'}</a></li>)}</ul>}</section>;
}
