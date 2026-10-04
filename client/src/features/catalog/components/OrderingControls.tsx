import { useLang } from '../../../i18n';
import { Button } from '../../../components/ui/Button';

interface OrderingControlsProps {
  onMoveUp: () => void;
  onMoveDown: () => void;
  upDisabled: boolean;
  downDisabled: boolean;
  busy: boolean;
}

/** Deterministic ordering controls with accessible labels. */
export function OrderingControls({
  onMoveUp,
  onMoveDown,
  upDisabled,
  downDisabled,
  busy,
}: OrderingControlsProps): JSX.Element {
  const { t } = useLang();
  return (
    <span className="inline-flex flex-wrap gap-2">
      <Button
        variant="secondary"
        disabled={busy || upDisabled} disabledReason={busy ? undefined : { ar: "هذا أول عنصر؛ لا يمكن نقله لأعلى.", en: "This is the first item; it cannot move up." }}
        onClick={onMoveUp}
        aria-label={t.actionMoveUp}
      >
        ↑
      </Button>
      <Button
        variant="secondary"
        disabled={busy || downDisabled} disabledReason={busy ? undefined : { ar: "هذا آخر عنصر؛ لا يمكن نقله لأسفل.", en: "This is the last item; it cannot move down." }}
        onClick={onMoveDown}
        aria-label={t.actionMoveDown}
      >
        ↓
      </Button>
    </span>
  );
}
