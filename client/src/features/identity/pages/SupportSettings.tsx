import { useEffect, useState, type FormEvent } from 'react';
import { ApiError, apiFetch, useAuth } from '../../../auth';
import { useLang } from '../../../i18n';
import { Button } from '../../../components/ui/Button';
import { FormActions } from '../../../components/ui/FormActions';
import { Container } from '../../../components/ui/Card';
import { Loading, Notice } from '../../../components/ui/Notice';
import { textInputClassName } from '../../../components/ui/Field';
import { useUnsavedChanges } from '../../../components/ui/UnsavedChanges';

export interface PublicContact { email: string; phone: string; version: number }
export function SupportSettings(): JSX.Element {
  const { user, status } = useAuth(); const { lang } = useLang(); const ar = lang === 'ar';
  const label = (a: string, e: string): string => ar ? a : e;
  const [contact, setContact] = useState<PublicContact | null>(null);
  const [email, setEmail] = useState(''); const [phone, setPhone] = useState('');
  const [error, setError] = useState(''); const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false); const [loading, setLoading] = useState(true); const [retry, setRetry] = useState(0);
  const confirmLeave = useUnsavedChanges(!!contact && (email !== contact.email || phone !== contact.phone), label('بيانات الدعم غير محفوظة. هل تريد ترك التعديل؟', 'Support changes are unsaved. Discard this edit?'));
  useEffect(() => {
    if (user?.role !== 'ADMIN') return;
    let active = true; setLoading(true); setError('');
    void apiFetch<{data: {contact: PublicContact | null}}>('/support/contact').then(r => {
      if (!active) return;
      if (!r.data.contact) throw new Error('Missing contact');
      setContact(r.data.contact); setEmail(r.data.contact.email); setPhone(r.data.contact.phone);
    }).catch(() => { if (active) setError('load'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user?.role, retry]);
  async function save(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault(); if (busy || !contact || !event.currentTarget.reportValidity()) return;
    setBusy(true); setError(''); setSaved(false);
    try {
      const result = await apiFetch<{data: {contact: PublicContact}}>('/support/contact', {method: 'PUT', body: {email, phone, version: contact.version}});
      setContact(result.data.contact); setEmail(result.data.contact.email); setPhone(result.data.contact.phone); setSaved(true);
    } catch (e) { setError(e instanceof ApiError && e.code === 'OFFER_CHANGED' ? 'conflict' : 'save'); }
    finally { setBusy(false); }
  }
  return <Container><main id="main" className="mx-auto max-w-2xl py-10 space-y-4">
    <h1 className="text-3xl font-bold">{label('بيانات تواصل الدعم', 'Support contact settings')}</h1>
    {status === 'loading' ? <Loading text={label('تحميل…', 'Loading…')} /> : user?.role !== 'ADMIN' ? <Notice kind="error">{label('للإدارة فقط', 'ADMIN only')}</Notice> : <>
      <p>{label('تظهر هذه البيانات للجميع في صفحة المساعدة. يمكنك تغييرها هنا دون إعادة بناء الموقع.', 'These details appear publicly on the help page. Change them here without rebuilding the website.')}</p>
      {error ? <Notice kind="error">{error === 'conflict' ? label('عدّل مسؤول آخر البيانات. أعد تحميلها قبل الحفظ.', 'Another admin changed these details. Reload before saving.') : error === 'load' ? label('تعذر تحميل بيانات الدعم. أعد المحاولة.', 'Could not load support details. Please retry.') : label('تعذر الحفظ. تحقق من البريد ورقم الهاتف وحاول مجددًا.', 'Could not save. Check the email and phone number and retry.')}</Notice> : null}
      {saved ? <Notice kind="success">{label('تم حفظ بيانات الدعم.', 'Support details saved.')}</Notice> : null}
      {loading ? <Loading text={label('تحميل…', 'Loading…')} /> : contact ? <form onSubmit={e => void save(e)} data-testid="support-settings"><fieldset disabled={busy} className="space-y-4">
        <label className="block">{label('بريد الدعم', 'Support email')}<input id="support-email" type="email" required maxLength={254} dir="ltr" value={email} onChange={e => {setEmail(e.target.value); setSaved(false);}} className={textInputClassName(false)} /></label>
        <label className="block">{label('رقم هاتف الدعم', 'Support phone')}<input id="support-phone" type="tel" required maxLength={40} dir="ltr" value={phone} onChange={e => {setPhone(e.target.value); setSaved(false);}} className={textInputClassName(false)} /></label>
        <p className="text-sm text-muted">{label('يُقبل الرقم المصري بصيغته المحلية أو مع كود الدولة.', 'Egyptian numbers accept local or international format.')}</p>
        <FormActions><Button type="submit" disabled={busy}>{label('حفظ بيانات الدعم', 'Save support details')}</Button></FormActions>
      </fieldset></form> : null}
      <FormActions><Button variant="secondary" disabled={busy || loading} onClick={() => {if (confirmLeave()) {setSaved(false); setRetry(n => n + 1);}}}>{label('إعادة تحميل البيانات', 'Reload details')}</Button></FormActions>
      <a href="#/support" className="block underline">{label('عرض صفحة المساعدة', 'View help page')}</a>
    </>}
  </main></Container>;
}
