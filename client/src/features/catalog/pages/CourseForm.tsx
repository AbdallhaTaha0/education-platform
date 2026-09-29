import { useState, type FormEvent } from 'react';
import { useLang } from '../../../i18n';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { Field, textInputClassName } from '../../../components/ui/Field';

export interface CourseFormValues {
  slug: string;
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  descriptionEn: string;
}

export function CourseForm({ busy, initial, onSubmit }: { busy: boolean; initial?: CourseFormValues; onSubmit: (v: CourseFormValues) => void }): JSX.Element {
  const { t } = useLang();
  const [slug, setSlug] = useState(initial?.slug ?? '');
  const [titleAr, setTitleAr] = useState(initial?.titleAr ?? '');
  const [titleEn, setTitleEn] = useState(initial?.titleEn ?? '');
  const [descAr, setDescAr] = useState(initial?.descriptionAr ?? '');
  const [descEn, setDescEn] = useState(initial?.descriptionEn ?? '');

  function submit(e: FormEvent): void {
    e.preventDefault();
    if (busy) return;
    onSubmit({ slug, titleAr, titleEn, descriptionAr: descAr, descriptionEn: descEn });
    if (initial === undefined) {
      setSlug('');
      setTitleAr('');
      setTitleEn('');
      setDescAr('');
      setDescEn('');
    }
  }

  return (
    <Card className="mx-auto mt-4 max-w-[640px]">
      <h2 className="text-xl font-bold">{initial === undefined ? t.courseCreateTitle : t.courseEditTitle}</h2>
      <form onSubmit={submit} noValidate className="mt-4">
        <Field id="cf-slug" label={t.fieldSlug} dir="ltr">
          <input id="cf-slug" dir="ltr" required className={textInputClassName(false)} value={slug} onChange={(e) => setSlug(e.target.value)} />
        </Field>
        <Field id="cf-ta" label={t.fieldTitleAr}>
          <input id="cf-ta" required className={textInputClassName(false)} value={titleAr} onChange={(e) => setTitleAr(e.target.value)} />
        </Field>
        <Field id="cf-te" label={t.fieldTitleEn} dir="ltr">
          <input id="cf-te" dir="ltr" required className={textInputClassName(false)} value={titleEn} onChange={(e) => setTitleEn(e.target.value)} />
        </Field>
        <Field id="cf-da" label={t.fieldDescAr}>
          <textarea id="cf-da" required className={textInputClassName(false)} value={descAr} onChange={(e) => setDescAr(e.target.value)} />
        </Field>
        <Field id="cf-de" label={t.fieldDescEn} dir="ltr">
          <textarea id="cf-de" dir="ltr" required className={textInputClassName(false)} value={descEn} onChange={(e) => setDescEn(e.target.value)} />
        </Field>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button type="submit" disabled={busy}>
            {initial === undefined ? t.submitCreate : t.submitSave}
          </Button>
        </div>
      </form>
    </Card>
  );
}
