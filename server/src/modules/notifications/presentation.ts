import type { NotificationType } from '@prisma/client';

const COPY: Record<NotificationType, { titleAr: string; titleEn: string; bodyAr: string; bodyEn: string }> = {
  RECHARGE_APPROVED: {
    titleAr: 'تمت الموافقة على طلب الشحن', titleEn: 'Recharge approved',
    bodyAr: 'تمت إضافة الرصيد إلى محفظتك. يمكنك مراجعة الرصيد.',
    bodyEn: 'Your wallet has been credited. You can review the balance.',
  },
  RECHARGE_REJECTED: {
    titleAr: 'تم رفض طلب الشحن', titleEn: 'Recharge request rejected',
    bodyAr: 'راجع القرار في سجل طلبات الشحن.', bodyEn: 'Review the decision in your recharge history.',
  },
  COURSE_PUBLISHED: {
    titleAr: 'دورة جديدة متاحة', titleEn: 'A new course is available',
    bodyAr: 'تعرّف على الدورة وخيارات الاشتراك.', bodyEn: 'Explore the course and its subscription options.',
  },
  SUBSCRIPTION_EXPIRED: {
    titleAr: 'انتهى الاشتراك', titleEn: 'Subscription expired',
    bodyAr: 'انتهت مدة وصولك إلى الدورة. راجع خيارات التجديد.',
    bodyEn: 'Your access period has ended. Review renewal options.',
  },
};

export interface PresentationRow {
  id: string; recipientSequence: bigint; createdAt: Date; occurredAt: Date; expiresAt: Date; readAt: Date | null;
  audience: { event: { type: NotificationType; courseId: string | null; schemaVersion: number } };
}

/** Explicit projection: event keys, audience, delivery fields and source IDs never reach the client. */
export function presentNotification(row: PresentationRow, publicCourses: ReadonlyMap<string, string>) {
  const event = row.audience.event;
  const slug = event.courseId === null ? undefined : publicCourses.get(event.courseId);
  const target = event.type === 'RECHARGE_APPROVED' || event.type === 'RECHARGE_REJECTED'
    ? { kind: 'WALLET' as const }
    : slug === undefined ? null : { kind: 'COURSE_OFFER' as const, slug };
  return {
    id: row.id, type: event.type, schemaVersion: event.schemaVersion, sequence: row.recipientSequence.toString(),
    ...COPY[event.type], createdAt: row.createdAt.toISOString(), occurredAt: row.occurredAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(), readAt: row.readAt?.toISOString() ?? null, target,
  };
}
