import { useState, type FormEvent } from 'react';
import { ApiError, apiFetch, useAuth, type SafeUser } from '../../../auth';
import { Button } from '../../../components/ui/Button';
import { FormActions } from '../../../components/ui/FormActions';
import { Container } from '../../../components/ui/Card';
import { Field, textInputClassName } from '../../../components/ui/Field';
import { Notice } from '../../../components/ui/Notice';
import { useLang } from '../../../i18n';
import { localize, useTitleFocus } from '../components/IdentityForm';

export function AdminScreen({ go }: { go: (route: string) => void }): JSX.Element {
  const { t, lang } = useLang();
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
        <p className="text-muted">{t.authChecking}</p>
      </Container>
    );
  }

  if (status === 'anonymous' || !user) {
    return (
      <Container>
        <div className="form-card mx-auto max-w-[640px] rounded-card border border-border bg-surface p-6 shadow-rest">
          <h1 ref={titleRef} tabIndex={-1}>
            {lang==='ar'?'إنشاء حساب مسؤول':'Create an admin account'}
          </h1>
          <Notice kind="info">{t.adminLoginRequired}</Notice>
          <FormActions>
            <Button variant="secondary" onClick={() => go('#/login')}>
              {t.navLogin}
            </Button>
          </FormActions>
        </div>
      </Container>
    );
  }

  if (user.role !== 'ADMIN') {
    return (
      <Container>
        <div className="form-card mx-auto max-w-[640px] rounded-card border border-border bg-surface p-6 shadow-rest">
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
      <div className="form-card mx-auto max-w-[640px] rounded-card border border-border bg-surface p-6 shadow-rest">
        <h1 ref={titleRef} tabIndex={-1}>
          {lang==='ar'?'إنشاء حساب مسؤول':'Create an admin account'}
        </h1>
        <p className="text-muted">{t.adminBody}</p>
        <Notice kind="error">{errorCode ? localize(t, errorCode) : null}</Notice>
        <Notice kind="success">
          {createdEmail ? `${t.successAdminCreate} (${createdEmail})` : null}
        </Notice>
        <form onSubmit={(e) => void submit(e)} noValidate>
          <Field id="adm-name" label={t.fieldName}>
            <input
              id="adm-name"
              name="name"
              autoComplete="off"
              required
              minLength={2}
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={textInputClassName(false)}
            />
          </Field>
          <Field id="adm-email" label={t.fieldEmail} dir="ltr">
            <input
              id="adm-email"
              name="email"
              type="email"
              autoComplete="off"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={textInputClassName(false)}
            />
          </Field>
          <Field id="adm-phone" label={t.fieldPhone} dir="ltr">
            <input
              id="adm-phone"
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="off"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={textInputClassName(false)}
            />
          </Field>
          <Field id="adm-password" label={t.fieldPassword} dir="ltr">
            <input
              id="adm-password"
              name="new-password"
              type="password"
              autoComplete="new-password"
              required
              minLength={12}
              maxLength={256}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-describedby="adm-password-hint"
              className={textInputClassName(false)}
            />
            <p className="mt-2 text-sm text-muted" id="adm-password-hint">
              {t.passwordHint}
            </p>
          </Field>
          <FormActions>
            <Button type="submit" disabled={busy}>
              {t.submitAdminCreate}
            </Button>
          </FormActions>
        </form>
      </div>
    </Container>
  );
}
