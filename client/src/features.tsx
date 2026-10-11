import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

const CodingIde = createContext(false);
/** Backend-owned capability; fail closed while loading or offline. */
export function FeaturesProvider({ children }: { children: ReactNode }): JSX.Element {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    const abort = new AbortController();
    const base = (import.meta.env['VITE_API_BASE'] as string | undefined) || '/api';
    void fetch(`${base}/features`, { signal: abort.signal, credentials: 'include', cache: 'no-store' })
      .then(async (r) => { if (!r.ok) throw new Error('Features unavailable'); return r.json() as Promise<{ data?: { codingIdeEnabled?: boolean } }>; })
      .then((r) => { if (!abort.signal.aborted) setEnabled(r.data?.codingIdeEnabled === true); })
      .catch(() => {});
    return () => abort.abort();
  }, []);
  return <CodingIde.Provider value={enabled}>{children}</CodingIde.Provider>;
}
export const useCodingIde = (): boolean => useContext(CodingIde);
