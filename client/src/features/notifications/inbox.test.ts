import { describe, expect, it, vi } from 'vitest';
import { InboxStore, notificationHref } from './inbox';
import type { InboxMetadata, InboxPage, NotificationApi, NotificationItem } from './types';

const metadata = (revision = '1', unreadCount = 1, throughSequence = '1'): InboxMetadata => ({ revision, unreadCount, throughSequence });
function item(sequence = '1', readAt: string | null = null): NotificationItem {
  return { id: `notice-${sequence}`, sequence, type: 'RECHARGE_APPROVED', schemaVersion: 1,
    titleAr: 'إشعار', titleEn: 'Notice', bodyAr: 'نص', bodyEn: 'Body', readAt,
    createdAt: '2026-10-01T00:00:00.000Z', occurredAt: '2026-10-01T00:00:00.000Z',
    expiresAt: '2027-03-30T00:00:00.000Z', target: { kind: 'WALLET' } };
}
function page(items = [item()], meta = metadata(), nextCursor: string | null = null): InboxPage {
  return { items, nextCursor, ...meta };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}
function setup(overrides: Partial<NotificationApi> = {}) {
  const api: NotificationApi = {
    count: vi.fn(async () => metadata()), list: vi.fn(async () => page()),
    read: vi.fn(async () => ({ item: item('1', '2026-10-01T01:00:00Z'), ...metadata('2', 0) })),
    readAll: vi.fn(async () => ({ changedCount: 1, ...metadata('2', 0) })), ...overrides,
  };
  const invalidated = vi.fn();
  const store = new InboxStore(api, invalidated);
  return { api, invalidated, store };
}
const loaded = (store: InboxStore) => vi.waitFor(() => {
  expect(store.getSnapshot().loaded).toBe(true); expect(store.getSnapshot().loading).toBe(false);
});

