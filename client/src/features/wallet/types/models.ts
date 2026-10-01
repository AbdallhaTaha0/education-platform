export type RechargeChannel = 'INSTAPAY' | 'BANK_TRANSFER' | 'MOBILE_WALLET';
export type RechargeStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface WalletView {
  balancePiastres: number;
  updatedAt: string;
}

export interface PaymentInstruction {
  channel: RechargeChannel;
  accountLabel: string;
  instructionsAr: string;
  instructionsEn: string;
}

export interface RechargeRequestView {
  id: string;
  amountPiastres: number;
  channel: RechargeChannel;
  status: RechargeStatus;
  createdAt: string;
  reviewedAt: string | null;
  rejectReason: string | null;
  proofFilename: string;
  proofDeletionDate: string | null;
}

export interface AdminRechargeRow extends RechargeRequestView {
  studentId: string;
  referenceNorm: string;
  senderName: string;
  transferDate: string;
  proofSize: number;
}

/** Integer piastres → localized EGP string. Never floats. */
export function formatEgp(piastres: number, lang: 'ar' | 'en'): string {
  const negative = piastres < 0;
  const abs = Math.abs(Math.trunc(piastres));
  const pounds = Math.floor(abs / 100);
  const rest = abs % 100;
  const grouped = pounds.toString().replace(/\B(?=(\d{3})+(?!\d))/g, lang === 'ar' ? '٬' : ',');
  const amount = rest === 0 ? grouped : `${grouped}.${rest.toString().padStart(2, '0')}`;
  return lang === 'ar'
    ? `${negative ? '-' : ''}${amount} ج.م`
    : `${negative ? '-' : ''}EGP ${amount}`;
}
