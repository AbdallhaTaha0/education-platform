import { useEffect, useState } from 'react';
import { useAuth } from '../../auth';
import { useLang } from '../../i18n';
import { Container } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { FormActions } from '../../components/ui/FormActions';
import { Notice } from '../../components/ui/Notice';
import { textInputClassName } from '../../components/ui/Field';
import { assessmentApi, errorLabel } from './api';
import type { Quota } from '../ide/types';
export function AdminQuotaPage(): JSX.Element {
  const { user } = useAuth(); const { lang } = useLang(); const ar = lang === 'ar'; const label = (a: string, e: string): string => ar ? a : e;
  const [success,setSuccess]=useState(''); const [selectedName,setSelectedName]=useState('');
  const [search, setSearch] = useState(''); const [students, setStudents] = useState<Array<{ id: string; displayName: string; email: string }>>([]); const [selected, setSelected] = useState(''); const [quota, setQuota] = useState<Quota | null>(null); const [limit, setLimit] = useState('50'); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => { if (user?.role !== 'ADMIN') return; let active = true; const timer = setTimeout(() => { void assessmentApi<{ students: typeof students }>(`/admin/assessments/students?q=${encodeURIComponent(search)}`).then((r) => { if (active) setStudents(r.students); }).catch((e) => { if (active) setError(errorLabel(e, ar)); }); }, 250); return () => { active = false; clearTimeout(timer); }; }, [search, user?.role, ar]);
  useEffect(() => { if (!selected) return; let active = true; setQuota(null); void assessmentApi<Quota>(`/admin/assessments/students/${selected}/quota`).then((q) => { if (active) { setQuota(q); setLimit(String(q.limit)); } }).catch((e) => { if (active) setError(errorLabel(e, ar)); }); return () => { active = false; }; }, [selected, ar]);
  async function adjust(action: 'LIMIT' | 'RESET', amount: number | null): Promise<void> {
    if (busy) return; setBusy(true); setError(''); setSuccess('');
    try { const current = await assessmentApi<Quota>(`/admin/assessments/students/${selected}/quota`, 'POST', { action, limit: amount, idempotencyKey: crypto.randomUUID() }); setQuota(current); setLimit(String(current.limit)); setSuccess(action==='RESET'?label('تم تجديد الرصيد. يبدأ الآن موعد متكرر كل ٢٤ ساعة.','Allowance reset. Recurring 24-hour windows start now.'):amount===null?label('تمت استعادة الحد الافتراضي ٥٠.','Default limit of 50 restored.'):label('تم حفظ حد الطالب.','Student limit saved.')); }
    catch (e) { setError(errorLabel(e, ar)); } finally { setBusy(false); }
  }
  return <Container id="main"><main className="py-8"><h1 className="mb-4 text-3xl font-bold">{label('إدارة رصيد التدريب', 'Practice allowances')}</h1>{user?.role !== 'ADMIN' ? <Notice kind="error">{label('للإدارة فقط', 'ADMIN only')}</Notice> : <>
    {error ? <Notice kind="error">{error}</Notice> : null}{success?<Notice kind="success">{success}</Notice>:null}<label htmlFor="student-search">{label('ابحث عن طالب', 'Find a student')}</label><input id="student-search" className={`${textInputClassName(false)} mt-2 mb-4`} value={search} onChange={(e) => setSearch(e.target.value)} />
    <div className="grid gap-5 md:grid-cols-2"><ul className="space-y-2">{students.map((s) => <li key={s.id}><button className={`min-h-[44px] w-full rounded-control border p-3 text-start ${selected === s.id ? 'border-primary bg-elevated' : 'border-border bg-surface'}`} disabled={busy} onClick={() => {setSelected(s.id);setSelectedName(s.displayName+' · '+s.email);setSuccess('');}}>{s.displayName} <span dir="ltr" className="text-sm text-muted">{s.email}</span></button></li>)}</ul>
    {quota ? <section className="rounded-card border border-border bg-surface p-4"><h2 className="mb-3 break-words font-bold">{selectedName}</h2><p className="mb-3">{label('المتبقي', 'Remaining')}: {quota.remaining}/{quota.limit}</p><p className="mb-3">{label('موعد التجديد', 'Reset time')}: {new Date(quota.nextResetAt).toLocaleString(ar ? 'ar-EG' : 'en', { timeZone: 'Africa/Cairo' })}</p><label htmlFor="quota-limit">{label('الرصيد اليومي لهذا الطالب', 'This student’s daily allowance')}</label><input id="quota-limit" type="number" min="0" max="2147483647" className={`${textInputClassName(false)} my-3`} value={limit} onChange={(e) => setLimit(e.target.value)} /><FormActions className="mt-3"><Button disabled={busy || !limit.trim() || !Number.isSafeInteger(Number(limit)) || Number(limit)<0 || Number(limit)>2147483647} onClick={() => void adjust('LIMIT', Number(limit))}>{label('حفظ الرصيد', 'Save limit')}</Button><Button variant="secondary" disabled={busy} onClick={() => void adjust('LIMIT', null)}>{label('استعادة الافتراضي (50)', 'Restore default (50)')}</Button><Button variant="secondary" disabled={busy} onClick={() => void adjust('RESET', null)}>{label('تجديد الرصيد الآن', 'Reset allowance now')}</Button></FormActions><p className="mt-3 text-sm text-muted">{label('التجديد اليدوي يبدأ فترات متكررة كل 24 ساعة. لا يغير اشتراك الطالب.', 'A manual reset starts recurring 24-hour windows. It does not change the student’s subscription.')}</p></section> : null}</div>
    </>}</main></Container>;
}
