import { useEffect, useState, type FormEvent } from 'react';
import { ApiError, apiFetch } from '../../../auth';
import { useLang } from '../../../i18n';
import { Button } from '../../../components/ui/Button';
import { FormActions } from '../../../components/ui/FormActions';
import { Notice } from '../../../components/ui/Notice';
import { textInputClassName } from '../../../components/ui/Field';
import { useUnsavedChanges } from '../../../components/ui/UnsavedChanges';

interface Settings {
  qrUrl?: string | null;
  enabled: boolean;
  accountLabel: string;
  instructionsAr: string;
  instructionsEn: string;
  version: number;
}
export function InstaPaySettings({ method = 'instapay', expanded = false }: { method?: 'instapay' | 'vodafone-cash'; expanded?: boolean }): JSX.Element {
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
  const [qrFile, setQrFile] = useState<File | null>(null);
  const [qrMessage, setQrMessage] = useState('');
  const dirty = !!saved && JSON.stringify(draft) !== JSON.stringify(saved);
  const confirmLeave = useUnsavedChanges(
    dirty || !!qrFile,
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
      setQrFile(null); setQrMessage('');
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
        body: { enabled: draft.enabled, accountLabel: draft.accountLabel, instructionsAr: draft.instructionsAr, instructionsEn: draft.instructionsEn, version: draft.version },
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
  async function changeQr(remove = false) {
    if (busy || !draft || dirty || draft.version === 0 || (!remove && !qrFile)) return;
    setBusy(true); setQrMessage(''); setError('');
    try {
      const base64 = !remove && qrFile ? await new Promise<string>((resolve, reject) => {
        const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1] ?? ''); reader.onerror = () => reject(new Error('read')); reader.readAsDataURL(qrFile);
      }) : undefined;
      const result = await apiFetch<{ data: Settings }>('/admin/payment-settings/instapay/qr', { method: remove ? 'DELETE' : 'POST', retryOnAuth: true,
        body: remove ? { version: draft.version } : { version: draft.version, filename: qrFile!.name, mime: qrFile!.type, base64 } });
      setSaved(result.data); setDraft(result.data); setQrFile(null); setQrMessage(remove ? 'removed' : 'saved');
    } catch (e) { setError(e instanceof ApiError && e.code === 'OFFER_CHANGED' ? 'conflict' : 'save'); }
    finally { setBusy(false); }
  }
  const Wrapper = expanded ? 'div' : 'details';
  return (
    <Wrapper
      className="my-6 rounded-card border border-border bg-surface p-4"
      data-testid={`${method}-settings`}
    >
      {!expanded ? <summary className="cursor-pointer font-bold">
        {label('إعدادات استقبال InstaPay', 'InstaPay receiving settings')}
      </summary> : null}
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
      {method === 'instapay' && draft ? <section className="mt-6 rounded-control border border-border p-4" aria-labelledby="instapay-qr-heading" data-testid="instapay-qr-settings">
        <h3 id="instapay-qr-heading" className="font-bold">{label('صورة QR لحساب InstaPay', 'InstaPay account QR image')}</h3>
        <p className="my-3 text-sm text-muted">{label('ارفع صورة PNG أو JPEG حتى 128 كيلوبايت. تحقق أن الرمز يخص حساب الاستلام؛ يظهر للطلاب بعد رفعه. احفظ أي تعديلات على بيانات الحساب أولًا.', 'Upload a PNG or JPEG up to 128 KiB. Verify the QR belongs to the receiving account; students see it after upload. Save receiving-detail edits first.')}</p>
        {draft.qrUrl?.startsWith('/api/admin/payment-settings/instapay/qr?') ? <img src={draft.qrUrl} alt={label('معاينة QR لحساب InstaPay', 'InstaPay QR preview')} className="mx-auto mb-4 h-auto max-h-64 max-w-full bg-white object-contain" data-testid="admin-instapay-qr" /> : null}
        <label className="block" htmlFor="instapay-qr-file">{label('اختيار صورة QR', 'Choose QR image')}</label>
        <input key={draft.version} id="instapay-qr-file" type="file" accept="image/png,image/jpeg" disabled={busy} className="my-3 max-w-full" onChange={e => {
          const file = e.target.files?.[0]; setQrMessage('');
          if (file && (!['image/png', 'image/jpeg'].includes(file.type) || file.size > 128 * 1024 || file.size === 0)) { setQrFile(null); e.target.value = ''; setQrMessage('invalid'); } else setQrFile(file ?? null);
        }} />
        {qrFile ? <p className="text-sm text-muted">{qrFile.name}</p> : null}
        {dirty || draft.version === 0 ? <p className="text-sm text-muted">{label('احفظ بيانات الحساب قبل رفع أو حذف صورة QR.', 'Save receiving details before uploading or removing the QR image.')}</p> : null}
        <FormActions><Button disabled={busy || dirty || draft.version === 0 || !qrFile} onClick={() => void changeQr()} data-testid="upload-instapay-qr">{label('رفع / استبدال صورة QR', 'Upload / replace QR image')}</Button>
        {draft.qrUrl ? <Button variant="secondary" disabled={busy || dirty} onClick={() => { if (window.confirm(label('حذف صورة QR فقط؟ ستبقى بيانات الحساب كما هي.', 'Remove only the QR image? Receiving details will remain.'))) void changeQr(true); }} data-testid="remove-instapay-qr">{label('حذف صورة QR', 'Remove QR image')}</Button> : null}</FormActions>
        {qrMessage ? <p role="status" className="mt-3 text-sm">{qrMessage === 'invalid' ? label('اختر صورة PNG أو JPEG صالحة حتى 128 كيلوبايت.', 'Choose a valid PNG or JPEG up to 128 KiB.') : qrMessage === 'removed' ? label('تم حذف صورة QR.', 'QR image removed.') : label('تم حفظ صورة QR.', 'QR image saved.')}</p> : null}
      </section> : null}
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
    </Wrapper>
  );
}
