import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../auth';
import { useLang } from '../../i18n';
import { Container } from '../../components/ui/Card';
import { Notice, Loading } from '../../components/ui/Notice';
import { assessmentApi, errorLabel } from '../assessments/api';
import { WebIDE } from './WebIDE';
import { ModeTabs } from './ModeTabs';
import { IDE_MODES, emptySource, type IDEMode, type SourceFiles, type Quota } from './types';
import { useDraftSave } from '../assessments/useDraftSave';

export function PracticePage(): JSX.Element {
  const { status, user } = useAuth(); const { lang } = useLang(); const ar = lang === 'ar';
  const [mode, setMode] = useState<IDEMode>('javascript'); const [quota, setQuota] = useState<Quota | null>(null);
  useEffect(() => {
    if (!quota) return;
    const timer = setTimeout(() => { void assessmentApi<{ quota: Quota }>('/assessments/practice').then((data) => setQuota(data.quota)).catch(() => undefined); }, Math.min(2147483647, Math.max(0, new Date(quota.nextResetAt).getTime() - Date.now()) + 500));
    return () => clearTimeout(timer);
  }, [quota?.nextResetAt]);
  return <Container id="main"><main className="py-8"><h1 className="mb-3 text-3xl font-bold">{ar ? 'IDE' : 'IDE'}</h1>
    {status !== 'authenticated' || user?.role !== 'STUDENT' ? <Notice kind="error">{ar ? 'سجل الدخول بحساب طالب لديه اشتراك نشط.' : 'Sign in as a student with an active subscription.'} <a href="#/login">{ar ? 'تسجيل الدخول' : 'Sign in'}</a></Notice> : <>
      <ModeTabs value={mode} onChange={setMode} label={ar ? 'نوع المحرر' : 'IDE type'} />
      <p className="mb-3 text-muted">{ar ? 'الحصة مشتركة بين المحررات الثلاثة. لكل محرر مسودته الخاصة؛ الواجبات والاختبارات خارج حصة التدريب.' : 'All three IDEs share your allowance. Each has its own draft; assignment and quiz Runs are exempt.'}</p>
      {quota ? <div className="mb-4 flex flex-wrap justify-between gap-2 rounded-card border border-border bg-surface p-4"><p>{ar ? 'التشغيل المتبقي' : 'Runs remaining'}: <strong>{quota.remaining}/{quota.limit}</strong></p><p>{ar ? 'التجديد القادم' : 'Next reset'}: {new Intl.DateTimeFormat(ar ? 'ar-EG' : 'en', { timeZone: 'Africa/Cairo', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(quota.nextResetAt))}</p></div> : null}
      {IDE_MODES.map((kind) => <div key={kind} role="tabpanel" hidden={mode !== kind} aria-label={kind}><PracticeWorkspace mode={kind} quota={quota} onQuota={setQuota} /></div>)}
    </>}
  </main></Container>;
}
function PracticeWorkspace({ mode, quota, onQuota }: { mode: IDEMode; quota: Quota | null; onQuota: (q: Quota) => void }): JSX.Element {
  const { lang } = useLang(); const ar = lang === 'ar';
  const [source, setSource] = useState<SourceFiles>(() => emptySource(mode)); const [loaded, setLoaded] = useState(false); const [error, setError] = useState('');
  const [dirty, setDirty] = useState(false); const revision = useRef(0);
  const saveState = useDraftSave({ value: source, dirty, enabled: loaded, endpoint: `/assessments/practice/draft?mode=${mode}`, revision, ar, clearDirty: () => setDirty(false) });
  useEffect(() => {
    let active = true;
    void assessmentApi<{ quota: Quota; draft: { content: SourceFiles; revision: number } | null }>(`/assessments/practice?mode=${mode}`).then((data) => {
      if (!active) return; onQuota(data.quota); if (data.draft) { setSource(data.draft.content); revision.current = data.draft.revision; } setLoaded(true);
    }).catch((e) => { if (active) setError(errorLabel(e, ar)); });
    return () => { active = false; };
  }, [mode]);
  async function beforeRun(): Promise<void> {
    try { onQuota(await assessmentApi<Quota>('/assessments/practice/run', 'POST', { idempotencyKey: crypto.randomUUID() })); setError(''); }
    catch (e) { const message = errorLabel(e, ar); setError(message); throw new Error(message); }
  }
  return <>{error ? <Notice kind="error">{error}</Notice> : null}{loaded ? <><WebIDE mode={mode} value={source} onChange={(s) => { setSource(s); setDirty(true); }} beforeRun={beforeRun} onPythonQuota={onQuota} disabled={!!quota && quota.remaining === 0 && Date.now() < new Date(quota.nextResetAt).getTime()} disabledReason={ar ? 'استهلكت حصة التدريب. انتظر التجديد أو تواصل مع الإدارة.' : 'Practice allowance exhausted. Wait for reset or contact ADMIN.'} /><p className="mt-2 text-sm text-muted" aria-live="polite">{saveState}</p></> : !error ? <Loading text={ar ? 'جارٍ التحميل…' : 'Loading…'} /> : null}</>;
}
