import type { InboxMetadata, NotificationApi, NotificationItem } from './types';

export interface InboxState {
  items: NotificationItem[];
  unreadCount: number | null;
  revision: string;
  throughSequence: string;
  nextCursor: string | null;
  unreadOnly: boolean;
  loaded: boolean;
  loading: boolean;
  loadingMore: boolean;
  countError: string | null;
  error: string | null;
  actionError: string | null;
  busy: string | null;
}
function initialState(): InboxState {
  return {
    items: [],
    unreadCount: null,
    revision: '0',
    throughSequence: '0',
    nextCursor: null,
    unreadOnly: false,
    loaded: false,
    loading: false,
    loadingMore: false,
    countError: null,
    error: null,
    actionError: null,
    busy: null,
  };
}
function errorInfo(error: unknown): { status: number; code: string } {
  if (error instanceof Error && 'status' in error && 'code' in error) {
    return { status: Number(error.status), code: String(error.code) };
  }
  return { status: 0, code: 'SERVICE_ERROR' };
}
function mergeMetadata(state: InboxState, data: InboxMetadata): Partial<InboxState> {
  // Decimal strings preserve revisions beyond JavaScript's safe integer range.
  return BigInt(data.revision) >= BigInt(state.revision)
    ? { unreadCount: data.unreadCount, revision: data.revision, countError: null }
    : {};
}
export function notificationHref(item: NotificationItem): string | null {
  if (item.target?.kind === 'WALLET') return '#/wallet';
  if (
    item.target?.kind === 'COURSE_OFFER' &&
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.target.slug) &&
    item.target.slug.length <= 120
  )
    return `#/courses/${encodeURIComponent(item.target.slug)}`;
  return null;
}

