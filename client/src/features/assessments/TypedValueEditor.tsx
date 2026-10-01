import { useEffect, useRef, useState } from 'react';
import { useLang } from '../../i18n';
import { Button } from '../../components/ui/Button';
import { textInputClassName } from '../../components/ui/Field';
import { initialValue, parseNumber, renameProperty, valueType, type ValueType } from './value-types';

const TYPES: Array<[ValueType, string, string]> = [
  ['string', 'نص', 'Text (string)'], ['number', 'رقم', 'Number'], ['boolean', 'صح أو خطأ', 'Boolean'],
  ['null', 'قيمة فارغة null', 'Null'], ['object', 'كائن بخصائص', 'Object'], ['array', 'قائمة قيم', 'Array'],
];

export function TypedValueEditor({ value, onChange, name, consoleOutput = false, depth = 0 }: { value: unknown; onChange: (value: unknown) => void; name: string; consoleOutput?: boolean; depth?: number }): JSX.Element {
  const { lang } = useLang(); const label = (ar: string, en: string): string => lang === 'ar' ? ar : en;
  const type = valueType(value);
  const tooLarge = JSON.stringify(value ?? '').length > 8192;
  return <div data-testid="typed-value" className="min-w-0 space-y-2">
    <label className="block"><span>{name} · {label('نوع القيمة', 'Value type')}</span><select aria-label={`${name} value type`} className={textInputClassName(false)} value={type} onChange={(event) => onChange(initialValue(event.target.value as ValueType))}>{TYPES.map(([key, ar, en]) => <option key={key} value={key} disabled={consoleOutput && ['object', 'array'].includes(key)}>{label(ar, en)}</option>)}</select></label>
    {type === 'string' ? <label className="block">{name}<textarea aria-label={name} dir="ltr" rows={2} maxLength={8192} className={textInputClassName(tooLarge)} value={typeof value === 'string' ? value : ''} onChange={(event) => onChange(event.target.value)} /></label> : null}
    {type === 'number' ? <NumberInput value={value as number} onChange={onChange} name={name} /> : null}
    {type === 'boolean' ? <label className="block">{name}<select aria-label={name} dir="ltr" className={textInputClassName(false)} value={String(value)} onChange={(event) => onChange(event.target.value === 'true')}><option value="false">false</option><option value="true">true</option></select></label> : null}
    {type === 'null' ? <p dir="ltr">null</p> : null}
    {['object', 'array'].includes(type) && depth >= 4 ? <JsonInput key={type} value={value} onChange={onChange} name={name} type={type} /> : null}
    {type === 'object' && depth < 4 ? <div className="space-y-3 rounded-control border border-border p-3">
      {Object.entries(value as Record<string, unknown>).map(([key, item], index) => <PropertyEditor key={index} property={key} value={item} parent={value as Record<string, unknown>} onChange={onChange} depth={depth} />)}
      <Button variant="secondary" onClick={() => { const object = value as Record<string, unknown>; let i = 1; while (Object.prototype.hasOwnProperty.call(object, `property${i}`)) i++; onChange({ ...object, [`property${i}`]: '' }); }}>{label('إضافة خاصية', 'Add property')}</Button>
    </div> : null}
    {type === 'array' && depth < 4 ? <div className="space-y-3 rounded-control border border-border p-3">
      {(value as unknown[]).map((item, index) => <div key={index} className="space-y-2"><TypedValueEditor value={item} name={`${name} [${index}]`} depth={depth + 1} onChange={(next) => onChange((value as unknown[]).map((old, i) => i === index ? next : old))} /><Button variant="secondary" onClick={() => onChange((value as unknown[]).filter((_, i) => i !== index))}>{label('حذف القيمة', 'Remove item')}</Button></div>)}
      <Button variant="secondary" onClick={() => onChange([...(value as unknown[]), ''])}>{label('إضافة قيمة', 'Add item')}</Button>
    </div> : null}
    {tooLarge ? <p role="alert" aria-invalid="true" className="text-error-fg">{label('القيمة أكبر من الحد المسموح (8192 حرفًا).', 'Value exceeds the 8192-character limit.')}</p> : null}
    {depth === 0 && !consoleOutput ? <p className="text-sm text-muted">{label('الدالة يجب أن ترجع نفس القيمة ونوعها. ترتيب خصائص الكائن لا يهم؛ ترتيب قيم القائمة مهم.', 'The function must return the same value and type. Object property order does not matter; array item order does.')}</p> : null}
    {depth === 0 && consoleOutput ? <p className="text-sm text-muted">{label('الطباعة تقارن النص الظاهر بالكامل؛ طباعة الرقم 2 والنص "2" تعطي نفس المخرجات. لفحص نوع قيمة أو كائن أو قائمة اختر ناتج دالة.', 'Printed output matches the complete displayed text; printing the number 2 and the string "2" looks the same. Use a function return check to verify types, objects or arrays.')}</p> : null}
  </div>;
}

