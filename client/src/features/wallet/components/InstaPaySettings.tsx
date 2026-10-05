import { useEffect, useState, type FormEvent } from 'react';
import { ApiError, apiFetch } from '../../../auth';
import { useLang } from '../../../i18n';
import { Button } from '../../../components/ui/Button';
import { FormActions } from '../../../components/ui/FormActions';
import { Notice } from '../../../components/ui/Notice';
import { textInputClassName } from '../../../components/ui/Field';
import { useUnsavedChanges } from '../../../components/ui/UnsavedChanges';

interface Settings {
  enabled: boolean;
  accountLabel: string;
  instructionsAr: string;
  instructionsEn: string;
  version: number;
}
export function InstaPaySettings({ method = 'instapay' }: { method?: 'instapay' | 'vodafone-cash' }): JSX.Element {
  const brand = method === 'instapay' ? 'InstaPay' : 'Vodafone Cash';
  const brandAr = method === 'instapay' ? 'InstaPay' : 'فودافون كاش';
  const { lang } = useLang();
  const ar = lang === 'ar';
  const label = (a: string, e: string) => (ar ? a.replace(/InstaPay/g, brandAr) : e.replace(/InstaPay/g, brand));
  const [saved, setSaved] = useState<Settings | null>(null);
  const [draft, setDraft] = useState<Settings | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const confirmLeave = useUnsavedChanges(
    !!saved && JSON.stringify(draft) !== JSON.stringify(saved),
    label(
      'بيانات InstaPay غير محفوظة. هل تريد ترك التعديل؟',
      'InstaPay changes are unsaved. Discard this edit?',
    ),
  );
  async function load() {
    setBusy(true);
    setError('');
    setDone(false);
    try {
      const r = await apiFetch<{ data: Settings }>(`/admin/payment-settings/${method}`);
      setSaved(r.data);
      setDraft(r.data);
    } catch {
      setError('load');
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !draft || !event.currentTarget.reportValidity()) return;
    setBusy(true);
    setError('');
    setDone(false);
    try {
      const r = await apiFetch<{ data: Settings }>(`/admin/payment-settings/${method}`, {
        method: 'PUT',
        retryOnAuth: true,
        body: { ...draft },
      });
      setSaved(r.data);
      setDraft(r.data);
      setDone(true);
    } catch (e) {
      setError(e instanceof ApiError && e.code === 'OFFER_CHANGED' ? 'conflict' : 'save');
    } finally {
      setBusy(false);
    }
  }
  function edit<K extends keyof Settings>(key: K, value: Settings[K]) {
    setDraft((d) => (d ? { ...d, [key]: value } : d));
    setDone(false);
  }
  return (
    <details
      className="my-6 rounded-card border border-border bg-surface p-4"
      data-testid={`${method}-settings`}
    >
      <summary className="cursor-pointer font-bold">
        {label('إعدادات استقبال InstaPay', 'InstaPay receiving settings')}
      </summary>
      <p className="my-3 text-sm text-muted">
        {label(
          'تظهر للطلاب فور الحفظ. الشحن يدوي؛ راجع التحويل وإثبات الدفع قبل اعتماد الرصيد.',
          'Students see saved details immediately. Recharge is manual; verify the transfer and receipt before approving credit.',
        )}
      </p>
      {error ? (
        <Notice kind="error">
          {error === 'conflict'
            ? label(
                'غيّر مسؤول آخر البيانات. أعد تحميلها قبل الحفظ.',
                'Another admin changed the details. Reload before saving.',
              )
            : label(
                'تعذر تحميل أو حفظ البيانات. تحقق منها وأعد المحاولة.',
                'Could not load or save the details. Check them and retry.',
              )}
        </Notice>
      ) : null}
      {done ? (
        <Notice kind="success">
          {label('تم حفظ بيانات InstaPay.', 'InstaPay details saved.')}
        </Notice>
      ) : null}
      {draft ? (
        <form onSubmit={(e) => void submit(e)}>
          <fieldset disabled={busy} className="space-y-3">
            <label className="flex items-center gap-2">
              <input
                id={`${method}-enabled`}
                type="checkbox"
                checked={draft.enabled}
                onChange={(e) => edit('enabled', e.target.checked)}
              />
              {label('إتاحة الشحن عبر InstaPay', 'Enable InstaPay recharge')}
            </label>
            <label className="block" htmlFor={`${method}-account`}>
              {label('رقم أو عنوان استقبال InstaPay', 'InstaPay receiving phone or address')}
              <input
                id={`${method}-account`}
                dir="ltr"
                required={draft.enabled}
                maxLength={200}
                value={draft.accountLabel}
                onChange={(e) => edit('accountLabel', e.target.value)}
                className={textInputClassName(false)}
              />
            </label>
            <label className="block" htmlFor={`${method}-ar`}>
              {label(
                'اسم المستلم وتعليمات التحويل بالعربية',
                'Recipient and transfer instructions in Arabic',
              )}
              <textarea
                id={`${method}-ar`}
                dir="rtl"
                required={draft.enabled}
                maxLength={2000}
                value={draft.instructionsAr}
                onChange={(e) => edit('instructionsAr', e.target.value)}
                className={textInputClassName(false)}
              />
            </label>
            <label className="block" htmlFor={`${method}-en`}>
              {label(
                'اسم المستلم وتعليمات التحويل بالإنجليزية',
                'Recipient and transfer instructions in English',
              )}
              <textarea
                id={`${method}-en`}
                dir="ltr"
                required={draft.enabled}
                maxLength={2000}
                value={draft.instructionsEn}
                onChange={(e) => edit('instructionsEn', e.target.value)}
                className={textInputClassName(false)}
              />
            </label>
            <FormActions>
              <Button type="submit" disabled={busy}>
                {label('حفظ بيانات InstaPay', 'Save InstaPay details')}
              </Button>
            </FormActions>
          </fieldset>
        </form>
      ) : null}
      <FormActions>
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() => {
            if (confirmLeave()) void load();
          }}
        >
          {label('إعادة تحميل البيانات', 'Reload details')}
        </Button>
      </FormActions>
    </details>
  );
}
