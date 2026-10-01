import { apiFetch } from '../../../auth';
import { newIdempotencyKey } from '../../../utils';
import type { PurchaseHistoryRow, PurchaseReceipt, SubscriptionView } from '../types/models';

export { newIdempotencyKey };

export async function purchaseCourse(
  planId: string,
  idempotencyKey: string,
): Promise<PurchaseReceipt> {
  const body = await apiFetch<{ data: PurchaseReceipt }>('/wallet/purchases', {
    method: 'POST',
    retryOnAuth: false,
    body: { planId, idempotencyKey },
  });
  return body.data;
}

export async function fetchMyPurchases(): Promise<PurchaseHistoryRow[]> {
  const body = await apiFetch<{ data: { purchases: PurchaseHistoryRow[] } }>('/wallet/purchases', {
    retryOnAuth: true,
  });
  return body.data.purchases;
}

export async function fetchMySubscriptions(): Promise<SubscriptionView[]> {
  const body = await apiFetch<{ data: { subscriptions: SubscriptionView[] } }>(
    '/wallet/subscriptions',
    { retryOnAuth: true },
  );
  return body.data.subscriptions;
}
