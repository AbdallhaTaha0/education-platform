import { useLang } from '../../../i18n';
import type { RechargeStatus } from '../types/models';

/** Request status with icon + text (meaning never carried by color alone). */
export function RequestStatus({ status }: { status: RechargeStatus }): JSX.Element {
  const { t } = useLang();
  const label =
    status === 'PENDING'
      ? t.rechargePending
      : status === 'APPROVED'
        ? t.rechargeApproved
        : t.rechargeRejected;
  const icon = status === 'PENDING' ? '◷' : status === 'APPROVED' ? '✓' : '✕';
  const tone =
    status === 'PENDING'
      ? 'bg-pending-bg text-pending-fg'
      : status === 'APPROVED'
        ? 'bg-success-bg text-success-fg'
        : 'bg-error-bg text-error-fg';
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-semibold ${tone}`}
    >
      <span aria-hidden="true">{icon}</span>
      {label}
    </span>
  );
}
