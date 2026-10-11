import { useLang } from '../../i18n';
import type { ReactNode } from 'react';

export interface SectionTab { id: string; ar: string; en: string; descriptionAr: string; descriptionEn: string }

/** Local panels use true tabs; route navigation remains ordinary links. */
export function SectionTabs({ tabs, value, onChange, prefix, label, disabled = false, compactMobile = false }: {
  tabs: SectionTab[]; value: string; onChange: (id: string) => boolean | void;
  prefix: string; label: string; disabled?: boolean; compactMobile?: boolean;
}): JSX.Element {
  const { lang } = useLang(); const ar = lang === 'ar';
  return <>
    {compactMobile ? <label className="my-4 block text-sm font-semibold sm:hidden" htmlFor={`${prefix}-mobile`}>
      {label}
      <select id={`${prefix}-mobile`} value={value} disabled={disabled} onChange={event => onChange(event.target.value)}
        className="mt-2 min-h-[48px] w-full rounded-control border border-border-strong bg-field px-3 text-base text-ink">
        {tabs.map(tab => <option key={tab.id} value={tab.id}>{ar ? tab.ar : tab.en}</option>)}
      </select>
    </label> : null}
    <div role="tablist" aria-label={label} className={`my-5 flex-wrap gap-2 ${compactMobile ? 'hidden sm:flex' : 'flex'}`} data-testid={`${prefix}-tabs`}>
    {tabs.map((tab, index) => <button key={tab.id} type="button" role="tab"
      id={`${prefix}-tab-${tab.id}`} aria-controls={`${prefix}-panel-${tab.id}`}
      aria-selected={value === tab.id} tabIndex={value === tab.id ? 0 : -1} disabled={disabled}
      className={`min-h-[44px] rounded-control border px-4 py-3 text-sm font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus ${value === tab.id ? 'border-primary-strong bg-selected text-ink shadow-[inset_0_-3px_0_var(--color-primary-strong)]' : 'border-border-strong bg-surface text-muted hover:bg-interactive hover:text-ink'} disabled:bg-disabled disabled:text-muted`}
      onClick={() => onChange(tab.id)} onKeyDown={event => {
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1
          : event.key === 'ArrowRight' ? (index + (ar ? -1 : 1) + tabs.length) % tabs.length
          : event.key === 'ArrowLeft' ? (index + (ar ? 1 : -1) + tabs.length) % tabs.length : null;
        if (next === null) return;
        event.preventDefault();
        if (onChange(tabs[next].id) !== false) document.getElementById(`${prefix}-tab-${tabs[next].id}`)?.focus();
      }}>{ar ? tab.ar : tab.en}</button>)}
  </div></>;
}

export function SectionPanel({ tab, prefix, active, children }: {
  tab: SectionTab; prefix: string; active: boolean; children: ReactNode;
}): JSX.Element {
  const { lang } = useLang(); const ar = lang === 'ar';
  return <section role="tabpanel" id={`${prefix}-panel-${tab.id}`} aria-labelledby={`${prefix}-tab-${tab.id}`}
    hidden={!active} tabIndex={0} className="rounded-card border border-border bg-surface p-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus sm:p-6">
    <h2 className="text-xl font-bold">{ar ? tab.ar : tab.en}</h2>
    <p className="mb-5 mt-2 text-sm leading-7 text-muted">{ar ? tab.descriptionAr : tab.descriptionEn}</p>
    {children}
  </section>;
}