function NumberInput({ value, onChange, name }: { value: number; onChange: (v: unknown) => void; name: string }): JSX.Element {
  const { lang } = useLang(); const [raw, setRaw] = useState(String(value)); const [invalid, setInvalid] = useState(false); const committed = useRef(value);
  useEffect(() => { if (value !== committed.current) { committed.current = value; setRaw(String(value)); setInvalid(false); } }, [value]);
  return <label className="block">{name}<input aria-label={name} aria-invalid={invalid} dir="ltr" inputMode="decimal" className={textInputClassName(invalid)} value={raw} onChange={(event) => { setRaw(event.target.value); try { const number = parseNumber(event.target.value); committed.current = number; setInvalid(false); onChange(number); } catch { setInvalid(true); } }} />{invalid ? <span role="alert" className="text-error-fg">{lang === 'ar' ? 'أدخل رقمًا صحيحًا، مثل 2 أو 3.5.' : 'Enter a valid number, such as 2 or 3.5.'}</span> : null}</label>;
}

function PropertyEditor({ property, value, parent, onChange, depth }: { property: string; value: unknown; parent: Record<string, unknown>; onChange: (v: unknown) => void; depth: number }): JSX.Element {
  const { lang } = useLang(); const [name, setName] = useState(property); const [invalid, setInvalid] = useState(false);
  useEffect(() => { setName(property); setInvalid(false); }, [property]);
  return <div className="space-y-2 rounded-control border border-border p-3">
    <label>{lang === 'ar' ? 'اسم الخاصية' : 'Property name'}<input aria-label="Property name" aria-invalid={invalid} dir="ltr" className={textInputClassName(invalid)} value={name} onChange={(event) => { setName(event.target.value); try { const next = renameProperty(parent, property, event.target.value); setInvalid(false); onChange(next); } catch { setInvalid(true); } }} /></label>
    {invalid ? <p role="alert" className="text-error-fg">{lang === 'ar' ? 'اكتب اسمًا غير فارغ وغير مكرر.' : 'Use a nonempty, unique property name.'}</p> : null}
    <TypedValueEditor value={value} name={property} depth={depth + 1} onChange={(item) => onChange({ ...parent, [property]: item })} />
    <Button variant="secondary" onClick={() => onChange(Object.fromEntries(Object.entries(parent).filter(([key]) => key !== property)))}>{lang === 'ar' ? 'حذف الخاصية' : 'Remove property'}</Button>
  </div>;
}

function JsonInput({ value, onChange, name, type }: { value: unknown; onChange: (v: unknown) => void; name: string; type: ValueType }): JSX.Element {
  const [raw, setRaw] = useState(JSON.stringify(value, null, 2)); const [invalid, setInvalid] = useState(false); const { lang } = useLang(); const committed = useRef(JSON.stringify(value));
  useEffect(() => { const serialized = JSON.stringify(value); if (serialized !== committed.current) { committed.current = serialized; setRaw(JSON.stringify(value, null, 2)); setInvalid(false); } }, [value]);
  return <label>{name} · JSON<textarea dir="ltr" rows={6} aria-invalid={invalid} className={textInputClassName(invalid)} value={raw} onChange={(event) => { setRaw(event.target.value); try { const next: unknown = JSON.parse(event.target.value); if (valueType(next) !== type) throw new Error(); committed.current = JSON.stringify(next); setInvalid(false); onChange(next); } catch { setInvalid(true); } }} />{invalid ? <span role="alert">{lang === 'ar' ? 'صحح JSON قبل الحفظ.' : 'Correct the JSON before saving.'}</span> : null}</label>;
}
