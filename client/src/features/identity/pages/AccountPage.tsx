import { useState } from 'react';
import { useAuth, type SafeUser } from '../../../auth';
import { Button } from '../../../components/ui/Button';
import { FormActions } from '../../../components/ui/FormActions';
import { Container } from '../../../components/ui/Card';
import { Notice } from '../../../components/ui/Notice';
import { useLang } from '../../../i18n';
import { localize, useTitleFocus } from '../components/IdentityForm';
import { AccountSettings } from './AccountSettings';
import { useCodingIde } from '../../../features';

function formatDate(value: string, lang: string): string {
  try {
    return new Date(value).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return value;
  }
}
export function AccountScreen({ go }: { go: (route: string) => void }): JSX.Element {
  const codingEnabled = useCodingIde();
  const { t, lang } = useLang();
  const { status, user, lastAuthCode, logout, logoutAll } = useAuth();
  const titleRef = useTitleFocus();
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  if (status === 'loading') {
    return (
      <Container>
        <p className="text-muted">{t.authChecking}</p>
      </Container>
    );
  }

  if (status === 'anonymous' || !user) {
    return (
      <Container>
        <div className="form-card mx-auto max-w-[640px] rounded-card border border-border bg-surface p-6 shadow-rest">
          <h1 ref={titleRef} tabIndex={-1}>
            {t.accountTitle}
          </h1>
          <Notice kind="info">
            {lastAuthCode === 'SESSION_EXPIRED' ? t.sessionExpiredNotice : t.needLogin}
          </Notice>
          <FormActions>
            <Button variant="secondary" onClick={() => go('#/login')}>
              {t.navLogin}
            </Button>
          </FormActions>
        </div>
      </Container>
    );
  }

  const person: SafeUser = user;
  async function doLogout(): Promise<void> {
    if (busy) return;
    setBusy(true);
    const code = await logout();
    setMessage(
      code
        ? { kind: 'error', text: localize(t, code) }
        : { kind: 'success', text: t.successLogout },
    );
    setBusy(false);
  }

  async function doLogoutAll(): Promise<void> {
    if (busy) return;
    setBusy(true);
    const code = await logoutAll();
    setMessage(
      code
        ? { kind: 'error', text: localize(t, code) }
        : { kind: 'success', text: t.successLogoutAll },
    );
    setBusy(false);
  }

  return (
    <Container>
      <div className="form-card mx-auto max-w-[640px] rounded-card border border-border bg-surface p-6 shadow-rest">
        <h1 ref={titleRef} tabIndex={-1}>
          {t.accountTitle}
        </h1>
        <Notice kind={message?.kind ?? 'success'}>{message?.text ?? null}</Notice>
        <nav
          className="account-shortcuts"
          aria-label={lang === 'ar' ? 'اختصارات حسابك' : 'Your account shortcuts'}
        >
          {person.role === 'STUDENT' ? (
            <>
              <a href="#/dashboard" className="font-bold text-primary-strong">{t.navDashboard}</a>
              <a href="#/wallet">{t.navWallet}</a>
              <a href="#/purchases">{lang === 'ar' ? 'مشترياتي' : 'My purchases'}</a>
            </>
          ) : (
            <>
              <a href="#/admin/summary">{t.navAdmin}</a>
              <a href="#/admin/packages">{lang === 'ar' ? 'الباقات' : 'Packages'}</a>
              <a href="#/admin/catalog">{t.navCatalog}</a>
              <a href="#/admin/recharge">{t.navRecharge}</a>
              {codingEnabled ? <a href="#/admin/practice">{lang==='ar'?'حدود التدريب':'Practice limits'}</a> : null}
            </>
          )}
          <a href="#/notifications">{t.navNotifications}</a>
          <a href="#/courses">{t.navCourses}</a>
        </nav>
        <dl className="mb-6 grid gap-3">
          <div className="grid grid-cols-[140px_1fr] gap-3 border-b border-border py-2 max-sm:grid-cols-1 max-sm:gap-1">
            <dt className="text-sm font-semibold text-muted">{t.fieldName}</dt>
            <dd className="m-0 font-semibold [overflow-wrap:anywhere]">{person.displayName}</dd>
          </div>
          <div className="grid grid-cols-[140px_1fr] gap-3 border-b border-border py-2 max-sm:grid-cols-1 max-sm:gap-1">
            <dt className="text-sm font-semibold text-muted">{t.fieldEmail}</dt>
            <dd className="m-0 font-semibold [overflow-wrap:anywhere]" dir="ltr">
              {person.email}
            </dd>
          </div>
          <div className="grid grid-cols-[140px_1fr] gap-3 border-b border-border py-2 max-sm:grid-cols-1 max-sm:gap-1">
            <dt className="text-sm font-semibold text-muted">{t.fieldPhone}</dt>
            <dd className="m-0 font-semibold [overflow-wrap:anywhere]" dir="ltr">
              {person.phone}
            </dd>
          </div>
          <div className="grid grid-cols-[140px_1fr] gap-3 border-b border-border py-2 max-sm:grid-cols-1 max-sm:gap-1">
            <dt className="text-sm font-semibold text-muted">{t.accountRole}</dt>
            <dd className="m-0 font-semibold [overflow-wrap:anywhere]">
              {person.role === 'ADMIN' ? t.roleAdmin : t.roleStudent}
            </dd>
          </div>
          <div className="grid grid-cols-[140px_1fr] gap-3 border-b border-border py-2 max-sm:grid-cols-1 max-sm:gap-1">
            <dt className="text-sm font-semibold text-muted">{t.accountSince}</dt>
            <dd className="m-0 font-semibold [overflow-wrap:anywhere]">
              {formatDate(person.createdAt, lang)}
            </dd>
          </div>
        </dl>
        <AccountSettings key={person.id} displayName={person.displayName}/>
        <FormActions>
          <Button variant="secondary" onClick={() => void doLogout()} disabled={busy}>
            {t.logout}
          </Button>
          <Button variant="secondary" onClick={() => void doLogoutAll()} disabled={busy}>
            {t.logoutAll}
          </Button>
          {person.role === 'ADMIN' ? (
            <Button variant="primary" onClick={() => go('#/admin')} disabled={busy}>
              {t.navAdmin}
            </Button>
          ) : null}
        </FormActions>
      </div>
    </Container>
  );
}
