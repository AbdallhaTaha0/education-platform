import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, type ReactNode } from 'react';

type Blocker = () => string | null;
const Context = createContext<{ register: (id: string, blocker: Blocker) => () => void; confirmLeave: () => boolean } | null>(null);

/** Guards in-memory admin drafts; no content or session data is stored locally. */
export function UnsavedChangesProvider({ children }: { children: ReactNode }): JSX.Element {
  const blockers = useRef(new Map<string, Blocker>());
  const register = useCallback((id: string, blocker: Blocker) => {
    blockers.current.set(id, blocker);
    return () => { blockers.current.delete(id); };
  }, []);
  const confirmLeave = useCallback(() => {
    const message = [...blockers.current.values()].map((blocker) => blocker()).find(Boolean);
    return !message || window.confirm(message);
  }, []);
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent): void => {
      if ([...blockers.current.values()].some((blocker) => blocker())) {
        event.preventDefault(); event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, []);
  const value = useMemo(() => ({ register, confirmLeave }), [register, confirmLeave]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useConfirmNavigation(): () => boolean {
  return useContext(Context)?.confirmLeave ?? (() => true);
}

export function useUnsavedChanges(dirty: boolean, message: string): () => boolean {
  const context = useContext(Context); const id = useId();
  const current = useRef({ dirty, message }); current.current = { dirty, message };
  useEffect(() => context?.register(id, () => current.current.dirty ? current.current.message : null), [context, id]);
  return () => !current.current.dirty || window.confirm(current.current.message);
}
