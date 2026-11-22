import { apiFetch, ApiError, readCsrfCookie } from '../../auth';
import type { InboxStore } from './inbox';

export type ConnectionState = 'connecting' | 'connected' | 'disconnected';

/**
 * Native WebSocket client for Cloudflare UserRealtimeDurableObject
 * (`/api/notifications/ws?csrf=<token>`) with exponential backoff reconnect
 * and automatic HTTP polling fallback when WebSockets are unavailable.
 */
export function connectInbox(
  store: InboxStore,
  connection: (state: ConnectionState) => void,
  authFailed: (code: string) => void,
) {
  let disposed = false;
  let refreshing = false;
  let dirty = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  let ws: WebSocket | null = null;
  let attempt = 0;

  const synchronize = () => {
    dirty = true;
    if (timer || disposed) return;
    timer = setTimeout(() => {
      timer = undefined;
      if (!disposed && dirty) {
        dirty = false;
        store.synchronize();
      }
    }, 100);
  };

  async function reauthenticate() {
    if (disposed || refreshing) return;
    refreshing = true;
    try {
      await apiFetch('/auth/me');
      if (!disposed) {
        store.synchronize();
        attempt = 0;
        openSocket();
      }
    } catch (error) {
      if (!disposed && error instanceof ApiError && error.status === 401) {
        authFailed(error.code);
      }
    } finally {
      refreshing = false;
    }
  }

  function scheduleReconnect() {
    if (disposed || reconnectTimer) return;
    const delay = Math.min(30_000, 1_000 * 2 ** Math.min(attempt, 5));
    attempt += 1;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = undefined;
      if (!disposed && navigator.onLine) {
        openSocket();
      }
    }, delay);
  }

  function openSocket() {
    if (disposed || typeof WebSocket === 'undefined') return;
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;
    const csrf = readCsrfCookie() ?? '';
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${window.location.host}/api/notifications/ws?csrf=${encodeURIComponent(csrf)}`;
    connection('connecting');
    try {
      const socket = new WebSocket(wsUrl);
      ws = socket;
      socket.onopen = () => {
        if (disposed) {
          socket.close();
          return;
        }
        attempt = 0;
        connection('connected');
        synchronize();
      };
      socket.onmessage = (event) => {
        if (disposed || typeof event.data !== 'string') return;
        try {
          const msg = JSON.parse(event.data) as { event?: string; data?: Record<string, unknown> };
          if (msg.event === 'notifications:changed') {
            const sig = msg.data;
            if (
              sig &&
              sig.schemaVersion === 1 &&
              typeof sig.revision === 'string' &&
              /^\d{1,20}$/.test(sig.revision)
            ) {
              synchronize();
            }
          } else if (msg.event === 'notifications:reauthenticate') {
            void reauthenticate();
          } else if (msg.event === 'assessment:completed') {
            const subId = msg.data?.submissionId;
            if (
              typeof subId === 'string' &&
              /^[a-f\d]{8}(-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(subId)
            ) {
              window.dispatchEvent(new CustomEvent('fayq-assessment-completed', { detail: subId }));
            }
          }
        } catch {
          // Ignore malformed messages.
        }
      };
      socket.onerror = () => {
        if (!disposed) connection('disconnected');
      };
      socket.onclose = (ev) => {
        if (ws === socket) ws = null;
        if (disposed) return;
        connection('disconnected');
        if (ev.code === 1008) {
          void reauthenticate();
        } else {
          scheduleReconnect();
        }
      };
    } catch {
      connection('disconnected');
      scheduleReconnect();
    }
  }

  const recovery = setInterval(() => {
    if (!disposed && navigator.onLine && document.visibilityState === 'visible') {
      store.synchronize();
      if (!ws || ws.readyState === WebSocket.CLOSED) openSocket();
    }
  }, 30_000);

  openSocket();

  return () => {
    disposed = true;
    clearInterval(recovery);
    clearTimeout(timer);
    clearTimeout(reconnectTimer);
    if (ws) {
      ws.onopen = null;
      ws.onmessage = null;
      ws.onerror = null;
      ws.onclose = null;
      ws.close();
      ws = null;
    }
  };
}
