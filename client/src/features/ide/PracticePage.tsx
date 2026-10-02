import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../auth';
import { useLang } from '../../i18n';
import { Container } from '../../components/ui/Card';
import { Notice, Loading } from '../../components/ui/Notice';
import { assessmentApi, errorLabel } from '../assessments/api';
import { WebIDE } from './WebIDE';
import { EMPTY_SOURCE, type SourceFiles, type Quota } from './types';
import { useDraftSave } from '../assessments/useDraftSave';

export function PracticePage(): JSX.Element {
  const { status, user } = useAuth(); const { lang } = useLang(); const ar = lang === 'ar';
  const label = (a: string, e: string): string => ar ? a : e;
  const [source, setSource] = useState<SourceFiles>(EMPTY_SOURCE); const [quota, setQuota] = useState<Quota | null>(null);
  const [error, setError] = useState(''); const revision = useRef(0);
  const [dirty, setDirty] = useState(false);
  const saveState = useDraftSave({ value: source, dirty, enabled: !!quota, endpoint: '/assessments/practice/draft', revision, ar, clearDirty: () => setDirty(false) });
  useEffect(() => {
    if (status !== 'authenticated' || user?.role !== 'STUDENT') return;
    let active = true;
    void assessmentApi<{ quota: Quota; draft: { content: SourceFiles; revision: number } | null }>('/assessments/practice').then((data) => {
      if (!active) return; setQuota(data.quota); setDirty(false); if (data.draft) { setSource(data.draft.content); revision.current = data.draft.revision; } setError('');
    }).catch((e) => { if (active) setError(errorLabel(e, ar)); });
    return () => { active = false; };
  }, [status, user?.id]);
  useEffect(() => {
    if (!quota) return;
    const delay = Math.max(0, new Date(quota.nextResetAt).getTime() - Date.now());
    // Long anchored periods exceed the browser timer ceiling. A bounded timer
    // also makes the Run control usable at rollover without reloading a draft.
    const timer = setTimeout(() => { setQuota((old) => old ? { ...old } : old); void assessmentApi<{ quota: Quota }>('/assessments/practice').then((data) => setQuota(data.quota)).catch(() => undefined); }, Math.min(2147483647, delay + 500));
    return () => clearTimeout(timer);
  }, [quota?.nextResetAt]);
  async function beforeRun(): Promise<void> {
    try { const q = await assessmentApi<Quota>('/assessments/practice/run', 'POST', { idempotencyKey: crypto.randomUUID() }); setQuota(q); setError(''); }
    catch (e) { const message = errorLabel(e, ar); setError(message); throw new Error(message); }
  }
  return <Container id="main"><main className="py-8"><h1 className="mb-3 text-3xl font-bold">{label('مختبر البرمجة', 'Practice IDE')}</h1>
    <details className="mb-4 rounded-control border border-border p-3"><summary className="cursor-pointer font-bold">{label('ابدأ بمثال JavaScript','Start with a JavaScript example')}</summary><p className="my-3 text-muted">{label('انسخ المثال إلى المحرر ثم اضغط تشغيل. كل تشغيل مقبول يُحسب حتى عند وجود خطأ بالكود. التنسيق وإعادة الكود لا يُحسبان؛ الواجبات والاختبارات معفاة.','Copy this example into the editor and press Run. Each accepted Run counts, including code errors. Formatting/reset do not count; assignments and quizzes are exempt.')}</p><pre dir="ltr" className="overflow-auto rounded-control bg-surface p-3">{'const numbers = [2, 3, 4];\nconsole.log(numbers.map(n => n * n));'}</pre></details>
    {status !== 'authenticated' || user?.role !== 'STUDENT' ? <Notice kind="error">{label('سجل الدخول بحساب طالب لديه اشتراك نشط.', 'Sign in as a student with an active subscription.')} <a href="#/login">{label('تسجيل الدخول', 'Sign in')}</a></Notice> : <>
      {error ? <Notice kind="error">{error}</Notice> : null}
      {quota ? <><div className="mb-4 flex flex-wrap justify-between gap-2 rounded-card border border-border bg-surface p-4"><p>{label('التشغيل المتبقي', 'Runs remaining')}: <strong>{quota.remaining}/{quota.limit}</strong></p><p>{label('التجديد القادم', 'Next reset')}: {new Intl.DateTimeFormat(ar ? 'ar-EG' : 'en', { timeZone: 'Africa/Cairo', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(quota.nextResetAt))} ({label('القاهرة', 'Cairo')})</p></div><WebIDE value={source} onChange={(s) => { setSource(s); setDirty(true); }} beforeRun={beforeRun} disabled={quota.remaining === 0 && Date.now() < new Date(quota.nextResetAt).getTime()} /><p className="mt-2 text-sm text-muted" aria-live="polite">{saveState}</p></> : !error ? <Loading text={label('جارٍ التحميل…', 'Loading…')} /> : null}
    </>}
  </main></Container>;
}
