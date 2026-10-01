import { useState, type FormEvent } from 'react';
import { ApiError, apiFetch, useAuth } from '../../../auth';
import { Button } from '../../../components/ui/Button';
import { BrandMark } from '../../../components/ui/BrandMark';
import { Container } from '../../../components/ui/Card';
import { Field, textInputClassName } from '../../../components/ui/Field';
import { Notice } from '../../../components/ui/Notice';
import { useLang } from '../../../i18n';
import { localize, useTitleFocus } from '../components/IdentityForm';

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
      await apiFetch('/auth/login', {
        method: 'POST',
        retryOnAuth: false,
        body: { identifier, password },
      });
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
      <div className="form-card mx-auto max-w-[640px] rounded-card border border-border bg-surface p-6 shadow-rest">
        <div className="mb-4">
          <BrandMark size="md" />
        </div>
        <h1 ref={titleRef} tabIndex={-1}>
          {t.loginTitle}
        </h1>
        <p className="text-muted">{t.loginBody}</p>
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
              className={textInputClassName(false)}
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
              className={textInputClassName(false)}
            />
          </Field>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button type="submit" disabled={busy}>
              {t.submitLogin}
            </Button>
          </div>
        </form>
      </div>
    </Container>
  );
}
