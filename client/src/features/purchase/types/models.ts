export interface PurchaseReceipt {
  id: string;
  planId: string;
  courseId: string;
  pricePiastres: number;
  durationDays: number;
  createdAt: string;
  subscription: { id: string; startsAt: string; expiresAt: string };
}

export interface PurchaseHistoryRow extends Omit<PurchaseReceipt, 'subscription'> {
  subscription: { id: string; startsAt: string; expiresAt: string } | null;
}

export interface SubscriptionView {
  id: string;
  courseId: string;
  purchaseId: string;
  startsAt: string;
  expiresAt: string;
}
