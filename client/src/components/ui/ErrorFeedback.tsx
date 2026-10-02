import { createContext, useCallback, useContext, useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useLang } from '../../i18n';

interface Feedback { id: string; content: ReactNode }
interface FeedbackActions { show: (id: string, content: ReactNode) => void; remove: (id: string) => void }
const Context = createContext<FeedbackActions | null>(null);

/** In-memory action feedback; never stores errors or credentials in browser storage. */
export function ErrorFeedbackProvider({ children }: { children: ReactNode }): JSX.Element {
  const { lang } = useLang();
  const [messages, setMessages] = useState<Feedback[]>([]);
  const show = useCallback((id: string, content: ReactNode) => {
    setMessages((current) => [...current.filter((message) => message.id !== id), { id, content }]);
  }, []);
  const remove = useCallback((id: string) => setMessages((current) => current.filter((message) => message.id !== id)), []);
  const actions = useMemo(() => ({ show, remove }), [show, remove]);
  return <Context.Provider value={actions}>{children}{messages.length ? createPortal(
    <div className="error-feedback-stack" data-testid="error-feedback-stack" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      {messages.map((message) => <div key={message.id} role="alert" className="error-feedback-message">
        <span aria-hidden="true" className="font-bold">!</span>
        <div className="min-w-0 flex-1 break-words">{message.content}</div>
        <button type="button" className="error-feedback-close" aria-label={lang === 'ar' ? 'إغلاق رسالة الخطأ' : 'Dismiss error message'} onClick={() => remove(message.id)}>×</button>
      </div>)}
    </div>, document.body) : null}</Context.Provider>;
}

export function ErrorFeedback({ children }: { children: ReactNode }): JSX.Element | null {
  const actions = useContext(Context); const id = useId();
  useEffect(() => {
    if (!actions) return;
    actions.show(id, children);
    return () => actions.remove(id);
  }, [actions, id, children]);
  // Keep isolated component renderers usable without the application provider.
  return actions ? null : <div role="alert" className="mb-4 rounded-control border border-error-fg bg-error-bg px-4 py-3 text-error-fg">{children}</div>;
}
