export interface PurchaseReceipt {
  id: string;
  planId: string;
  courseId: string;
  pricePiastres: number;
  durationDays: number | null;
  accessMode?: 'DURATION' | 'TERM_END' | 'YEAR_END' | 'UNTIL_REMOVAL';
  accessEndsAt?: string | null;
  createdAt: string;
  subscription: { id: string; startsAt: string; expiresAt: string | null };
}

export interface PurchaseHistoryRow extends Omit<PurchaseReceipt, 'subscription'> {
  subscription: { id: string; startsAt: string; expiresAt: string | null } | null;
}

export interface SubscriptionView {
  id: string;
  courseId: string;
  purchaseId: string | null;
  packagePurchaseId?: string | null;
  startsAt: string;
  expiresAt: string | null;
}
