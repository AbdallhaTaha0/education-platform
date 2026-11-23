import { useState } from 'react';
import { useAuth, type SafeUser } from '../../../auth';
import { Button } from '../../../components/ui/Button';
import { Container } from '../../../components/ui/Card';
import { Notice } from '../../../components/ui/Notice';
import { FormActions } from '../../../components/ui/FormActions';
import { useLang } from '../../../i18n';
import { localize, useTitleFocus } from '../components/IdentityForm';
import { AccountSettings } from './AccountSettings';

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

/**
 * Explicit profile/security destination (#/account/profile) inside the shared
 * account workspace. Display name/password only; login identifiers stay
 * read-only. Current-password verification and other-session revocation are
 * preserved by AccountSettings; recovery remains admin assistance.
 */
export function AccountProfile({ go }: { go: (route: string) => void }): JSX.Element {
  const { t, lang } = useLang();
  const ar = lang === 'ar';
  const { status, user, lastAuthCode, logout, logoutAll } = useAuth();
  const titleRef = useTitleFocus();
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  if (status === 'loading') {
    return (
      <main id="main">
        <section className="py-10">
          <Container>
            <p className="text-muted">{t.authChecking}</p>
          </Container>
        </section>
      </main>
    );
  }

  if (status === 'anonymous' || !user) {
    return (
      <main id="main">
        <section className="py-10">
          <Container>
            <div className="mx-auto max-w-[560px] rounded-2xl border border-border bg-surface p-6 text-start shadow-rest">
              <h1 ref={titleRef} tabIndex={-1} className="text-2xl font-extrabold text-ink sm:text-3xl">
                {ar ? 'الملف والأمان' : 'Profile & security'}
              </h1>
              <div className="mt-4">
                <Notice kind="info">
                  {lastAuthCode === 'SESSION_EXPIRED' ? t.sessionExpiredNotice : t.needLogin}
                </Notice>
              </div>
              <FormActions>
                <Button variant="primary" onClick={() => go('#/login')}>
                  {t.navLogin}
                </Button>
              </FormActions>
            </div>
          </Container>
        </section>
      </main>
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
    <main id="main">
      <Container>
        <div className="mx-auto max-w-2xl rounded-2xl border border-border bg-surface p-5 text-start shadow-rest sm:p-6">
          <p className="text-xs font-extrabold text-primary-strong">
            {ar ? 'حسابي — الملف والأمان' : 'My account — profile & security'}
          </p>
          <h1 ref={titleRef} tabIndex={-1} className="mt-1 text-2xl font-extrabold text-ink sm:text-3xl">
            {ar ? 'الملف والأمان' : 'Profile & security'}
          </h1>
          <div className="mt-4">
            <Notice kind={message?.kind ?? 'success'}>{message?.text ?? null}</Notice>
          </div>
          <dl className="mb-6 divide-y divide-border/70 rounded-xl border border-border bg-field/60 px-4">
            <div className="grid grid-cols-[140px_1fr] gap-3 py-3 max-sm:grid-cols-1 max-sm:gap-1">
              <dt className="text-sm font-semibold text-muted">{t.fieldName}</dt>
              <dd className="m-0 font-bold text-ink [overflow-wrap:anywhere]">{person.displayName}</dd>
            </div>
            <div className="grid grid-cols-[140px_1fr] gap-3 py-3 max-sm:grid-cols-1 max-sm:gap-1">
              <dt className="text-sm font-semibold text-muted">{t.fieldEmail}</dt>
              <dd className="m-0 font-semibold text-ink [overflow-wrap:anywhere]" dir="ltr">
                {person.email}
              </dd>
            </div>
            <div className="grid grid-cols-[140px_1fr] gap-3 py-3 max-sm:grid-cols-1 max-sm:gap-1">
              <dt className="text-sm font-semibold text-muted">{t.fieldPhone}</dt>
              <dd className="m-0 font-semibold text-ink [overflow-wrap:anywhere]" dir="ltr">
                {person.phone}
              </dd>
            </div>
            <div className="grid grid-cols-[140px_1fr] gap-3 py-3 max-sm:grid-cols-1 max-sm:gap-1">
              <dt className="text-sm font-semibold text-muted">{t.accountRole}</dt>
              <dd className="m-0 font-semibold text-ink [overflow-wrap:anywhere]">
                {person.role === 'ADMIN' ? t.roleAdmin : t.roleStudent}
              </dd>
            </div>
            <div className="grid grid-cols-[140px_1fr] gap-3 py-3 max-sm:grid-cols-1 max-sm:gap-1">
              <dt className="text-sm font-semibold text-muted">{t.accountSince}</dt>
              <dd className="m-0 font-semibold text-ink [overflow-wrap:anywhere]">
                {formatDate(person.createdAt, lang)}
              </dd>
            </div>
          </dl>
          <p className="text-sm text-muted">
            {ar
              ? 'البريد ورقم الهاتف للقراءة فقط. استعادة كلمة المرور بمساعدة الإدارة.'
              : 'Email and phone are read-only. Password recovery requires admin assistance.'}
          </p>
          <AccountSettings key={person.id} displayName={person.displayName} />
          <FormActions>
            <Button variant="secondary" onClick={() => void doLogout()} disabled={busy}>
              {t.logout}
            </Button>
            <Button variant="secondary" onClick={() => void doLogoutAll()} disabled={busy}>
              {t.logoutAll}
            </Button>
          </FormActions>
        </div>
      </Container>
    </main>
  );
}
