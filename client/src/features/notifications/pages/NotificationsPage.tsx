import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../../auth';
import { useLang } from '../../../i18n';
import { Container, Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { FormActions } from '../../../components/ui/FormActions';
import { Loading, Notice } from '../../../components/ui/Notice';
import { useNotifications } from '../context';
import { BellIcon } from '../components/NotificationEntry';
import { notificationHref } from '../inbox';

export function NotificationsPage(): JSX.Element {
  const { status, user } = useAuth();
  const { t, lang } = useLang();
  const { store, state, connection } = useNotifications();
  const heading = useRef<HTMLHeadingElement>(null);
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    heading.current?.focus();
  }, [status]);
  useEffect(() => {
    if (status !== 'authenticated') return;
    store.open(true);
    return () => store.close();
  }, [status, store]);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  const number = new Intl.NumberFormat(lang === 'ar' ? 'ar-EG' : 'en-GB');
  const date = new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  const busy = state.busy !== null;
  return (
    <main id="main" className="py-8 md:py-12">
      <Container>
        <div className="mx-auto max-w-4xl">
          <div className="mb-8 flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-card bg-interactive text-primary-strong">
              <BellIcon className="h-6 w-6" />
            </span>
            <div>
              <h1 ref={heading} tabIndex={-1} className="page-title">
                {t.navNotifications}
              </h1>
              <p className="mt-2 text-muted">{t.notificationsSubtitle}</p>
            </div>
          </div>
          {status === 'loading' ? (
            <Loading text={t.loading} />
          ) : status !== 'authenticated' ? (
            <Card>
              <p className="mb-4">{t.notificationsSignIn}</p>
              <FormActions className="mt-0">
                <a
                  href="#/login"
                  className="inline-flex min-h-[44px] items-center rounded-control bg-primary px-6 font-bold text-primary-ink no-underline"
                >
                  {t.navLogin}
                </a>
              </FormActions>
            </Card>
          ) : (
            <>
              {!online ? <Notice kind="pending">{t.notificationsOffline}</Notice> : null}
              <p className="mb-4 text-sm text-muted" data-testid="notification-connection">
                {connection === 'connected'
                  ? t.notificationsConnected
                  : connection === 'connecting'
                    ? t.notificationsConnecting
                    : t.notificationsDisconnected}
              </p>
              <Card className="mb-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-sm text-muted">{t.notificationsUnreadHeading}</p>
                    <p
                      className="mt-1 text-3xl font-extrabold"
                      data-testid="notification-unread-count"
                    >
                      <bdi>
                        {state.countError || state.unreadCount === null
                          ? '—'
                          : number.format(state.unreadCount)}
                      </bdi>
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <Button
                      variant="secondary"
                      disabled={state.loading || busy}
                      onClick={() => void store.refresh()}
                    >
                      {state.loading && state.loaded
                        ? t.notificationsRefreshing
                        : t.notificationsRefresh}
                    </Button>
                    <Button
                      disabled={
                        !state.loaded ||
                        busy ||
                        state.loading ||
                        state.unreadCount === 0 ||
                        state.unreadCount === null
                      }
                      disabledReason={busy || state.loading || !state.loaded ? undefined : { ar: "لا توجد إشعارات غير مقروءة.", en: "There are no unread notifications." }}
                      onClick={() => void store.readAll()}
                    >
                      {state.busy === 'all' ? t.notificationsSaving : t.notificationsMarkAll}
                    </Button>
                  </div>
                </div>
                <div className="mt-5 flex gap-2" role="group" aria-label={t.notificationsFilter}>
                  <Button
                    variant="secondary"
                    data-notification-filter
                    aria-pressed={!state.unreadOnly}
                    disabled={busy}
                    onClick={() => store.setFilter(false)}
                    className={!state.unreadOnly ? 'border-primary text-primary-strong' : ''}
                  >
                    {!state.unreadOnly ? <span aria-hidden="true">✓</span> : null}
                    {t.notificationsAll}
                  </Button>
                  <Button
                    variant="secondary"
                    data-notification-filter
                    aria-pressed={state.unreadOnly}
                    disabled={busy}
                    onClick={() => store.setFilter(true)}
                    className={state.unreadOnly ? 'border-primary text-primary-strong' : ''}
                  >
                    {state.unreadOnly ? <span aria-hidden="true">✓</span> : null}
                    {t.notificationsUnread}
                  </Button>
                </div>
              </Card>
              {state.actionError ? <Notice kind="error">{t.notificationsSaveError}</Notice> : null}
              {state.error || state.countError ? (
                <Notice kind="error">
                  <div>
                    <p>{t.notificationsLoadError}</p>
                    <Button
                      variant="secondary"
                      className="mt-3"
                      disabled={state.loading || busy}
                      onClick={() => void store.refresh()}
                    >
                      {t.retry}
                    </Button>
                  </div>
                </Notice>
              ) : null}
              <p role="status" aria-live="polite" aria-atomic="true" className="sr-only">
                {state.loaded &&
                !state.loading &&
                !busy &&
                !state.countError &&
                state.unreadCount !== null
                  ? `${number.format(state.unreadCount)} ${t.notificationsUnreadCount}`
                  : ''}
              </p>
              {state.loading && !state.loaded ? <Loading text={t.notificationsLoading} /> : null}
              {state.loaded && state.items.length === 0 && !state.error ? (
                <Card className="py-12 text-center">
                  <BellIcon className="mx-auto mb-4 h-10 w-10 text-muted" />
                  <h2 className="section-title">
                    {state.unreadOnly ? t.notificationsEmptyUnread : t.notificationsEmpty}
                  </h2>
                  <p className="mt-2 text-muted">{t.notificationsEmptyBody}</p>
                  <a className="mt-4 inline-block underline" href={user?.role==='ADMIN'?'#/admin/summary':'#/dashboard'}>{lang==='ar'?'العودة إلى مهامك':'Return to your tasks'}</a>
                </Card>
              ) : null}
              <ul
                className="space-y-4"
                aria-label={t.navNotifications}
                aria-busy={state.loading || state.loadingMore}
              >
                {state.items.map((item) => {
                  const href = notificationHref(item);
                  const title = lang === 'ar' ? item.titleAr : item.titleEn;
                  const body = lang === 'ar' ? item.bodyAr : item.bodyEn;
                  const read = item.readAt !== null;
                  return (
                    <li
                      key={item.id}
                      data-testid="notification-item"
                      data-notification-id={item.id}
                    >
                      <Card className={!read ? 'border-border-strong' : ''}>
                        <div className="flex items-start gap-3">
                          <span
                            aria-hidden="true"
                            className={`mt-2 h-2.5 w-2.5 shrink-0 rounded-full ${read ? 'border border-border-strong' : 'bg-primary'}`}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <h2 className="text-lg font-bold">{title}</h2>
                              <span className="text-sm font-semibold text-muted">
                                {read ? t.notificationsRead : t.notificationsUnread}
                              </span>
                            </div>
                            <p className="mt-2 text-muted">{body}</p>
                            <p className="mt-3 text-sm text-muted">
                              {item.type === 'SUBSCRIPTION_EXPIRED'
                                ? t.notificationsExpiredOn
                                : t.notificationsDate}{' '}
                              <bdi>
                                <time dateTime={item.occurredAt}>
                                  {date.format(new Date(item.occurredAt))}
                                </time>
                              </bdi>
                            </p>
                            <div className="mt-4 flex flex-wrap items-center gap-3">
                              {href ? (
                                <a
                                  href={href}
                                  onClick={() => { if (!read) void store.setRead(item.id, true); }}
                                  className="inline-flex min-h-[44px] items-center gap-2 rounded-control px-3 font-bold text-primary-strong hover:bg-interactive"
                                >
                                  {item.target?.kind === 'WALLET'
                                    ? t.notificationsOpenWallet
                                    : t.notificationsOpenCourse}
                                  <span aria-hidden="true">{lang === 'ar' ? '←' : '→'}</span>
                                </a>
                              ) : (
                                <span className="flex min-h-[44px] items-center gap-2 text-sm text-muted">
                                  <span aria-hidden="true">ⓘ</span>
                                  {t.notificationsUnavailable}
                                </span>
                              )}
                              <Button
                                variant="secondary"
                                disabled={busy}
                                aria-label={`${read ? t.notificationsMarkUnread : t.notificationsMarkRead} — ${title}`}
                                onClick={(event) => {
                                  const button = event.currentTarget;
                                  void store.setRead(item.id, !read).then(() => {
                                    if (!document.contains(button))
                                      document
                                        .querySelector<HTMLButtonElement>(
                                          'button[aria-pressed="true"][data-notification-filter]',
                                        )
                                        ?.focus();
                                  });
                                }}
                              >
                                {state.busy === item.id
                                  ? t.notificationsSaving
                                  : read
                                    ? t.notificationsMarkUnread
                                    : t.notificationsMarkRead}
                              </Button>
                            </div>
                          </div>
                        </div>
                      </Card>
                    </li>
                  );
                })}
              </ul>
              {state.nextCursor !== null ? (
                <FormActions className="mt-6">
                  <Button
                    variant="secondary"
                    disabled={state.loading || state.loadingMore || busy}
                    onClick={() => void store.loadMore()}
                  >
                    {state.loadingMore ? t.notificationsLoading : t.notificationsMore}
                  </Button>
                </FormActions>
              ) : null}
            </>
          )}
        </div>
      </Container>
    </main>
  );
}
