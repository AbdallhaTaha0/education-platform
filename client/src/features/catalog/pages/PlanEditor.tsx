import { useState, type FormEvent } from 'react';
import { ApiError } from '../../../auth';
import { localizeCode, useLang } from '../../../i18n';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { Field, textInputClassName } from '../../../components/ui/Field';
import { Notice } from '../../../components/ui/Notice';
import { PriceDisplay } from '../components/PriceDisplay';
import { createPlan, patchPlan, removePlan } from '../api/client';
import type { AdminPlan } from '../types/models';
import { AccessFields, type AccessDraft } from '../../academic/AccessFields';
import { cairoDeadlineInput, cairoWallTime, moneyInput } from '../../academic/model';
const initialAccess: AccessDraft = { mode: 'DURATION', duration: '90', deadline: '' };
export function PlanEditor({
  courseId,
  plans,
  onChanged,
}: {
  courseId: string;
  plans: AdminPlan[];
  onChanged: () => Promise<void>;
}): JSX.Element {
  const { t, lang } = useLang();
  const ar = lang === 'ar';
  const [editing, setEditing] = useState<string | null>(null);
  const [current, setCurrent] = useState('');
  const [previous, setPrevious] = useState('');
  const [access, setAccess] = useState<AccessDraft>(initialAccess);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  function reset() {
    setEditing(null);
    setCurrent('');
    setPrevious('');
    setAccess(initialAccess);
  }
  function edit(plan: AdminPlan) {
    setEditing(plan.id);
    setCurrent((plan.currentPricePiastres / 100).toFixed(2));
    setPrevious(
      plan.previousPricePiastres === null ? '' : (plan.previousPricePiastres / 100).toFixed(2),
    );
    setAccess({
      mode: plan.accessMode ?? 'DURATION',
      duration: String(plan.durationDays ?? ''),
      deadline: plan.accessEndsAt ? cairoWallTime(plan.accessEndsAt) : '',
    });
    setError(null);
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const body = {
        currentPricePiastres: moneyInput(current),
        previousPricePiastres: previous === '' ? null : moneyInput(previous),
        accessMode: access.mode,
        durationDays: access.mode === 'DURATION' ? Number(access.duration) : null,
        accessEndsAt: ['DURATION', 'UNTIL_REMOVAL'].includes(access.mode)
          ? null
          : cairoDeadlineInput(access.deadline),
      };
      if (editing) await patchPlan(editing, body);
      else await createPlan(courseId, body);
      await onChanged();
      reset();
    } catch (err) {
      setError(err instanceof ApiError ? err.code : 'VALIDATION_ERROR');
    } finally {
      setBusy(false);
    }
  }
  async function remove(id: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await removePlan(id);
      await onChanged();
      if (editing === id) reset();
    } catch (err) {
      setError(err instanceof ApiError ? err.code : 'SERVICE_ERROR');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card className="mt-4">
      <h2 className="text-xl font-bold">{ar ? 'السعر وشروط الوصول' : 'Price and access terms'}</h2>
      <p className="mt-2 text-sm text-muted">
        {ar
          ? 'شروط الوصول تُحفظ وقت الشراء. التعديلات التالية لا تغيّر اشتراكات الطلاب السابقة.'
          : 'Access terms are saved at purchase. Later edits do not change existing purchased access.'}
      </p>
      {error ? <Notice kind="error">{localizeCode(t, error)}</Notice> : null}
      <ul className="mt-4 space-y-3">
        {plans.map((plan) => (
          <li key={plan.id} className="flex flex-wrap items-center gap-3">
            <PriceDisplay
              current={plan.currentPricePiastres}
              previous={plan.previousPricePiastres}
              durationDays={plan.durationDays}
              accessEndsAt={plan.accessEndsAt}
              accessMode={plan.accessMode}
            />
            <Button variant="secondary" disabled={busy} onClick={() => edit(plan)}>
              {t.actionEdit}
            </Button>
            <Button variant="secondary" disabled={busy} onClick={() => void remove(plan.id)}>
              {t.actionRemove}
            </Button>
          </li>
        ))}
      </ul>
      <form onSubmit={(event) => void submit(event)} className="mt-6 space-y-4">
        <h3 className="font-bold">{editing ? t.actionEdit : t.actionAddPlan}</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field id="plan-current" label={t.fieldCurrentPrice}>
            <input
              id="plan-current"
              dir="ltr"
              required
              inputMode="decimal"
              className={textInputClassName(false)}
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
            />
          </Field>
          <Field
            id="plan-previous"
            label={`${t.fieldPreviousPrice} (${ar ? 'اختياري' : 'optional'})`}
          >
            <input
              id="plan-previous"
              dir="ltr"
              inputMode="decimal"
              className={textInputClassName(false)}
              value={previous}
              onChange={(e) => setPrevious(e.target.value)}
            />
          </Field>
        </div>
        <AccessFields value={access} onChange={setAccess} prefix="plan" />
        <div className="flex flex-wrap gap-3">
          <Button disabled={busy} type="submit">
            {editing ? t.submitSave : t.actionAddPlan}
          </Button>
          {editing ? (
            <Button disabled={busy} variant="secondary" onClick={reset}>
              {t.actionCancel}
            </Button>
          ) : null}
        </div>
      </form>
    </Card>
  );
}