/** One authenticated owner's transient inbox. No browser storage or credential cache. */
export class InboxStore {
  private state = initialState();
  private listeners = new Set<() => void>();
  private active = false;
  private opened = false;
  private readOnOpen = false;
  private listRequest = 0;
  private countRequest = 0;
  private actionRequest = 0;
  constructor(
    private api: NotificationApi,
    private authFailed: (code: string) => void,
  ) {}
  getSnapshot = (): InboxState => this.state;
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private patch(data: Partial<InboxState>) {
    this.state = { ...this.state, ...data };
    this.listeners.forEach((listener) => listener());
  }
  private failure(error: unknown): string {
    const info = errorInfo(error);
    if (info.status === 401) {
      this.stop();
      this.authFailed(info.code);
    }
    return info.code;
  }
  start() {
    this.active = true;
    void this.refreshCount();
    if (this.opened) void this.refresh();
  }
  stop() {
    this.readOnOpen = false;
    this.active = false;
    this.listRequest++;
    this.countRequest++;
    this.actionRequest++;
    this.state = initialState();
    this.listeners.forEach((listener) => listener());
  }
  open(markRead = false) {
    this.readOnOpen = markRead;
    this.opened = true;
    if (this.active) void this.refresh();
  }
  close() {
    this.readOnOpen = false;
    this.opened = false;
  }
  synchronize() {
    if (!this.active) return;
    if (this.opened) void this.refresh();
    else void this.refreshCount();
  }
  async refreshCount() {
    if (!this.active) return;
    const request = ++this.countRequest;
    try {
      const data = await this.api.count();
      if (this.active && request === this.countRequest) this.patch(mergeMetadata(this.state, data));
    } catch (error) {
      if (!this.active || request !== this.countRequest) return;
      const code = this.failure(error);
      if (this.active) this.patch({ countError: code });
    }
  }
  async refresh(clearActionError = true, retryStale = true) {
    if (!this.active) return;
    const request = ++this.listRequest;
    const unreadOnly = this.state.unreadOnly;
    const targetLength = Math.max(20, this.state.items.length);
    this.patch({
      loading: true,
      loadingMore: false,
      error: null,
      ...(clearActionError ? { actionError: null } : {}),
    });
    try {
      let page = await this.api.list(unreadOnly);
      const throughSequence = page.throughSequence;
      let items = page.items;
      const visited = new Set<string>();
      // Refresh the loaded window rather than collapsing pagination to page one.
      while (items.length < targetLength && page.nextCursor !== null) {
        if (!this.active || request !== this.listRequest) return;
        if (visited.has(page.nextCursor)) throw new Error('Invalid pagination');
        visited.add(page.nextCursor);
        page = await this.api.list(unreadOnly, page.nextCursor);
        const existing = new Set(items.map((item) => item.id));
        items = [...items, ...page.items.filter((item) => !existing.has(item.id))];
      }
      if (!this.active || request !== this.listRequest) return;
      if (BigInt(page.revision) < BigInt(this.state.revision)) {
        if (retryStale) void this.refresh(clearActionError, false);
        else this.patch({ loading: false, error: 'SERVICE_ERROR' });
        return;
      }
      this.countRequest++;
      this.patch({
        items,
        throughSequence,
        nextCursor: page.nextCursor,
        loaded: true,
        loading: false,
        ...mergeMetadata(this.state, page),
      });
      if (this.opened && this.readOnOpen && this.state.busy === null) {
        this.readOnOpen = false;
        // Acknowledge only the inbox snapshot loaded on entry; later notices remain unread.
        if (this.state.unreadCount) await this.readAll();
      }
    } catch (error) {
      if (!this.active || request !== this.listRequest) return;
      const code = this.failure(error);
      if (this.active) this.patch({ loading: false, error: code });
    }
  }
  async loadMore() {
    if (
      !this.active ||
      this.state.loading ||
      this.state.loadingMore ||
      this.state.nextCursor === null
    )
      return;
    const request = ++this.listRequest;
    const cursor = this.state.nextCursor;
    this.patch({ loadingMore: true, error: null });
    try {
      const page = await this.api.list(this.state.unreadOnly, cursor);
      if (!this.active || request !== this.listRequest) return;
      if (BigInt(page.revision) < BigInt(this.state.revision)) {
        void this.refresh(false);
        return;
      }
      const existing = new Set(this.state.items.map((item) => item.id));
      this.patch({
        items: [...this.state.items, ...page.items.filter((item) => !existing.has(item.id))],
        nextCursor: page.nextCursor,
        loadingMore: false,
        ...mergeMetadata(this.state, page),
      });
    } catch (error) {
      if (!this.active || request !== this.listRequest) return;
      const code = this.failure(error);
      if (this.active) this.patch({ loadingMore: false, error: code });
    }
  }
  setFilter(unreadOnly: boolean) {
    if (this.state.unreadOnly === unreadOnly || this.state.busy !== null) return;
    this.listRequest++;
    this.patch({ unreadOnly, items: [], nextCursor: null, throughSequence: '0', loaded: false });
    void this.refresh();
  }
  private async mutate<T extends InboxMetadata>(
    operation: () => Promise<T>,
    itemId: string,
    apply: (data: T) => Partial<InboxState>,
  ) {
    if (!this.active || this.state.busy !== null) return;
    const request = ++this.actionRequest;
    this.listRequest++; // A pre-mutation list must never overwrite the new state.
    this.patch({ busy: itemId, loading: false, loadingMore: false, actionError: null });
    try {
      const data = await operation();
      if (!this.active || request !== this.actionRequest) return;
      this.countRequest++;
      if (BigInt(data.revision) >= BigInt(this.state.revision)) {
        this.patch({ ...apply(data), ...mergeMetadata(this.state, data) });
      }
      await this.refresh(false);
    } catch (error) {
      if (!this.active || request !== this.actionRequest) return;
      const code = this.failure(error);
      if (this.active) {
        this.patch({ actionError: code });
        await this.refresh(false);
      }
    } finally {
      if (this.active && request === this.actionRequest) this.patch({ busy: null });
    }
  }
  setRead(id: string, read: boolean) {
    return this.mutate(
      () => this.api.read(id, read),
      id,
      (data) => ({
        items: this.state.items
          .map((item) => (item.id === id ? data.item : item))
          .filter((item) => !this.state.unreadOnly || item.readAt === null),
      }),
    );
  }
  readAll() {
    // Count responses and later pages never widen the observed first-page fence.
    const fence = this.state.throughSequence;
    if (!this.state.loaded) return Promise.resolve();
    return this.mutate(
      () => this.api.readAll(fence),
      'all',
      () => ({
        items: this.state.items
          .map((item) =>
            BigInt(item.sequence) <= BigInt(fence)
              ? { ...item, readAt: item.readAt ?? new Date().toISOString() }
              : item,
          )
          .filter((item) => !this.state.unreadOnly || item.readAt === null),
      }),
    );
  }
}
