import { useState, type FormEvent } from 'react';
import { useLang } from '../../../i18n';
import { Button } from '../../../components/ui/Button';
import { FormActions } from '../../../components/ui/FormActions';
import { Card } from '../../../components/ui/Card';
import { Field, textInputClassName } from '../../../components/ui/Field';
import { AcademicFields } from '../../academic/AcademicFields';
import type { Academic } from '../../academic/model';
import { useUnsavedChanges } from '../../../components/ui/UnsavedChanges';

export interface CourseFormValues {
  slug: string;
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  descriptionEn: string;
  academic?: Academic | null;
}

export function CourseForm({
  busy,
  initial,
  onSubmit,
}: {
  busy: boolean;
  initial?: CourseFormValues;
  onSubmit: (v: CourseFormValues) => void | Promise<boolean>;
}): JSX.Element {
  const { t, lang } = useLang();
  const [slug, setSlug] = useState(initial?.slug ?? '');
  const [titleAr, setTitleAr] = useState(initial?.titleAr ?? '');
  const [titleEn, setTitleEn] = useState(initial?.titleEn ?? '');
  const [descAr, setDescAr] = useState(initial?.descriptionAr ?? '');
  const [descEn, setDescEn] = useState(initial?.descriptionEn ?? '');
  const [academic, setAcademic] = useState<Academic | null>(initial?.academic ?? null);
  const values = {slug,titleAr,titleEn,descriptionAr:descAr,descriptionEn:descEn,academic};
  const [baseline,setBaseline] = useState(JSON.stringify(values));
  const dirty = JSON.stringify(values)!==baseline;
  useUnsavedChanges(dirty,lang==='ar'?'لديك بيانات كورس غير محفوظة. هل تريد تركها؟':'You have unsaved course details. Leave without saving?');

  async function submit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    if (busy) return;
    if (!e.currentTarget.reportValidity()) return;
    const result = await onSubmit(values);
    if (result !== true) return;
    setBaseline(JSON.stringify(values));
    if (initial === undefined) {
      setSlug('');
      setTitleAr('');
      setTitleEn('');
      setDescAr('');
      setDescEn('');
      setAcademic(null);
      setBaseline(JSON.stringify({slug:'',titleAr:'',titleEn:'',descriptionAr:'',descriptionEn:'',academic:null}));
    }
  }

  return (
    <Card className="mx-auto mt-4 max-w-[640px]">
      <h2 className="text-xl font-bold">
        {initial === undefined ? t.courseCreateTitle : t.courseEditTitle}
      </h2>
      <p role="status" className="mt-2 text-sm text-muted">{dirty?(lang==='ar'?'تعديلات غير محفوظة':'Unsaved changes'):(lang==='ar'?'لا توجد تعديلات غير محفوظة':'No unsaved changes')}</p>
      <form onSubmit={(e)=>void submit(e)} noValidate className="mt-4">
        <Field id="cf-slug" label={t.fieldSlug} dir="ltr">
          <input
            id="cf-slug"
            dir="ltr"
            required
            className={textInputClassName(false)}
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
          />
        </Field>
        <Field id="cf-ta" label={t.fieldTitleAr}>
          <input
            id="cf-ta"
            required
            className={textInputClassName(false)}
            value={titleAr}
            onChange={(e) => setTitleAr(e.target.value)}
          />
        </Field>
        <Field id="cf-te" label={t.fieldTitleEn} dir="ltr">
          <input
            id="cf-te"
            dir="ltr"
            required
            className={textInputClassName(false)}
            value={titleEn}
            onChange={(e) => setTitleEn(e.target.value)}
          />
        </Field>
        <Field id="cf-da" label={t.fieldDescAr}>
          <textarea
            id="cf-da"
            required
            className={textInputClassName(false)}
            value={descAr}
            onChange={(e) => setDescAr(e.target.value)}
          />
        </Field>
        <Field id="cf-de" label={t.fieldDescEn} dir="ltr">
          <textarea
            id="cf-de"
            dir="ltr"
            required
            className={textInputClassName(false)}
            value={descEn}
            onChange={(e) => setDescEn(e.target.value)}
          />
        </Field>
        <AcademicFields value={academic} onChange={setAcademic} />
        <FormActions>
          <Button type="submit" disabled={busy}>
            {initial === undefined ? t.submitCreate : t.submitSave}
          </Button>
        </FormActions>
      </form>
    </Card>
  );
}
