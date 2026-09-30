import { useState, type FormEvent } from 'react';
import { ApiError, apiFetch, useAuth } from '../../../auth';
import { Button } from '../../../components/ui/Button';
import { BrandMark } from '../../../components/ui/BrandMark';
import { Container } from '../../../components/ui/Card';
import { Field, textInputClassName } from '../../../components/ui/Field';
import { Notice } from '../../../components/ui/Notice';
import { useLang } from '../../../i18n';
import { fieldError, localize, useTitleFocus } from '../components/IdentityForm';

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
      <div className="form-card mx-auto max-w-[640px] rounded-card border border-border bg-surface p-6 shadow-rest">
        <div className="mb-4">
          <BrandMark size="md" />
        </div>
        <h1 ref={titleRef} tabIndex={-1}>
          {t.registerTitle}
        </h1>
        <p className="text-muted">{t.registerBody}</p>
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
              className={textInputClassName(errorField === 'displayName')}
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
              className={textInputClassName(errorField === 'email' || errorCode === 'EMAIL_TAKEN')}
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
              className={textInputClassName(errorField === 'phone' || errorCode === 'PHONE_TAKEN')}
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
              className={textInputClassName(errorField === 'password')}
            />
            <p className="mt-2 text-sm text-muted" id="reg-password-hint">
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
              className={textInputClassName(false)}
            />
          </Field>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button type="submit" disabled={busy}>
              {t.submitRegister}
            </Button>
          </div>
        </form>
      </div>
    </Container>
  );
}
