/** Stable frontend-safe M4 error categories. Messages are English fallbacks. */
export const WALLET_ERROR_CODES = [
  'VALIDATION_ERROR',
  'PAYMENT_UNCONFIGURED',
  'DUPLICATE_REFERENCE',
  'ALREADY_REVIEWED',
  'INSUFFICIENT_FUNDS',
  'IDEMPOTENCY_CONFLICT',
  'FORBIDDEN',
  'NOT_FOUND',
  'SERVICE_ERROR',
] as const;

export type WalletErrorCode = (typeof WALLET_ERROR_CODES)[number];

/** Amount bounds in integer piastres (minor units). */
export const MIN_RECHARGE_PIASTRES = 100;
export const MAX_RECHARGE_PIASTRES = 100_000_000;
export const MAX_PROOF_BYTES = 5 * 1024 * 1024;
/** Proof bytes are cleared this many days after approval/rejection (D21). */
export const PROOF_RETENTION_DAYS = 180;
