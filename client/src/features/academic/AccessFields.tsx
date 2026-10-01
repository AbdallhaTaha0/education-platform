import { useLang } from '../../i18n';
import { Field, textInputClassName } from '../../components/ui/Field';
import type { AccessMode } from './model';
export interface AccessDraft {
  mode: AccessMode;
  duration: string;
  deadline: string;
}
export function AccessFields({
  value,
  onChange,
  prefix,
}: {
  value: AccessDraft;
  onChange: (v: AccessDraft) => void;
  prefix: string;
}): JSX.Element {
  const { lang } = useLang();
  const ar = lang === 'ar';
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field id={`${prefix}-mode`} label={ar ? 'الوصول للكورس' : 'Course access'}>
        <select
          id={`${prefix}-mode`}
          className={textInputClassName(false)}
          value={value.mode}
          onChange={(e) => onChange({ ...value, mode: e.target.value as AccessMode })}
        >
          <option value="DURATION">{ar ? 'مدة من وقت الشراء' : 'Duration from purchase'}</option>
          <option value="TERM_END">{ar ? 'حتى نهاية الترم' : 'Until term end'}</option>
          <option value="YEAR_END">
            {ar ? 'حتى نهاية السنة الدراسية' : 'Until academic-year end'}
          </option>
          <option value="UNTIL_REMOVAL">
            {ar ? 'حتى الحذف النهائي، بدون مدة' : 'Until permanent removal, no expiry'}
          </option>
        </select>
      </Field>
      {value.mode === 'DURATION' ? (
        <Field id={`${prefix}-days`} label={ar ? 'المدة بالأيام' : 'Duration in days'}>
          <input
            id={`${prefix}-days`}
            type="number"
            min="1"
            max="3650"
            required
            className={textInputClassName(false)}
            value={value.duration}
            onChange={(e) => onChange({ ...value, duration: e.target.value })}
          />
        </Field>
      ) : value.mode === 'UNTIL_REMOVAL' ? (
        <p className="text-sm">
          {ar
            ? 'بدون موعد انتهاء، حتى الحذف النهائي للكورس من الإدارة.'
            : 'No expiry, until the admin permanently removes this course.'}
        </p>
      ) : (
        <Field
          id={`${prefix}-deadline`}
          label={ar ? 'موعد الانتهاء بتوقيت القاهرة' : 'End date and time — Cairo'}
        >
          <input
            id={`${prefix}-deadline`}
            type="datetime-local"
            step="1"
            required
            className={textInputClassName(false)}
            value={value.deadline}
            onChange={(e) => onChange({ ...value, deadline: e.target.value })}
          />
        </Field>
      )}
    </div>
  );
}
