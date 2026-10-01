export type NotificationType = 'RECHARGE_APPROVED' | 'RECHARGE_REJECTED' | 'COURSE_PUBLISHED' | 'SUBSCRIPTION_EXPIRED';
export interface NotificationItem {
  id: string;
  type: NotificationType;
  schemaVersion: 1;
  sequence: string;
  titleAr: string;
  titleEn: string;
  bodyAr: string;
  bodyEn: string;
  createdAt: string;
  occurredAt: string;
  expiresAt: string;
  readAt: string | null;
  target: { kind: 'WALLET' } | { kind: 'COURSE_OFFER'; slug: string } | null;
}
export interface InboxMetadata { unreadCount: number; revision: string; throughSequence: string }
export interface InboxPage extends InboxMetadata { items: NotificationItem[]; nextCursor: string | null }
export interface ReadResult extends InboxMetadata { item: NotificationItem }
export interface ReadAllResult extends InboxMetadata { changedCount: number }
export interface NotificationApi {
  list: (unreadOnly: boolean, cursor?: string) => Promise<InboxPage>;
  count: () => Promise<InboxMetadata>;
  read: (id: string, read: boolean) => Promise<ReadResult>;
  readAll: (throughSequence: string) => Promise<ReadAllResult>;
}
