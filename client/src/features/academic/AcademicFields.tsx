import { useLang } from '../../i18n';
import { Field, textInputClassName } from '../../components/ui/Field';
import { emptyAcademic, type Academic } from './model';
export function AcademicFields({
  value,
  onChange,
}: {
  value: Academic | null;
  onChange: (v: Academic | null) => void;
}): JSX.Element {
  const { lang } = useLang();
  const ar = lang === 'ar';
  const update = (patch: Partial<Academic>) => onChange({ ...(value ?? emptyAcademic), ...patch });
  return (
    <fieldset className="mt-5 rounded-card border border-border p-4">
      <legend className="px-2 font-bold">
        {ar ? 'مكان الكورس في السنة الدراسية' : 'Academic placement'}
      </legend>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={value !== null}
          onChange={(e) =>
            onChange(
              e.target.checked
                ? {
                    ...emptyAcademic,
                    grade: 'FIRST_SECONDARY',
                    term: 1,
                    courseKind: 'MONTHLY_EXPLANATION',
                  }
                : null,
            )
          }
        />
        {ar ? 'تصنيف الكورس حسب الصف والسنة' : 'Classify by grade and academic year'}
      </label>
      {value !== null ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field id="academic-grade" label={ar ? 'الصف' : 'Grade'}>
            <select
              id="academic-grade"
              className={textInputClassName(false)}
              value={value.grade ?? ''}
              onChange={(e) => update({ grade: e.target.value, term: value.term ?? 1 })}
            >
              <option value="FIRST_SECONDARY">{ar ? 'أولى ثانوي' : 'First secondary'}</option>
              <option value="SECOND_SECONDARY">{ar ? 'ثانية ثانوي' : 'Second secondary'}</option>
            </select>
          </Field>
          <Field
            id="academic-year"
            label={ar ? 'السنة الدراسية، مثال 2026/2027' : 'Academic year, e.g. 2026/2027'}
          >
            <input
              id="academic-year"
              dir="ltr"
              required
              className={textInputClassName(false)}
              placeholder="2026/2027"
              value={value.academicYear ?? ''}
              onChange={(e) => update({ academicYear: e.target.value })}
            />
          </Field>
          <Field id="academic-term" label={ar ? 'الترم' : 'Term'}>
            <select
              id="academic-term"
              required
              className={textInputClassName(false)}
              value={value.term ?? ''}
              onChange={(e) => update({ term: Number(e.target.value) })}
            >
              <option value="" disabled>
                {ar ? 'اختر الترم' : 'Choose a term'}
              </option>
              <option value="1">{ar ? 'الترم الأول' : 'Term 1'}</option>
              <option value="2">{ar ? 'الترم الثاني' : 'Term 2'}</option>
            </select>
          </Field>
          <Field id="academic-kind" label={ar ? 'نوع الكورس' : 'Course type'}>
            <select
              id="academic-kind"
              className={textInputClassName(false)}
              value={value.courseKind ?? ''}
              onChange={(e) =>
                update({
                  courseKind: e.target.value,
                  teachingMonth: e.target.value === 'REVISION' ? null : value.teachingMonth,
                })
              }
            >
              <option value="MONTHLY_EXPLANATION">{ar ? 'شرح شهري' : 'Monthly explanation'}</option>
              <option value="REVISION">{ar ? 'مراجعة' : 'Revision'}</option>
            </select>
          </Field>
          {value.courseKind === 'MONTHLY_EXPLANATION' ? (
            <Field id="academic-month" label={ar ? 'شهر الشرح' : 'Teaching month'}>
              <input
                id="academic-month"
                type="month"
                required
                className={textInputClassName(false)}
                value={value.teachingMonth ?? ''}
                onChange={(e) => update({ teachingMonth: e.target.value })}
              />
            </Field>
          ) : null}
        </div>
      ) : (
        <p className="mt-2 text-sm text-muted">
          {ar
            ? 'الكورسات القديمة تظل بدون تصنيف حتى تحدده الإدارة.'
            : 'Existing courses stay unclassified until an admin assigns placement.'}
        </p>
      )}
    </fieldset>
  );
}
