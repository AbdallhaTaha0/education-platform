import { io } from 'socket.io-client';
import { apiFetch, ApiError, readCsrfCookie } from '../../auth';
import type { InboxStore } from './inbox';

export type ConnectionState = 'connecting' | 'connected' | 'disconnected';
export function connectInbox(store: InboxStore, connection: (state: ConnectionState) => void,
  authFailed: (code: string) => void) {
  // Same Nginx origin and cookie path; no credential, recipient or room in URLs.
  const socket = io('/notifications', { path: '/api/notifications/socket.io/', transports: ['websocket'],
    withCredentials: true, autoConnect: false, reconnectionDelay: 1000, reconnectionDelayMax: 10000,
    auth: (done) => done({ csrf: readCsrfCookie() }),
  });
  let disposed = false, refreshing = false, dirty = false, timer: ReturnType<typeof setTimeout> | undefined;
  const synchronize = () => {
    dirty = true;
    if (timer || disposed) return;
    timer = setTimeout(() => {
      timer = undefined;
      if (!disposed && dirty) { dirty = false; store.synchronize(); }
    }, 100);
  };
  async function reauthenticate() {
    if (disposed || refreshing) return;
    refreshing = true;
    try {
      await apiFetch('/auth/me'); // Existing coordinated refresh, never a second credential cache.
      if (!disposed) { store.synchronize(); socket.connect(); }
    } catch (error) {
      if (!disposed && error instanceof ApiError && error.status === 401) authFailed(error.code);
    } finally { refreshing = false; }
  }
  socket.on('connect', () => { if (!disposed) { connection('connected'); synchronize(); } });
  socket.on('notifications:changed', (signal: unknown) => {
    if (signal && typeof signal === 'object' && 'schemaVersion' in signal && signal.schemaVersion === 1
      && 'revision' in signal && typeof signal.revision === 'string' && /^\d{1,20}$/.test(signal.revision)) synchronize();
  });
  socket.on('notifications:reauthenticate', () => { void reauthenticate(); });
  socket.on('disconnect', (reason) => {
    if (!disposed) { connection('disconnected'); if (reason === 'io server disconnect') void reauthenticate(); }
  });
  socket.on('connect_error', (error: Error & { data?: { code?: string } }) => {
    if (disposed) return;
    connection('disconnected');
    if (['TOKEN_INVALID', 'TOKEN_MISSING', 'SESSION_EXPIRED', 'SESSION_REVOKED', 'CSRF_INVALID'].includes(error.data?.code ?? '')) {
      void reauthenticate();
    }
  });
  const recovery = setInterval(() => {
    if (!disposed && navigator.onLine && document.visibilityState === 'visible') {
      store.synchronize(); if (!socket.connected) socket.connect();
    }
  }, 30000);
  connection('connecting'); socket.connect();
  return () => { disposed = true; clearInterval(recovery); clearTimeout(timer); socket.removeAllListeners(); socket.disconnect(); };
}
