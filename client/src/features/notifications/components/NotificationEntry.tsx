import { useLang } from "../../../i18n";
import { useNotifications } from "../context";

export function BellIcon({ className = "h-5 w-5" }: { className?: string }): JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      className={className}
      aria-hidden="true"
    >
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 21h4" strokeLinecap="round" />
    </svg>
  );
}
export function NotificationEntry({ current }: { current: boolean }): JSX.Element {
  const { t, lang } = useLang();
  const { state } = useNotifications();
  const count = state.unreadCount;
  const number = new Intl.NumberFormat(lang === "ar" ? "ar-EG" : "en-GB");
  const description = state.countError
    ? t.notificationsCountError
    : count === null
      ? t.notificationsLoadingCount
      : `${number.format(count)} ${t.notificationsUnreadCount}`;
  return (
    <a
      href="#/notifications"
      aria-current={current ? "page" : undefined}
      aria-label={`${t.navNotifications} — ${description}`}
      data-testid="notification-entry"
      className="inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-control px-3 py-2 text-sm font-bold text-muted no-underline hover:bg-interactive hover:text-ink aria-[current=page]:bg-interactive aria-[current=page]:text-primary-strong"
    >
      <BellIcon />
      <span>{t.navNotifications}</span>
      {state.countError ? (
        <span aria-hidden="true" className="text-error-fg">
          !
        </span>
      ) : count !== null && count > 0 ? (
        <bdi aria-hidden="true" className="rounded-full bg-primary px-2 py-0.5 text-xs text-primary-ink">
          {count > 99 ? `${number.format(99)}+` : number.format(count)}
        </bdi>
      ) : null}
    </a>
  );
}
