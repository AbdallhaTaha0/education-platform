import { useLayoutEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';

export interface EditorIssue { control: HTMLElement; message: string }

export function focusIssue(control: HTMLElement): void {
  for (let parent = control.parentElement; parent; parent = parent.parentElement) {
    if (parent instanceof HTMLDetailsElement) parent.open = true;
  }
  control.scrollIntoView({ block: 'center', behavior: 'auto' }); control.focus();
}

/** Uses rendered controls so invalid, uncommitted typed-value edits are included. */
export function inspectEditor(root: HTMLElement, ar: boolean): EditorIssue[] {
  const label = (a: string, e: string): string => ar ? a : e;
  const issues: EditorIssue[] = [];
  const add = (control: HTMLElement, reason: string): void => {
    if (issues.some((issue) => issue.control === control)) return;
    if (control instanceof HTMLInputElement && control.type === 'radio' && issues.some((issue) => issue.control instanceof HTMLInputElement && issue.control.type === 'radio' && issue.control.name === control.name)) return;
    const owner = control.closest('label');
    const codeGroup = control.closest('[data-admin-required-code]');
    const field = codeGroup?.querySelector('summary')?.textContent ?? (codeGroup ? label('كود المولّد الخاص', 'Private generator code') : null) ?? control.getAttribute('aria-label') ?? (owner ? [...owner.childNodes].find((node) => (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) || node.nodeName === 'SPAN')?.textContent?.trim() : '') ?? '';
    const question = control.closest('[data-admin-question]')?.getAttribute('data-admin-question');
    issues.push({ control, message: `${question ? `${label('السؤال', 'Question')} ${question} · ` : ''}${field ? `${field}: ` : ''}${reason}` });
  };
  if (!root.querySelector('[data-admin-question]')) {
    const control = root.querySelector<HTMLElement>('[data-admin-add-question]');
    if (control) add(control, label('أضف سؤالًا واحدًا على الأقل قبل الحفظ.', 'Add at least one question before saving.'));
  }
  for (const control of root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('input, textarea, select')) {
    const validity = control.validity;
    if (validity.valueMissing || (control.required && !control.value.trim())) add(control, control.getAttribute('data-missing-message') ?? label('هذا الحقل مطلوب.', 'This field is required.'));
    else if (validity.badInput || validity.rangeUnderflow || validity.rangeOverflow || validity.stepMismatch) add(control, label(`أدخل رقمًا ضمن النطاق الموضح (${control.getAttribute('min') ?? '…'}–${control.getAttribute('max') ?? '…'}).`, `Enter a number in the indicated range (${control.getAttribute('min') ?? '…'}–${control.getAttribute('max') ?? '…'}).`));
    else if (validity.patternMismatch) add(control, label('اكتب اسمًا صالحًا، مثل sum، بدون مسافات أو أقواس.', 'Enter a valid name such as sum, without spaces or parentheses.'));
    else if ('maxLength' in control && control.maxLength > 0 && control.value.length > control.maxLength) add(control, label(`الحد ${control.maxLength} حرفًا.`, `Maximum ${control.maxLength} characters.`));
    if (control.getAttribute('aria-invalid') === 'true' && (!control.hasAttribute('data-editor-invalid') || control.closest('[data-testid="typed-value"]'))) add(control, label('صحح القيمة أو اسم الخاصية قبل الحفظ.', 'Correct the values or property names before saving.'));
  }
  for (const marker of root.querySelectorAll<HTMLElement>('[data-testid="typed-value"] > [aria-invalid="true"]')) {
    const control = marker.parentElement?.querySelector<HTMLElement>('textarea, input, select');
    if (control) add(control, label('القيمة تتجاوز الحد المسموح (8192 حرفًا).', 'Value exceeds the 8192-character limit.'));
  }
  for (const group of root.querySelectorAll<HTMLElement>('[data-admin-required-code]')) {
    const editor = group.querySelector<HTMLElement>('[contenteditable="true"]');
    if (editor && !editor.textContent?.trim()) add(editor, label('اكتب الكود المطلوب قبل الحفظ.', 'Enter the required code before saving.'));
  }
  let cases = 0;
  for (const program of root.querySelectorAll<HTMLElement>('[data-testid="program-settings"]')) {
    const min = program.querySelector<HTMLInputElement>('[data-testid="generator-min"]');
    const max = program.querySelector<HTMLInputElement>('[data-testid="generator-max"]');
    const count = program.querySelector<HTMLInputElement>('[data-testid="generator-count"]');
    if (min && max && Number(min.value) > Number(max.value)) add(min, label('أقل قيمة يجب ألا تتجاوز أكبر قيمة.', 'Minimum must not exceed maximum.'));
    cases += program.querySelectorAll('[data-testid="program-sample"]').length + (count ? Number(count.value) : 1);
  }
  if (cases > 20) {
    const control = root.querySelector<HTMLElement>('[data-testid="generator-count"], [data-testid="program-generator"]');
    if (control) add(control, label('إجمالي الاختبارات لكل التقييم يجب ألا يتجاوز 20.', 'The assessment must have at most 20 planned cases in total.'));
  }
  return issues;
}

function InlineIssue({ issue, id }: { issue: EditorIssue; id: string }): JSX.Element {
  const [host] = useState(() => document.createElement('span'));
  useLayoutEffect(() => {
    const control = issue.control; const invalid = control.getAttribute('aria-invalid');
    const description = control.getAttribute('aria-describedby');
    const owner = control.closest('label');
    const accessibleName = control.getAttribute('aria-label');
    // Keep the field name separate from its error description without changing
    // the existing bilingual builder's grid or nesting.
    if (owner && accessibleName === null) {
      const name = [...owner.childNodes].find((node) => (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) || node.nodeName === 'SPAN')?.textContent?.trim();
      if (name) control.setAttribute('aria-label', name);
    }
    if (owner) owner.append(host);
    else (control.closest('[data-admin-required-code]') ?? control.parentElement)?.append(host);
    if (invalid !== 'true') control.setAttribute('aria-invalid', 'true');
    control.setAttribute('data-editor-invalid', 'true');
    control.setAttribute('aria-describedby', [description, id].filter(Boolean).join(' '));
    return () => {
      if (invalid === null) control.removeAttribute('aria-invalid'); else if (invalid !== 'true') control.setAttribute('aria-invalid', invalid);
      if (description === null) control.removeAttribute('aria-describedby'); else control.setAttribute('aria-describedby', description);
      if (accessibleName === null) control.removeAttribute('aria-label');
      control.removeAttribute('data-editor-invalid');
      host.remove();
    };
  }, [issue.control, id, host]);
  return createPortal(<span id={id} className="mt-2 block text-sm text-error-fg" data-testid="admin-field-error">{issue.message}</span>, host);
}

export function EditorFieldErrors({ issues }: { issues: EditorIssue[] }): JSX.Element {
  const prefix = useId();
  return <>{issues.map((issue, index) => <InlineIssue key={index} issue={issue} id={`${prefix}-${index}`} />)}</>;
}
