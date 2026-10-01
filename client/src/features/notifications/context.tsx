import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { useAuth } from '../../auth';
import { notificationApi } from './api';
import { InboxStore } from './inbox';
import { connectInbox, type ConnectionState } from './realtime';

const NotificationContext = createContext<InboxStore | null>(null);
const ConnectionContext = createContext<ConnectionState>('disconnected');
export function NotificationsProvider({ children }: { children: ReactNode }): JSX.Element {
  const { status, user, invalidateSession } = useAuth();
  const owner = status === 'authenticated' ? user?.id : undefined;
  const store = useMemo(
    () => new InboxStore(notificationApi, invalidateSession),
    [owner, invalidateSession],
  );
  const [connection, setConnection] = useState<ConnectionState>('disconnected');
  useEffect(() => {
    if (owner === undefined) return;
    store.start();
    const disconnect = connectInbox(store, setConnection, invalidateSession);
    const synchronize = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) store.synchronize();
    };
    window.addEventListener('focus', synchronize);
    window.addEventListener('online', synchronize);
    document.addEventListener('visibilitychange', synchronize);
    return () => {
      disconnect();
      store.stop();
      window.removeEventListener('focus', synchronize);
      window.removeEventListener('online', synchronize);
      document.removeEventListener('visibilitychange', synchronize);
    };
  }, [owner, store]);
  return (
    <ConnectionContext.Provider value={connection}>
      <NotificationContext.Provider value={store}>{children}</NotificationContext.Provider>
    </ConnectionContext.Provider>
  );
}
export function useNotifications() {
  const store = useContext(NotificationContext);
  if (!store) throw new Error('NotificationsProvider is required.');
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot);
  return { store, state, connection: useContext(ConnectionContext) };
}
