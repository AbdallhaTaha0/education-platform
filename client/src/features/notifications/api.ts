import { apiFetch } from '../../auth';
import type { InboxMetadata, InboxPage, NotificationApi, ReadAllResult, ReadResult } from './types';

export const notificationApi: NotificationApi = {
  async list(unreadOnly, cursor) {
    const query = new URLSearchParams({ limit: '20', unreadOnly: String(unreadOnly) });
    if (cursor !== undefined) query.set('cursor', cursor);
    return (await apiFetch<{ data: InboxPage }>(`/notifications?${query}`)).data;
  },
  async count() {
    return (await apiFetch<{ data: InboxMetadata }>('/notifications/unread-count')).data;
  },
  async read(id, read) {
    return (await apiFetch<{ data: ReadResult }>(`/notifications/${encodeURIComponent(id)}/read-state`,
      { method: 'PUT', body: { read }, retryOnAuth: true })).data;
  },
  async readAll(throughSequence) {
    return (await apiFetch<{ data: ReadAllResult }>('/notifications/read-all',
      { method: 'POST', body: { throughSequence }, retryOnAuth: true })).data;
  },
};
