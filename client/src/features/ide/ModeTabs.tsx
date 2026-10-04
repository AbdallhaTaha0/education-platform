import { IDE_MODES, modeName, type IDEMode } from './types';
export function ModeTabs({ value, onChange, label }: { value: IDEMode; onChange: (mode: IDEMode) => void; label: string }): JSX.Element {
  return <div role="tablist" aria-label={label} className="mb-4 flex flex-wrap gap-2" dir="ltr">
    {IDE_MODES.map((mode, i) => <button type="button" key={mode} role="tab" aria-selected={value === mode} tabIndex={value === mode ? 0 : -1} data-testid={`ide-mode-${mode}`} className={`min-h-[44px] rounded-control border px-4 py-2 font-semibold ${value === mode ? 'border-primary bg-primary text-primary-ink' : 'border-border bg-surface text-ink'}`} onClick={() => onChange(mode)} onKeyDown={(event) => {
      const next = event.key === 'ArrowRight' ? (i + 1) % 3 : event.key === 'ArrowLeft' ? (i + 2) % 3 : event.key === 'Home' ? 0 : event.key === 'End' ? 2 : null;
      if (next === null) return; event.preventDefault(); onChange(IDE_MODES[next]); (event.currentTarget.parentElement?.children[next] as HTMLElement)?.focus();
    }}>{modeName(mode)}</button>)}
  </div>;
}
