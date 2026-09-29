import { apiFetch } from '../../../auth';
import type { PaymentInstruction, RechargeRequestView, WalletView } from '../types/models';

export async function fetchWallet(): Promise<WalletView> {
  const body = await apiFetch<{ data: WalletView }>('/wallet', { retryOnAuth: true });
  return body.data;
}

export async function fetchInstructions(): Promise<PaymentInstruction[]> {
  const body = await apiFetch<{ data: { channels: PaymentInstruction[] } }>('/wallet/instructions', { retryOnAuth: true });
  return body.data.channels;
}

export interface RechargeSubmit {
  amountPiastres: number;
  channel: string;
  reference: string;
  senderName: string;
  senderPhone: string;
  transferDate: string;
  proofFilename: string;
  proofMime: string;
  proofBase64: string;
  idempotencyKey: string;
}

export async function submitRecharge(input: RechargeSubmit): Promise<RechargeRequestView> {
  const body = await apiFetch<{ data: RechargeRequestView }>('/wallet/recharge-requests', {
    method: 'POST',
    retryOnAuth: false,
    body: { ...input },
  });
  return body.data;
}

export async function fetchMyRequests(): Promise<RechargeRequestView[]> {
  const body = await apiFetch<{ data: { requests: RechargeRequestView[] } }>('/wallet/recharge-requests', { retryOnAuth: true });
  return body.data.requests;
}

export async function fetchAdminQueue(status?: string): Promise<import('../types/models').AdminRechargeRow[]> {
  const query = status ? `?status=${encodeURIComponent(status)}` : '';
  const body = await apiFetch<{ data: { requests: import('../types/models').AdminRechargeRow[] } }>(
    `/admin/recharge-requests${query}`,
    { retryOnAuth: true },
  );
  return body.data.requests;
}

export async function reviewRequest(id: string, input: { decision: 'APPROVE' | 'REJECT'; reason?: string; receiptVerified: boolean }): Promise<void> {
  await apiFetch(`/admin/recharge-requests/${encodeURIComponent(id)}/review`, {
    method: 'POST',
    retryOnAuth: false,
    body: input,
  });
}

export function proofUrl(id: string): string {
  const base = (import.meta.env['VITE_API_BASE'] as string | undefined) || '/api';
  return `${base}/admin/recharge-requests/${encodeURIComponent(id)}/proof`;
}

export async function runProofCleanup(): Promise<{ examined: number; cleared: number }> {
  const body = await apiFetch<{ data: { examined: number; cleared: number } }>('/admin/maintenance/proof-cleanup', {
    method: 'POST',
    retryOnAuth: false,
    body: {},
  });
  return body.data;
}
