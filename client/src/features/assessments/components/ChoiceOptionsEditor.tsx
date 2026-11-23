import { Button } from '../../../components/ui/Button';
import { textInputClassName } from '../../../components/ui/Field';
import type { Question } from './types';

export function ChoiceOptionsEditor({
  question,
  ar,
  onChange,
}: {
  question: Question;
  ar: boolean;
  onChange: (next: Question) => void;
}): JSX.Element {
  const label = (a: string, e: string): string => (ar ? a : e);
  const choices = question.choices ?? [];

  return (
    <>
      <div className="space-y-2.5">
        {choices.map((c, i) => (
          <div
            key={c.id}
            className="grid items-end gap-2.5 rounded-xl border border-border/70 bg-field/50 p-3 md:grid-cols-[1fr_1fr_auto_auto]"
          >
            <label className="block text-start">
              <span className="text-xs font-semibold text-muted">الخيار بالعربية</span>
              <input
                required
                maxLength={2000}
                dir="rtl"
                className={`${textInputClassName(false)} mt-1`}
                value={c.textAr}
                onChange={(e) =>
                  onChange({
                    ...question,
                    choices: choices.map((x, j) => (j === i ? { ...x, textAr: e.target.value } : x)),
                  })
                }
              />
            </label>
            <label className="block text-start">
              <span className="text-xs font-semibold text-muted">Choice in English</span>
              <input
                required
                maxLength={2000}
                dir="ltr"
                className={`${textInputClassName(false)} mt-1`}
                value={c.textEn}
                onChange={(e) =>
                  onChange({
                    ...question,
                    choices: choices.map((x, j) => (j === i ? { ...x, textEn: e.target.value } : x)),
                  })
                }
              />
            </label>
            <label className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 text-sm font-semibold text-ink">
              <input
                type="radio"
                required
                name={`correct-${question.id}`}
                checked={question.correctChoiceId === c.id}
                onChange={() =>
                  onChange({
                    ...question,
                    correctChoiceId: c.id,
                  })
                }
              />
              <span>{label('الإجابة الصحيحة', 'Correct answer')}</span>
            </label>
            <Button
              variant="secondary"
              disabled={choices.length <= 2}
              disabledReason={{
                ar: 'احتفظ بخيارين على الأقل.',
                en: 'Keep at least two choices.',
              }}
              onClick={() =>
                onChange({
                  ...question,
                  choices: choices.filter((old) => old.id !== c.id),
                  correctChoiceId: question.correctChoiceId === c.id ? '' : question.correctChoiceId,
                })
              }
            >
              {label('حذف الخيار', 'Remove choice')}
            </Button>
          </div>
        ))}
      </div>
      <Button
        variant="secondary"
        disabled={choices.length >= 8}
        disabledReason={{
          ar: 'الحد الأقصى ٨ اختيارات للسؤال.',
          en: 'Maximum: 8 choices per question.',
        }}
        onClick={() =>
          onChange({
            ...question,
            choices: [
              ...choices,
              {
                id: crypto.randomUUID(),
                textAr: '',
                textEn: '',
              },
            ],
          })
        }
      >
        {label('إضافة خيار', 'Add choice')}
      </Button>
    </>
  );
}