describe('transient notification inbox concurrency', () => {
  it('supports the mount/cleanup/remount cycle and ignores the old owner response', async () => {
    const old = deferred<InboxPage>();
    const list = vi.fn().mockReturnValueOnce(old.promise).mockResolvedValue(page([item('2')], metadata('2', 1, '2')));
    const { store } = setup({ list });
    store.open(); store.start(); store.stop();
    expect(store.getSnapshot().items).toEqual([]);
    store.start(); await loaded(store);
    old.resolve(page()); await Promise.resolve();
    expect(store.getSnapshot().items.map((row) => row.id)).toEqual(['notice-2']);
    store.stop();
  });
  it('never restores a disposed inbox from a late read response or late authentication failure', async () => {
    const pending = deferred<ReturnType<NotificationApi['read']> extends Promise<infer T> ? T : never>();
    const { store, invalidated } = setup({ read: () => pending.promise });
    store.start(); store.open(); await loaded(store);
    const action = store.setRead('notice-1', true); store.stop();
    pending.reject(Object.assign(new Error('revoked'), { status: 401, code: 'SESSION_REVOKED' }));
    await action;
    expect(store.getSnapshot().items).toEqual([]); expect(store.getSnapshot().unreadCount).toBeNull();
    expect(invalidated).not.toHaveBeenCalled();
  });
  it('compares exact revisions and prevents a delayed count from rolling back a mutation', async () => {
    const pending = deferred<InboxMetadata>();
    const big = '9007199254741001';
    const { store } = setup({ count: () => pending.promise,
      list: vi.fn().mockResolvedValueOnce(page([item()], metadata('9007199254741000')))
        .mockResolvedValue(page([item('1', '2026-10-01T01:00:00Z')], metadata(big, 0))),
      read: async () => ({ item: item('1', '2026-10-01T01:00:00Z'), ...metadata(big, 0) }),
    });
    store.start(); store.open(); await loaded(store); await store.setRead('notice-1', true);
    pending.resolve(metadata('9007199254740999', 9)); await Promise.resolve();
    expect(store.getSnapshot()).toMatchObject({ revision: big, unreadCount: 0 }); store.stop();
  });
  it('rejects a delayed all-items page after switching to unread-only', async () => {
    const pending = deferred<InboxPage>();
    const { store } = setup({ list: vi.fn().mockReturnValueOnce(pending.promise).mockResolvedValue(page([])) });
    store.start(); store.open(); store.setFilter(true); await loaded(store);
    pending.resolve(page([item('1', '2026-10-01T01:00:00Z')])); await Promise.resolve();
    expect(store.getSnapshot()).toMatchObject({ unreadOnly: true, items: [] }); store.stop();
  });
  it('uses the observed inbox fence even when a count reports a later arrival', async () => {
    let after = false;
    const readAll = vi.fn(async () => { after = true; return { changedCount: 1, ...metadata('3', 1, '2') }; });
    const { store } = setup({ count: async () => metadata('2', 2, '2'), readAll,
      list: async () => after ? page([item('2'), item('1', '2026-10-01T01:00:00Z')], metadata('3', 1, '2'))
        : page([item()], metadata('2', 2, '1')),
    });
    store.start(); store.open(); await loaded(store); await store.refreshCount();
    await store.readAll();
    expect(readAll).toHaveBeenCalledWith('1');
    expect(store.getSnapshot().items.find((row) => row.sequence === '2')?.readAt).toBeNull();
    expect(store.getSnapshot().unreadCount).toBe(1); store.stop();
  });
  it('does not optimistically mark a failed write or invent a successful unread count', async () => {
    const pending = deferred<never>();
    const { store } = setup({ read: () => pending.promise });
    store.start(); store.open(); await loaded(store);
    const action = store.setRead('notice-1', true);
    expect(store.getSnapshot().items[0].readAt).toBeNull(); expect(store.getSnapshot().unreadCount).toBe(1);
    pending.reject(new Error('offline')); await action;
    expect(store.getSnapshot()).toMatchObject({ unreadCount: 1, actionError: 'SERVICE_ERROR', busy: null });
    expect(store.getSnapshot().items[0].readAt).toBeNull(); store.stop();
  });
  it('keeps a confirmed read change if the subsequent refresh fails', async () => {
    const { store } = setup({ list: vi.fn().mockResolvedValueOnce(page()).mockRejectedValue(new Error('offline')) });
    store.start(); store.open(); await loaded(store); await store.setRead('notice-1', true);
    expect(store.getSnapshot().items[0].readAt).not.toBeNull();
    expect(store.getSnapshot()).toMatchObject({ unreadCount: 0, error: 'SERVICE_ERROR', busy: null }); store.stop();
  });
  it('preserves the loaded window during refresh and deduplicates page overlap', async () => {
    const rows = Array.from({ length: 40 }, (_, index) => item(String(40 - index)));
    const list = vi.fn(async (_unread: boolean, cursor?: string) => cursor === undefined
      ? page(rows.slice(0, 20), metadata('1', 40, '40'), '21')
      : page([rows[19], ...rows.slice(20)], metadata('1', 40, '40')));
    const { store } = setup({ list, count: async () => metadata('1', 40, '40') });
    store.start(); store.open(); await loaded(store); await store.loadMore();
    expect(store.getSnapshot().items).toHaveLength(40); await store.refresh();
    expect(store.getSnapshot().items).toHaveLength(40);
    expect(new Set(store.getSnapshot().items.map((row) => row.id)).size).toBe(40); store.stop();
  });
  it('bounds retries for persistently stale snapshots instead of looping requests', async () => {
    const list = vi.fn(async () => page());
    const { store } = setup({ list, count: async () => metadata('3', 1) });
    store.start(); await store.refreshCount(); store.open();
    await vi.waitFor(() => expect(store.getSnapshot().error).toBe('SERVICE_ERROR'));
    expect(list).toHaveBeenCalledTimes(2); store.stop();
  });
  it('clears all private state on final 401 and invokes the existing auth invalidation once', async () => {
    const { store, invalidated } = setup({ list: vi.fn().mockResolvedValueOnce(page())
      .mockRejectedValue(Object.assign(new Error('denied'), { status: 401, code: 'SESSION_REVOKED' })) });
    store.start(); store.open(); await loaded(store); await store.refresh();
    expect(store.getSnapshot().items).toEqual([]); expect(store.getSnapshot().unreadCount).toBeNull();
    expect(invalidated).toHaveBeenCalledExactlyOnceWith('SESSION_REVOKED');
  });
  it('reports a count failure as unavailable and recovers on a later synchronization', async () => {
    const { store } = setup({ count: vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(metadata('2', 5, '5')) });
    store.start(); await vi.waitFor(() => expect(store.getSnapshot().countError).toBe('SERVICE_ERROR'));
    expect(store.getSnapshot().unreadCount).toBeNull(); await store.refreshCount();
    expect(store.getSnapshot()).toMatchObject({ countError: null, unreadCount: 5 }); store.stop();
  });
});

describe('notification destinations', () => {
  it('keeps targets inside fixed public routes and rejects arbitrary or unavailable destinations', () => {
    expect(notificationHref(item())).toBe('#/wallet');
    expect(notificationHref({ ...item(), target: { kind: 'COURSE_OFFER', slug: 'safe-course' } })).toBe('#/courses/safe-course');
    expect(notificationHref({ ...item(), target: null })).toBeNull();
    for (const slug of ['javascript:alert(1)', 'https://evil.test', '../learn/private', 'course#token', 'x'.repeat(121)]) {
      expect(notificationHref({ ...item(), target: { kind: 'COURSE_OFFER', slug } })).toBeNull();
    }
  });
});
