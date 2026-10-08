import { createContext, useCallback, useContext, useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useLang } from '../../i18n';

type FeedbackKind = 'error' | 'success';
interface Feedback { id: string; content: ReactNode; kind: FeedbackKind }
interface FeedbackActions { show: (id: string, content: ReactNode, kind: FeedbackKind) => void; remove: (id: string) => void }
const Context = createContext<FeedbackActions | null>(null);

/** In-memory action feedback; never stores errors or credentials in browser storage. */
export function FeedbackProvider({ children }: { children: ReactNode }): JSX.Element {
  const { lang } = useLang();
  const [messages, setMessages] = useState<Feedback[]>([]);
  const show = useCallback((id: string, content: ReactNode, kind: FeedbackKind) => {
    setMessages((current) => [...current.filter((message) => message.id !== id), { id, content, kind }]);
  }, []);
  const remove = useCallback((id: string) => setMessages((current) => current.filter((message) => message.id !== id)), []);
  const actions = useMemo(() => ({ show, remove }), [show, remove]);
  return <Context.Provider value={actions}>{children}{messages.length ? createPortal(
    <div className="pointer-events-none fixed bottom-[calc(1rem+env(safe-area-inset-bottom,0px))] end-4 z-[60] flex max-h-[min(45vh,24rem)] w-[min(28rem,calc(100vw-2rem))] flex-col gap-3 overflow-y-auto max-lg:bottom-[calc(7rem+env(safe-area-inset-bottom,0px))]" data-testid="error-feedback-stack" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      {messages.map((message) => <div key={message.id} role={message.kind === 'error' ? 'alert' : 'status'} data-testid={`${message.kind}-feedback-message`} className={`pointer-events-auto flex items-start gap-3 rounded-control border p-3 shadow-[0_8px_24px_rgb(0_0_0_/_20%)] ${message.kind === 'success' ? 'border-success-fg bg-success-bg text-success-fg' : 'border-error-fg bg-error-bg text-error-fg'}`}>
        <span aria-hidden="true" className="font-bold">{message.kind === 'success' ? '✓' : '!'}</span>
        <div className="min-w-0 flex-1 break-words">{message.content}</div>
        <button type="button" className="min-h-[44px] min-w-[44px] flex-none rounded-control text-2xl" aria-label={message.kind === 'success' ? (lang === 'ar' ? 'إغلاق رسالة النجاح' : 'Dismiss success message') : (lang === 'ar' ? 'إغلاق رسالة الخطأ' : 'Dismiss error message')} onClick={() => remove(message.id)}>×</button>
      </div>)}
    </div>, document.body) : null}</Context.Provider>;
}

function ActionFeedback({ children, kind }: { children: ReactNode; kind: FeedbackKind }): JSX.Element | null {
  const actions = useContext(Context); const id = useId();
  useEffect(() => {
    if (!actions) return;
    actions.show(id, children, kind);
    return () => actions.remove(id);
  }, [actions, id, children, kind]);
  // Keep isolated component renderers usable without the application provider.
  return actions ? null : <div role={kind === 'error' ? 'alert' : 'status'} className={`mb-4 rounded-control border px-4 py-3 ${kind === 'error' ? 'border-error-fg bg-error-bg text-error-fg' : 'border-success-fg bg-success-bg text-success-fg'}`}>{children}</div>;
}

export const ErrorFeedbackProvider = FeedbackProvider;
export function ErrorFeedback({ children }: { children: ReactNode }) { return <ActionFeedback kind="error">{children}</ActionFeedback>; }
export function SuccessFeedback({ children }: { children: ReactNode }) { return <ActionFeedback kind="success">{children}</ActionFeedback>; }

/** Action confirmation survives a form closing or a successful navigation. */
export function useSuccessFeedback(): (content: ReactNode) => void {
  const actions = useContext(Context);
  const id = useId();
  return useCallback((content: ReactNode) => { actions?.show(id, content, 'success'); }, [actions, id]);
}
