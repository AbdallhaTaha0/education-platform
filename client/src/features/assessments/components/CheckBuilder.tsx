import { useLang } from '../../../i18n';
import { Button } from '../../../components/ui/Button';
import { Notice } from '../../../components/ui/Notice';
import { textInputClassName } from '../../../components/ui/Field';
import type { IDEMode } from '../../ide/types';
import { TypedValueEditor } from '../TypedValueEditor';
import type { Check } from './types';

export function CheckBuilder({
  checks,
  onChange,
  mode,
}: {
  mode: IDEMode;
  checks: Check[];
  onChange: (c: Check[]) => void;
}): JSX.Element {
  const { lang } = useLang();
  const ar = lang === 'ar';
  const label = (a: string, e: string): string => (ar ? a : e);
  const update = (i: number, c: Check): void =>
    onChange(checks.map((old, index) => (index === i ? c : old)));
  const show = (v: unknown): string =>
    typeof v === 'string' ? v : v === undefined ? '' : JSON.stringify(v);

  return (
    <div data-admin-checks className="space-y-3">
      <h4 className="font-semibold">
        {label('اختبارات السلوك الخاصة', 'Private behavior checks')}
      </h4>
      <p className="text-sm text-muted">
        {label(
          'حدد مخرجات الطباعة أو ناتج الدالة أو سلوك الصفحة؛ لا تقارن نص الكود.',
          'Define printed output, function results or web behavior. Never compare source text.',
        )}
      </p>
      {checks.map((c, i) => (
        <div
          key={i}
          data-admin-check
          className="space-y-2 rounded-control border border-border p-3"
        >
          <label className="block text-start">
            {label('نوع الاختبار', 'Check type')}
            <select
              value={c.type}
              className={textInputClassName(false)}
              onChange={(e) =>
                update(i, {
                  type: e.target.value,
                  ...(c.steps ? { steps: c.steps } : {}),
                  ...(!['console', 'function'].includes(e.target.value)
                    ? { selector: c.selector ?? '' }
                    : {}),
                  ...(['attribute', 'style', 'function'].includes(e.target.value)
                    ? { name: c.name ?? '' }
                    : {}),
                  ...(e.target.value === 'function' ? { args: c.args ?? [] } : {}),
                  ...(e.target.value !== 'exists' ? { expected: c.expected ?? '' } : {}),
                })
              }
            >
              {[
                ...(mode === 'web'
                  ? [
                      ['exists', 'وجود عنصر', 'Element exists'],
                      ['text', 'نص العنصر', 'Element text'],
                      ['value', 'قيمة العنصر', 'Element value'],
                      ['attribute', 'خاصية العنصر', 'Element attribute'],
                      ['style', 'تنسيق العنصر', 'Computed style'],
                    ]
                  : !['console', 'function'].includes(c.type)
                    ? [[c.type, 'اختبار صفحة سابق', 'Existing page check']]
                    : []),
                ['console', 'مخرجات console.log', 'Printed output (console.log)'],
                ['function', 'القيمة التي ترجعها الدالة', 'Function return value'],
              ].map(([v, a, e]) => (
                <option key={v} value={v}>
                  {label(a, e)}
                </option>
              ))}
            </select>
          </label>
          {!['console', 'function'].includes(c.type) ? (
            <label className="block text-start">
              {label('محدد العنصر (مثل #result)', 'Element selector (e.g. #result)')}
              <input
                required
                maxLength={256}
                dir="ltr"
                className={textInputClassName(false)}
                value={c.selector ?? ''}
                onChange={(e) => update(i, { ...c, selector: e.target.value })}
              />
            </label>
          ) : null}
          {['attribute', 'style', 'function'].includes(c.type) ? (
            <label className="block text-start">
              {label('اسم الخاصية أو الدالة', 'Property or function name')}
              <input
                required
                maxLength={100}
                pattern={
                  c.type === 'function'
                    ? '[A-Za-z_$][A-Za-z0-9_$]*'
                    : '[A-Za-z_$][A-Za-z0-9_$\\-]*'
                }
                dir="ltr"
                className={textInputClassName(false)}
                value={c.name ?? ''}
                onChange={(e) => update(i, { ...c, name: e.target.value })}
              />
            </label>
          ) : null}
          {c.type === 'function' ? (
            <>
              <p className="text-sm text-muted">
                {label(
                  'مثال: الدالة sum ومدخلان 2 و3 والناتج المتوقع رقم 5. كل مدخل قيمة منفصلة؛ لا تكتب اسم الدالة أو الأقواس في المدخلات.',
                  'Example: function sum, two inputs 2 and 3, expected Number 5. Each input is a separate value; do not enter the function name or parentheses as an input.',
                )}
              </p>
              <div className="space-y-3">
                <h5 className="font-semibold">
                  {label('مدخلات الدالة', 'Function inputs')}
                </h5>
                {(c.args ?? []).map((argument, index) => (
                  <div key={index} className="rounded-control border border-border p-3">
                    <TypedValueEditor
                      name={label(`المدخل ${index + 1}`, `Input ${index + 1}`)}
                      value={argument}
                      onChange={(next) =>
                        update(i, {
                          ...c,
                          args: c.args!.map((old, at) => (at === index ? next : old)),
                        })
                      }
                    />
                    <Button
                      variant="secondary"
                      onClick={() =>
                        update(i, {
                          ...c,
                          args: c.args!.filter((_, at) => at !== index),
                        })
                      }
                    >
                      {label('حذف المدخل', 'Remove input')}
                    </Button>
                  </div>
                ))}
                <Button
                  variant="secondary"
                  disabled={(c.args?.length ?? 0) >= 10}
                  disabledReason={{
                    ar: 'الحد الأقصى ١٠ مدخلات للدالة.',
                    en: 'Maximum: 10 function inputs.',
                  }}
                  onClick={() => update(i, { ...c, args: [...(c.args ?? []), ''] })}
                >
                  {label('إضافة مدخل', 'Add input')}
                </Button>
              </div>
            </>
          ) : null}
          {['console', 'function'].includes(c.type) ? (
            <TypedValueEditor
              name={label('القيمة المتوقعة', 'Expected value')}
              value={c.expected ?? (c.expected === null ? null : '')}
              consoleOutput={c.type === 'console'}
              onChange={(expected) => update(i, { ...c, expected })}
            />
          ) : c.type !== 'exists' ? (
            <label className="block text-start">
              {label('الناتج المتوقع (كما يظهر للطالب)', 'Expected output (as printed or displayed)')}
              <input
                dir="ltr"
                className={textInputClassName(false)}
                value={show(c.expected)}
                onChange={(e) => update(i, { ...c, expected: e.target.value })}
              />
            </label>
          ) : null}
          {c.type === 'console' ? (
            <p className="text-sm text-muted">
              {label(
                'لطباعة console.log(2) اختر رقمًا وأدخل 2. للنص اختر نصًا واكتب Hello بدون علامات اقتباس. إذا توجد عدة طباعات، اختر نصًا وضع كل سطر كما يظهر.',
                'For console.log(2), choose Number and enter 2. For text, choose Text and enter Hello without quotes. For several logs, choose Text and enter each output line exactly as displayed.',
              )}
            </p>
          ) : null}
          {c.type === 'console' &&
          typeof c.expected === 'string' &&
          /^".*"$/.test(c.expected) ? (
            <Notice kind="info">
              {label(
                'علامات الاقتباس في هذا الحقل جزء من المخرجات المتوقعة. لطباعة 2 احذف علامات الاقتباس.',
                'Quotation marks in this field are part of the expected output. To print 2, remove those quotation marks.',
              )}
            </Notice>
          ) : null}
          {mode !== 'web' &&
          (!['console', 'function'].includes(c.type) || (c.steps?.length ?? 0) > 0) ? (
            <Notice kind="info">
              {label(
                'هذا الاختبار يحتوي على قواعد صفحة سابقة. JavaScript فقط حاليًا؛ احذف التفاعلات وحوّل القواعد إلى مخرجات أو ناتج دالة ثم احفظ وانشر. لا يتم حذف القواعد تلقائيًا.',
                'This check contains earlier page rules. JavaScript is the current editor mode; remove interactions and use console or function checks, then save and publish. Existing rules are not removed automatically.',
              )}
            </Notice>
          ) : null}
          {(c.steps ?? []).map((s, j) => (
            <div
              key={j}
              data-testid="check-interaction"
              className="grid items-end gap-2 md:grid-cols-4"
            >
              <select
                aria-label={label('تفاعل قبل الاختبار', 'Interaction before check')}
                value={s.action}
                className={textInputClassName(false)}
                onChange={(e) =>
                  update(i, {
                    ...c,
                    steps: c.steps!.map((old, k) =>
                      k === j ? { ...old, action: e.target.value } : old,
                    ),
                  })
                }
              >
                <option value="click">{label('نقرة', 'Click')}</option>
                <option value="input">{label('إدخال', 'Input')}</option>
              </select>
              <input
                required
                maxLength={256}
                dir="ltr"
                aria-label={label('عنصر التفاعل', 'Interaction selector')}
                className={textInputClassName(false)}
                value={s.selector}
                onChange={(e) =>
                  update(i, {
                    ...c,
                    steps: c.steps!.map((old, k) =>
                      k === j ? { ...old, selector: e.target.value } : old,
                    ),
                  })
                }
              />
              {s.action === 'input' ? (
                <input
                  maxLength={2000}
                  aria-label={label('القيمة المدخلة', 'Input value')}
                  className={textInputClassName(false)}
                  value={s.value ?? ''}
                  onChange={(e) =>
                    update(i, {
                      ...c,
                      steps: c.steps!.map((old, k) =>
                        k === j ? { ...old, value: e.target.value } : old,
                      ),
                    })
                  }
                />
              ) : null}
              <Button
                variant="secondary"
                aria-label={label('حذف التفاعل', 'Remove interaction')}
                onClick={() =>
                  update(i, {
                    ...c,
                    steps: c.steps!.filter((_, index) => index !== j),
                  })
                }
              >
                {label('حذف التفاعل', 'Remove interaction')}
              </Button>
            </div>
          ))}
          {mode === 'web' ? (
            <Button
              variant="secondary"
              disabled={(c.steps?.length ?? 0) >= 10}
              disabledReason={{
                ar: 'الحد الأقصى ١٠ تفاعلات لكل اختبار.',
                en: 'Maximum: 10 interactions per check.',
              }}
              onClick={() =>
                update(i, {
                  ...c,
                  steps: [...(c.steps ?? []), { action: 'click', selector: '' }],
                })
              }
            >
              {label('إضافة تفاعل', 'Add interaction')}
            </Button>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={() => onChange(checks.filter((_, j) => j !== i))}
            >
              {label('حذف الاختبار', 'Remove check')}
            </Button>
          </div>
        </div>
      ))}
      <Button
        variant="secondary"
        disabled={checks.length >= 20}
        disabledReason={{
          ar: 'الحد الأقصى ٢٠ اختبارًا للتقييم.',
          en: 'Maximum: 20 checks per assessment.',
        }}
        data-admin-add-check
        onClick={() => onChange([...checks, { type: 'console', expected: '' }])}
      >
        {label('إضافة اختبار', 'Add check')}
      </Button>
    </div>
  );
}
