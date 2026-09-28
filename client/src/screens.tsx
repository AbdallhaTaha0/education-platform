import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { ApiError, apiFetch, useAuth, type SafeUser } from './auth';
import { Button, Container } from './components';
import { useLang, type Strings } from './i18n';

function localize(t: Strings, code: string | null | undefined): string {
  if (!code) return t.err_UNKNOWN;
  const key = `err_${code}` as keyof Strings;
  const value = t[key];
  return typeof value === 'string' ? value : t.err_UNKNOWN;
}

/** Move keyboard focus to the view title on navigation. */
function useTitleFocus(): React.RefObject<HTMLHeadingElement> {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return ref;
}

interface FieldProps {
  id: string;
  label: string;
  error?: string;
  dir?: 'ltr' | 'rtl';
  children: ReactNode;
}

function Field({ id, label, error, dir, children }: FieldProps): JSX.Element {
  return (
    <div className="field" dir={dir}>
      <label htmlFor={id}>{label}</label>
      {children}
      {error ? (
        <p className="field-error" role="alert" id={`${id}-error`}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

function fieldError(t: Strings, code: string | undefined, field: string | undefined): string | undefined {
  if (!code) return undefined;
  if (code === 'VALIDATION_ERROR' && field) return t.err_VALIDATION_ERROR;
  return localize(t, code);
}

function Notice({ kind, children }: { kind: 'error' | 'success' | 'info'; children: ReactNode }): JSX.Element | null {
  if (!children) return null;
  return (
    <p className={`notice notice--${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
      {children}
    </p>
  );
}

export function RegisterScreen({ onDone }: { onDone: () => void }): JSX.Element {
  const { t } = useLang();
  const { reload } = useAuth();
  const titleRef = useTitleFocus();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [errorField, setErrorField] = useState<string | undefined>(undefined);

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (busy) return;
    if (password !== confirm) {
      setErrorCode(null);
      setErrorField(undefined);
      // Confirmation mismatch is purely client-side.
      setErrorCode('MISMATCH');
      return;
    }
    setBusy(true);
    setErrorCode(null);
    setErrorField(undefined);
    try {
      await apiFetch('/auth/register', {
        method: 'POST',
        retryOnAuth: false,
        body: { displayName: name, email, phone, password },
      });
      await reload();
      onDone();
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorCode(err.code);
        const field = (err.details as { field?: string } | undefined)?.field;
        setErrorField(typeof field === 'string' ? field : undefined);
      } else {
        setErrorCode('SERVICE_ERROR');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Container>
      <div className="card form-card">
        <h1 ref={titleRef} tabIndex={-1}>
          {t.registerTitle}
        </h1>
        <p className="muted">{t.registerBody}</p>
        <Notice kind="error">
          {errorCode === 'MISMATCH' ? t.passwordsMismatch : errorCode ? localize(t, errorCode) : null}
        </Notice>
        <Notice kind="success">{null}</Notice>
        <form onSubmit={(e) => void submit(e)} noValidate>
          <Field id="reg-name" label={t.fieldName} error={errorField === 'displayName' ? fieldError(t, errorCode ?? undefined, errorField) : undefined}>
            <input
              id="reg-name"
              name="name"
              autoComplete="name"
              required
              minLength={2}
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-invalid={errorField === 'displayName'}
              aria-describedby={errorField === 'displayName' ? 'reg-name-error' : undefined}
            />
          </Field>
          <Field id="reg-email" label={t.fieldEmail} dir="ltr" error={errorField === 'email' || errorCode === 'EMAIL_TAKEN' ? fieldError(t, errorCode ?? undefined, 'email') : undefined}>
            <input
              id="reg-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={errorField === 'email' || errorCode === 'EMAIL_TAKEN'}
            />
          </Field>
          <Field id="reg-phone" label={t.fieldPhone} dir="ltr" error={errorField === 'phone' || errorCode === 'PHONE_TAKEN' ? fieldError(t, errorCode ?? undefined, 'phone') : undefined}>
            <input
              id="reg-phone"
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              aria-invalid={errorField === 'phone' || errorCode === 'PHONE_TAKEN'}
            />
          </Field>
          <Field id="reg-password" label={t.fieldPassword} dir="ltr" error={errorField === 'password' ? fieldError(t, errorCode ?? undefined, 'password') : undefined}>
            <input
              id="reg-password"
              name="new-password"
              type="password"
              autoComplete="new-password"
              required
              minLength={12}
              maxLength={256}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-describedby="reg-password-hint"
              aria-invalid={errorField === 'password'}
            />
            <p className="hint" id="reg-password-hint">
              {t.passwordHint}
            </p>
          </Field>
          <Field id="reg-confirm" label={t.fieldPasswordConfirm} dir="ltr">
            <input
              id="reg-confirm"
              name="confirm-password"
              type="password"
              autoComplete="new-password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </Field>
          <div className="form-actions">
            <Button type="submit" disabled={busy}>
              {t.submitRegister}
            </Button>
          </div>
        </form>
      </div>
    </Container>
  );
}

export function LoginScreen({ onDone }: { onDone: () => void }): JSX.Element {
  const { t } = useLang();
  const { reload } = useAuth();
  const titleRef = useTitleFocus();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setErrorCode(null);
    try {
      await apiFetch('/auth/login', { method: 'POST', retryOnAuth: false, body: { identifier, password } });
      await reload();
      onDone();
    } catch (err) {
      setErrorCode(err instanceof ApiError ? err.code : 'SERVICE_ERROR');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Container>
      <div className="card form-card">
        <h1 ref={titleRef} tabIndex={-1}>
          {t.loginTitle}
        </h1>
        <p className="muted">{t.loginBody}</p>
        <Notice kind="error">{errorCode ? localize(t, errorCode) : null}</Notice>
        <form onSubmit={(e) => void submit(e)} noValidate>
          <Field id="login-id" label={t.fieldIdentifier} dir="ltr">
            <input
              id="login-id"
              name="username"
              autoComplete="username"
              required
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
            />
          </Field>
          <Field id="login-password" label={t.fieldPassword} dir="ltr">
            <input
              id="login-password"
              name="current-password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          <div className="form-actions">
            <Button type="submit" disabled={busy}>
              {t.submitLogin}
            </Button>
          </div>
        </form>
      </div>
    </Container>
  );
}

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
  const { t, lang } = useLang();
  const { status, user, lastAuthCode, logout, logoutAll } = useAuth();
  const titleRef = useTitleFocus();
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  if (status === 'loading') {
    return (
      <Container>
        <p className="muted">{t.authChecking}</p>
      </Container>
    );
  }

  if (status === 'anonymous' || !user) {
    return (
      <Container>
        <div className="card form-card">
          <h1 ref={titleRef} tabIndex={-1}>
            {t.accountTitle}
          </h1>
          <Notice kind="info">{lastAuthCode === 'SESSION_EXPIRED' ? t.sessionExpiredNotice : t.needLogin}</Notice>
          <div className="hero-actions">
            <Button variant="secondary" onClick={() => go('#/login')}>
              {t.navLogin}
            </Button>
          </div>
        </div>
      </Container>
    );
  }

  const person: SafeUser = user;
  async function doLogout(): Promise<void> {
    if (busy) return;
    setBusy(true);
    const code = await logout();
    setMessage(code ? { kind: 'error', text: localize(t, code) } : { kind: 'success', text: t.successLogout });
    setBusy(false);
  }

  async function doLogoutAll(): Promise<void> {
    if (busy) return;
    setBusy(true);
    const code = await logoutAll();
    setMessage(code ? { kind: 'error', text: localize(t, code) } : { kind: 'success', text: t.successLogoutAll });
    setBusy(false);
  }

  return (
    <Container>
      <div className="card form-card">
        <h1 ref={titleRef} tabIndex={-1}>
          {t.accountTitle}
        </h1>
        <Notice kind={message?.kind ?? 'success'}>{message?.text ?? null}</Notice>
        <dl className="profile">
          <div>
            <dt>{t.fieldName}</dt>
            <dd>{person.displayName}</dd>
          </div>
          <div>
            <dt>{t.fieldEmail}</dt>
            <dd dir="ltr">{person.email}</dd>
          </div>
          <div>
            <dt>{t.fieldPhone}</dt>
            <dd dir="ltr">{person.phone}</dd>
          </div>
          <div>
            <dt>{t.accountRole}</dt>
            <dd>{person.role === 'ADMIN' ? t.roleAdmin : t.roleStudent}</dd>
          </div>
          <div>
            <dt>{t.accountSince}</dt>
            <dd>{formatDate(person.createdAt, lang)}</dd>
          </div>
        </dl>
        <div className="hero-actions">
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
        </div>
      </div>
    </Container>
  );
}

export function AdminScreen({ go }: { go: (route: string) => void }): JSX.Element {
  const { t } = useLang();
  const { status, user } = useAuth();
  const titleRef = useTitleFocus();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [createdEmail, setCreatedEmail] = useState<string | null>(null);

  if (status === 'loading') {
    return (
      <Container>
        <p className="muted">{t.authChecking}</p>
      </Container>
    );
  }

  if (status === 'anonymous' || !user) {
    return (
      <Container>
        <div className="card form-card">
          <h1 ref={titleRef} tabIndex={-1}>
            {t.adminTitle}
          </h1>
          <Notice kind="info">{t.adminLoginRequired}</Notice>
          <div className="hero-actions">
            <Button variant="secondary" onClick={() => go('#/login')}>
              {t.navLogin}
            </Button>
          </div>
        </div>
      </Container>
    );
  }

  if (user.role !== 'ADMIN') {
    return (
      <Container>
        <div className="card form-card">
          <h1 ref={titleRef} tabIndex={-1}>
            {t.forbiddenTitle}
          </h1>
          <Notice kind="error">{t.forbiddenBody}</Notice>
        </div>
      </Container>
    );
  }

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setErrorCode(null);
    setCreatedEmail(null);
    try {
      const body = await apiFetch<{ data: { user: SafeUser } }>('/admin/users', {
        method: 'POST',
        retryOnAuth: false,
        body: { displayName: name, email, phone, password },
      });
      setCreatedEmail(body.data.user.email);
      setName('');
      setEmail('');
      setPhone('');
      setPassword('');
    } catch (err) {
      setErrorCode(err instanceof ApiError ? err.code : 'SERVICE_ERROR');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Container>
      <div className="card form-card">
        <h1 ref={titleRef} tabIndex={-1}>
          {t.adminTitle}
        </h1>
        <p className="muted">{t.adminBody}</p>
        <Notice kind="error">{errorCode ? localize(t, errorCode) : null}</Notice>
        <Notice kind="success">{createdEmail ? `${t.successAdminCreate} (${createdEmail})` : null}</Notice>
        <form onSubmit={(e) => void submit(e)} noValidate>
          <Field id="adm-name" label={t.fieldName}>
            <input id="adm-name" name="name" autoComplete="off" required minLength={2} maxLength={100} value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field id="adm-email" label={t.fieldEmail} dir="ltr">
            <input id="adm-email" name="email" type="email" autoComplete="off" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field id="adm-phone" label={t.fieldPhone} dir="ltr">
            <input id="adm-phone" name="phone" type="tel" inputMode="tel" autoComplete="off" required value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Field>
          <Field id="adm-password" label={t.fieldPassword} dir="ltr">
            <input id="adm-password" name="new-password" type="password" autoComplete="new-password" required minLength={12} maxLength={256} value={password} onChange={(e) => setPassword(e.target.value)} aria-describedby="adm-password-hint" />
            <p className="hint" id="adm-password-hint">
              {t.passwordHint}
            </p>
          </Field>
          <div className="form-actions">
            <Button type="submit" disabled={busy}>
              {t.submitAdminCreate}
            </Button>
          </div>
        </form>
      </div>
    </Container>
  );
}
