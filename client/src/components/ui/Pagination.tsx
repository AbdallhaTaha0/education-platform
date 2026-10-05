import { Children, useState, useEffect, type ReactNode } from 'react';
import { useLang } from '../../i18n';
import { Button } from './Button';
import { useConfirmNavigation } from './UnsavedChanges';

export interface PageInfo { page: number; pageSize: number; total: number }
export function Pagination({ page, pageSize, total, onPage, onSize, id, disabled = false }: PageInfo & {
  onPage: (page: number) => void; onSize: (size: number) => void; id: string; disabled?: boolean;
}): JSX.Element {
  const { lang } = useLang(); const ar = lang === 'ar';
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const number = (value: number) => new Intl.NumberFormat(ar ? 'ar-EG' : 'en-GB').format(value);
  return <nav aria-label={ar ? 'صفحات القائمة' : 'List pages'} data-testid={`pagination-${id}`} className="my-5 flex flex-wrap items-center justify-center gap-3 rounded-control border border-border bg-surface p-3">
    <Button variant="secondary" disabled={disabled || page <= 1} onClick={() => onPage(page - 1)} data-testid="page-previous">{ar ? 'السابق' : 'Previous'}</Button>
    <span aria-live="polite" className="text-sm">{ar ? 'صفحة' : 'Page'} {number(page)} / {number(pages)} · {number(total ? (page - 1) * pageSize + 1 : 0)}–{number(Math.min(page * pageSize, total))} {ar ? 'من' : 'of'} {number(total)}</span>
    <Button variant="secondary" disabled={disabled || page >= pages} onClick={() => onPage(page + 1)} data-testid="page-next">{ar ? 'التالي' : 'Next'}</Button>
    <label className="flex items-center gap-2 text-sm">{ar ? 'لكل صفحة' : 'Per page'}<select value={pageSize} disabled={disabled} onChange={e => onSize(Number(e.target.value))} className="min-h-[44px] rounded-control border border-border bg-surface px-3 text-ink" data-testid="page-size">{[10,20,50].map(size => <option key={size} value={size}>{number(size)}</option>)}</select></label>
  </nav>;
}

/** For already-loaded collections; hidden pages are not mounted. */
export function PaginatedCollection({ children, as: Wrapper = 'div', className = '', id, resetKey = '', disabled = false }: {
  children: ReactNode; as?: 'div' | 'ul'; className?: string; id: string; resetKey?: string; disabled?: boolean;
}): JSX.Element {
  const items = Children.toArray(children); const confirmLeave = useConfirmNavigation();
  const [state, setState] = useState({ key: resetKey, page: 1, size: 10 });
  useEffect(() => { setState(current => {
    const next = current.key !== resetKey ? 1 : Math.min(current.page, Math.max(1, Math.ceil(items.length / current.size)));
    return current.key === resetKey && current.page === next ? current : { ...current, key: resetKey, page: next };
  }); }, [resetKey, items.length]);
  const page = Math.min(state.key === resetKey ? state.page : 1, Math.max(1, Math.ceil(items.length / state.size)));
  return <><Wrapper className={className} data-testid={`paged-list-${id}`}>
    {items.slice((page - 1) * state.size, page * state.size)}
  </Wrapper>{items.length > 10 ? <Pagination id={id} page={page} pageSize={state.size} total={items.length} disabled={disabled}
    onPage={next => { if (confirmLeave()) setState({ ...state, key: resetKey, page: next }); }}
    onSize={size => { if (confirmLeave()) setState({ key: resetKey, page: 1, size }); }} /> : null}</>;
}
