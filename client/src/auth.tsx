/**
 * Cookie-session API client. Auth credentials (edu_access/edu_refresh) are
 * HttpOnly: this module NEVER reads them, only sends them implicitly via
 * `credentials: 'include'`. The only cookie value ever read is the
 * JavaScript-readable CSRF synchronizer (edu_csrf). Nothing auth-related is
 * written to localStorage, sessionStorage, or IndexedDB — only the language
 * preference (owned by i18n.tsx).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { LanguageProvider, useLang } from './i18n';

const API_BASE: string = (import.meta.env['VITE_API_BASE'] as string | undefined) || '/api';
const CSRF_COOKIE = 'edu_csrf';
const CSRF_HEADER = 'x-csrf-token';

export interface SafeUser {
  id: string;
  email: string;
  phone: string;
  displayName: string;
  role: 'STUDENT' | 'ADMIN';
  createdAt: string;
}

export interface ApiFailure {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export class ApiError extends Error {
  status: number;
  code: string;
  details?: Record<string, unknown>;

  constructor(status: number, code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

/** Read ONLY the CSRF synchronizer value. Auth cookies are HttpOnly and
 * therefore invisible here by construction. */
export function readCsrfCookie(): string | null {
  const match = document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${CSRF_COOKIE}=`));
  return match ? decodeURIComponent(match.slice(CSRF_COOKIE.length + 1)) : null;
}

async function ensureCsrf(): Promise<string> {
  const existing = readCsrfCookie();
  if (existing) return existing;
  const res = await fetch(`${API_BASE}/auth/csrf`, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new ApiError(res.status, 'SERVICE_ERROR', 'Service unavailable.');
  const token = readCsrfCookie();
  if (!token) throw new ApiError(res.status, 'SERVICE_ERROR', 'Service unavailable.');
  return token;
}

async function parseFailure(res: Response): Promise<ApiFailure> {
  try {
    const body = (await res.json()) as {
      error?: { code?: string; message?: string; details?: Record<string, unknown> };
    };
    return {
      code: body.error?.code ?? 'SERVICE_ERROR',
      message: body.error?.message ?? 'Service unavailable.',
      details: body.error?.details,
    };
  } catch {
    return { code: 'SERVICE_ERROR', message: 'Service unavailable.' };
  }
}

const STATE_CHANGING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** Coordinated refresh: at most one in-flight attempt shared by all callers.
 * Prevents refresh storms and infinite retry loops (single retry only). */
let refreshPromise: Promise<boolean> | null = null;

function refreshOnce(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const csrf = await ensureCsrf();
        const res = await fetch(`${API_BASE}/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
          headers: { Accept: 'application/json', [CSRF_HEADER]: csrf },
        });
        return res.ok;
      } catch {
        return false;
      } finally {
        refreshPromise = null;
      }
    })();
  }
  return refreshPromise;
}

export interface ApiOptions {
  method?: string;
  body?: Record<string, unknown>;
  /** Retry once via refresh when the session may have expired. Default true for GET. */
  retryOnAuth?: boolean;
}

const REFRESHABLE = new Set(['SESSION_EXPIRED', 'TOKEN_INVALID', 'TOKEN_MISSING']);

/** Cookie transport shared by JSON, downloads and replayable FormData.
 * Mutations may opt in only when a refreshable 401 comes from authentication
 * middleware before business logic. Network/5xx failures are never replayed.
 */
export async function apiResponse(
  path: string,
  options: RequestInit & { retryOnAuth?: boolean } = {},
): Promise<Response> {
  const { retryOnAuth, ...init } = options;
  const method = (init.method ?? 'GET').toUpperCase();
  const attempt = async (): Promise<Response> => {
    const headers = new Headers(init.headers);
    if (!headers.has('Accept')) headers.set('Accept', 'application/json');
    // Refresh may rebind the CSRF cookie. Read it again for the retry.
    if (STATE_CHANGING.has(method)) headers.set(CSRF_HEADER, await ensureCsrf());
    return fetch(`${API_BASE}${path}`, { ...init, method, credentials: 'include', headers });
  };

  let res = await attempt();
  const retry = retryOnAuth ?? method === 'GET';
  if (res.status === 401 && retry) {
    const failure = await parseFailure(res.clone());
    if (REFRESHABLE.has(failure.code) && (await refreshOnce())) {
      res = await attempt();
    } else {
      throw new ApiError(res.status, failure.code, failure.message, failure.details);
    }
  }
  if (!res.ok) {
    const failure = await parseFailure(res);
    throw new ApiError(res.status, failure.code, failure.message, failure.details);
  }
  return res;
}

export async function apiFetch<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const res = await apiResponse(path, {
    method: options.method,
    retryOnAuth: options.retryOnAuth,
    ...(options.body === undefined ? {} : {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options.body),
    }),
  });
  return (await res.json()) as T;
}

export type AuthStatus = 'loading' | 'anonymous' | 'authenticated';

interface AuthContextValue {
  status: AuthStatus;
  user: SafeUser | null;
  lastAuthCode: string | null;
  reload: () => Promise<void>;
  logout: () => Promise<string | null>;
  logoutAll: () => Promise<string | null>;
  /** A protected request has exhausted coordinated refresh and still failed authentication. */
  invalidateSession: (code: string) => void;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }): JSX.Element {
  return (
    <LanguageProvider>
      <AuthInner>{children}</AuthInner>
    </LanguageProvider>
  );
}

function AuthInner({ children }: { children: ReactNode }): JSX.Element {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<SafeUser | null>(null);
  const [lastAuthCode, setLastAuthCode] = useState<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const reload = useCallback(async () => {
    try {
      const body = await apiFetch<{ data: { user: SafeUser } }>('/auth/me', { retryOnAuth: true });
      if (!mounted.current) return;
      setUser(body.data.user);
      setStatus('authenticated');
      setLastAuthCode(null);
    } catch (err) {
      if (!mounted.current) return;
      setUser(null);
      setStatus('anonymous');
      if (err instanceof ApiError) setLastAuthCode(err.code);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const logout = useCallback(async (): Promise<string | null> => {
    try {
      await apiFetch('/auth/logout', { method: 'POST', retryOnAuth: false });
      if (mounted.current) {
        setUser(null);
        setStatus('anonymous');
        setLastAuthCode(null);
      }
      return null;
    } catch (err) {
      // Server logout failed: the session may still be active, so keep the
      // authenticated state and surface the error instead of faking success.
      return err instanceof ApiError ? err.code : 'SERVICE_ERROR';
    }
  }, []);

  const logoutAll = useCallback(async (): Promise<string | null> => {
    try {
      await apiFetch('/auth/logout-all', { method: 'POST', retryOnAuth: false });
      if (mounted.current) {
        setUser(null);
        setStatus('anonymous');
        setLastAuthCode(null);
      }
      return null;
    } catch (err) {
      return err instanceof ApiError ? err.code : 'SERVICE_ERROR';
    }
  }, []);

  const invalidateSession = useCallback((code: string) => {
    if (!mounted.current) return;
    setUser(null);
    setStatus('anonymous');
    setLastAuthCode(code);
  }, []);

  const value = useMemo(
    () => ({ status, user, lastAuthCode, reload, logout, logoutAll, invalidateSession }),
    [status, user, lastAuthCode, reload, logout, logoutAll, invalidateSession],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

export { useLang };
