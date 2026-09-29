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

function toEgpInput(piastres: number): string {
  return (piastres / 100).toFixed(2);
}

function fromEgpInput(value: string): number {
  return Math.round(Number(value) * 100);
}

export function PlanEditor({ courseId, plans, onChanged }: { courseId: string; plans: AdminPlan[]; onChanged: () => Promise<void> }): JSX.Element {
  const { t, lang } = useLang();
  const [current, setCurrent] = useState('600.00');
  const [previousEnabled, setPreviousEnabled] = useState(false);
  const [previous, setPrevious] = useState('');
  const [duration, setDuration] = useState('90');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent): Promise<void> {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const currentPiastres = fromEgpInput(current);
      const previousPiastres = previousEnabled && previous !== '' ? fromEgpInput(previous) : null;
      if (previousPiastres !== null && !(previousPiastres > currentPiastres)) {
        setError('VALIDATION_ERROR');
        return;
      }
      await createPlan(courseId, { currentPricePiastres: currentPiastres, previousPricePiastres: previousPiastres, durationDays: Number(duration) });
      await onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.code : 'SERVICE_ERROR');
    } finally {
      setBusy(false);
    }
  }

  async function saveInline(plan: AdminPlan, patch: { current: string; previous: string | null; duration: string }): Promise<void> {
    setError(null);
    try {
      await patchPlan(plan.id, {
        currentPricePiastres: fromEgpInput(patch.current),
        previousPricePiastres: patch.previous === null ? null : fromEgpInput(patch.previous),
        durationDays: Number(patch.duration),
      });
      await onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.code : 'SERVICE_ERROR');
    }
  }

  async function remove(planId: string): Promise<void> {
    setError(null);
    try {
      await removePlan(planId);
      await onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.code : 'SERVICE_ERROR');
    }
  }

  return (
    <Card className="mt-4">
      <h2 className="text-xl font-bold">
        {t.durationLabel} / {t.priceLabel}
      </h2>
      {error !== null ? <Notice kind="error">{localizeCode(t, error)}</Notice> : null}
      <ul className="mt-2 space-y-2">
        {plans.map((p) => (
          <PlanRow key={p.id} plan={p} lang={lang} onSave={(patch) => void saveInline(p, patch)} onRemove={() => void remove(p.id)} />
        ))}
      </ul>
      <form onSubmit={(e) => void submit(e)} noValidate className="mt-4 grid grid-cols-2 gap-3 max-sm:grid-cols-1">
        <Field id="plan-current" label={t.fieldCurrentPrice} dir="ltr">
          <input id="plan-current" dir="ltr" required inputMode="decimal" className={textInputClassName(false)} value={current} onChange={(e) => setCurrent(e.target.value)} />
        </Field>
        <Field id="plan-duration" label={t.fieldDuration} dir="ltr">
          <input id="plan-duration" dir="ltr" required inputMode="numeric" className={textInputClassName(false)} value={duration} onChange={(e) => setDuration(e.target.value)} />
        </Field>
        <div className="col-span-2 flex items-center gap-2">
          <input id="plan-prev-toggle" type="checkbox" className="h-[22px] w-[22px]" checked={previousEnabled} onChange={(e) => setPreviousEnabled(e.target.checked)} />
          <label htmlFor="plan-prev-toggle" className="text-sm font-semibold">
            {t.fieldPreviousPriceToggle}
          </label>
        </div>
        {previousEnabled ? (
          <Field id="plan-previous" label={t.fieldPreviousPrice} dir="ltr">
            <input id="plan-previous" dir="ltr" inputMode="decimal" className={textInputClassName(false)} value={previous} onChange={(e) => setPrevious(e.target.value)} />
          </Field>
        ) : null}
        <div className="col-span-2">
          <Button type="submit" disabled={busy}>
            {t.actionAddPlan}
          </Button>
        </div>
      </form>
    </Card>
  );
}

function PlanRow({ plan, lang, onSave, onRemove }: { plan: AdminPlan; lang: string; onSave: (p: { current: string; previous: string | null; duration: string }) => void; onRemove: () => void }): JSX.Element {
  const { t } = useLang();
  const [editing, setEditing] = useState(false);
  const [current, setCurrent] = useState(toEgpInput(plan.currentPricePiastres));
  const [previous, setPrevious] = useState(plan.previousPricePiastres === null ? '' : toEgpInput(plan.previousPricePiastres));
  const [duration, setDuration] = useState(String(plan.durationDays));
  if (!editing) {
    return (
      <li className="flex flex-wrap items-center gap-3">
        <PriceDisplay current={plan.currentPricePiastres} previous={plan.previousPricePiastres} durationDays={plan.durationDays} />
        <Button variant="secondary" onClick={() => setEditing(true)}>
          {t.actionEdit}
        </Button>
        <Button variant="secondary" onClick={onRemove}>
          {t.actionRemove}
        </Button>
      </li>
    );
  }
  return (
    <li className="flex flex-wrap items-end gap-2">
      <input dir="ltr" aria-label={t.fieldCurrentPrice} className={textInputClassName(false)} value={current} onChange={(e) => setCurrent(e.target.value)} />
      <input dir="ltr" aria-label={t.fieldPreviousPrice} placeholder={t.fieldPreviousPrice} className={textInputClassName(false)} value={previous} onChange={(e) => setPrevious(e.target.value)} />
      <input dir="ltr" aria-label={t.fieldDuration} className={textInputClassName(false)} value={duration} onChange={(e) => setDuration(e.target.value)} />
      <Button variant="primary" onClick={() => { onSave({ current, previous: previous === '' ? null : previous, duration }); setEditing(false); }}>
        {t.submitSave}
      </Button>
      <Button variant="secondary" onClick={() => setEditing(false)}>
        {t.actionCancel}
      </Button>
      <span className="sr-only">{lang}</span>
    </li>
  );
}
