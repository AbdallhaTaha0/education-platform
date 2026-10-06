import { usePublicData } from '../../seo/publicData';
import { Children, useState, useEffect, type ReactNode } from 'react';
import { useLang } from '../../i18n';
import { Button } from './Button';
import { useConfirmNavigation } from './UnsavedChanges';

export interface PageInfo { page: number; pageSize: number; total: number }
export function Pagination({ page, pageSize, total, onPage, onSize, id, disabled = false, hrefForPage }: PageInfo & {
  onPage: (page: number) => void; onSize: (size: number) => void; id: string; disabled?: boolean; hrefForPage?: (page: number) => string;
}): JSX.Element {
  const { lang } = useLang(); const ar = lang === 'ar';
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const number = (value: number) => new Intl.NumberFormat(ar ? 'ar-EG' : 'en-GB').format(value);
  return <nav aria-label={ar ? 'صفحات القائمة' : 'List pages'} data-testid={`pagination-${id}`} className="my-5 flex flex-wrap items-center justify-center gap-3 rounded-control border border-border bg-surface p-3">
    {hrefForPage && page > 1 ? <a className="footer-discovery min-h-[44px] inline-flex items-center" href={hrefForPage(page - 1)} data-testid="page-previous">{ar ? "السابق" : "Previous"}</a> : <Button variant="secondary" disabled={disabled || page <= 1} disabledReason={!disabled && page <= 1 ? (ar ? 'أنت في أول صفحة.' : 'You are on the first page.') : undefined} onClick={() => onPage(page - 1)} data-testid="page-previous">{ar ? 'السابق' : 'Previous'}</Button>}
    <span aria-live="polite" className="text-sm">{ar ? 'صفحة' : 'Page'} {number(page)} / {number(pages)} · {number(total ? (page - 1) * pageSize + 1 : 0)}–{number(Math.min(page * pageSize, total))} {ar ? 'من' : 'of'} {number(total)}</span>
    {hrefForPage && page < pages ? <a className="footer-discovery min-h-[44px] inline-flex items-center" href={hrefForPage(page + 1)} data-testid="page-next">{ar ? "التالي" : "Next"}</a> : <Button variant="secondary" disabled={disabled || page >= pages} disabledReason={!disabled && page >= pages ? (ar ? 'أنت في آخر صفحة.' : 'You are on the last page.') : undefined} onClick={() => onPage(page + 1)} data-testid="page-next">{ar ? 'التالي' : 'Next'}</Button>}
    <label className="flex items-center gap-2 text-sm">{ar ? 'لكل صفحة' : 'Per page'}<select value={pageSize} disabled={disabled} onChange={e => onSize(Number(e.target.value))} className="min-h-[44px] rounded-control border border-border bg-surface px-3 text-ink" data-testid="page-size">{[10,20,50].map(size => <option key={size} value={size}>{number(size)}</option>)}</select></label>
  </nav>;
}

/** For already-loaded collections; hidden pages are not mounted. */
export function PaginatedCollection({ children, as: Wrapper = 'div', className = '', id, resetKey = '', disabled = false }: {
  children: ReactNode; as?: 'div' | 'ul'; className?: string; id: string; resetKey?: string; disabled?: boolean;
}): JSX.Element {
  const items = Children.toArray(children); const confirmLeave = useConfirmNavigation();
  const publicData = usePublicData();
  const crawlPath = publicData?.page === "courses" && id.startsWith("public-") ? "/" + publicData.lang + "/courses" : undefined;
  const [state, setState] = useState({ key: resetKey, page: crawlPath ? publicData!.pageNumber : 1, size: crawlPath ? publicData!.pageSize : 10 });
  const hrefForPage = crawlPath ? (next: number) => crawlPath + (next > 1 ? "?page=" + next : "") + (state.size !== 10 ? (next > 1 ? "&" : "?") + "size=" + state.size : "") : undefined;
  useEffect(() => { setState(current => {
    const next = current.key !== resetKey ? 1 : Math.min(current.page, Math.max(1, Math.ceil(items.length / current.size)));
    return current.key === resetKey && current.page === next ? current : { ...current, key: resetKey, page: next };
  }); }, [resetKey, items.length]);
  const page = Math.min(state.key === resetKey ? state.page : 1, Math.max(1, Math.ceil(items.length / state.size)));
  return <><Wrapper className={className} data-testid={`paged-list-${id}`}>
    {items.slice((page - 1) * state.size, page * state.size)}
  </Wrapper>{items.length > 10 ? <Pagination id={id} page={page} pageSize={state.size} total={items.length} disabled={disabled} hrefForPage={hrefForPage}
    onPage={next => { if (confirmLeave()) setState({ ...state, key: resetKey, page: next }); }}
    onSize={size => { if (!confirmLeave()) return; if (crawlPath) { window.location.assign(crawlPath + (size === 10 ? "" : "?size=" + size)); return; } setState({ key: resetKey, page: 1, size }); }} /> : null}</>;
}
