import { useState, type FormEvent } from 'react';
import { ApiError, apiFetch, useAuth } from '../../../auth';
import { Button } from '../../../components/ui/Button';
import { FormActions } from '../../../components/ui/FormActions';
import { BrandMark } from '../../../components/ui/BrandMark';
import { Container } from '../../../components/ui/Card';
import { Field, textInputClassName } from '../../../components/ui/Field';
import { Notice } from '../../../components/ui/Notice';
import { useLang } from '../../../i18n';
import { localize, useTitleFocus } from '../components/IdentityForm';

export function LoginScreen({ onDone }: { onDone: () => void }): JSX.Element {
  const { t, lang } = useLang();
  const ar = lang === 'ar';
  const { reload } = useAuth();
  const titleRef = useTitleFocus();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
      <div className="form-card mx-auto my-6 w-full max-w-[540px] rounded-2xl border border-border bg-surface p-6 text-start shadow-rest sm:my-10 sm:p-8">
        <div className="auth-form-header mb-6">
          <div className="mb-4 flex justify-center">
            <BrandMark size="md" />
          </div>
          <h1 ref={titleRef} tabIndex={-1} className="text-2xl font-extrabold text-ink sm:text-3xl">
            {t.loginTitle}
          </h1>
          <p className="mt-2 text-sm text-muted sm:text-base">{t.loginBody}</p>
        </div>

        <Notice kind="error">{errorCode ? localize(t, errorCode) : null}</Notice>

        <form onSubmit={(e) => void submit(e)} noValidate>
          <Field id="login-id" label={t.fieldIdentifier}>
            <input
              id="login-id"
              name="username"
              dir="ltr"
              autoComplete="username"
              placeholder="student@example.com / +2010…"
              required
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              className={textInputClassName(false)}
            />
          </Field>

          <Field
            id="login-password"
            label={t.fieldPassword}
            endAdornment={
              <button
                type="button"
                aria-pressed={showPassword}
                aria-label={
                  ar
                    ? showPassword
                      ? 'إخفاء أحرف السر'
                      : 'إظهار أحرف السر'
                    : showPassword
                      ? 'Hide secret text'
                      : 'Show secret text'
                }
                onClick={() => setShowPassword((v) => !v)}
                className="inline-flex min-h-[36px] items-center rounded-lg px-2.5 text-xs font-bold text-muted transition-colors hover:bg-elevated hover:text-ink"
              >
                {ar ? (showPassword ? 'إخفاء' : 'إظهار') : showPassword ? 'Hide' : 'Show'}
              </button>
            }
          >
            <input
              id="login-password"
              name="current-password"
              dir="ltr"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={textInputClassName(false, 'pe-16')}
            />
          </Field>

          <FormActions className="mt-6">
            <Button type="submit" disabled={busy} className="w-full sm:w-auto sm:min-w-[200px]">
              {t.submitLogin}
            </Button>
          </FormActions>
        </form>

        <div className="mt-6 border-t border-border/70 pt-5 text-center" data-testid="login-help">
          <p className="text-sm">
            <a href="#/register" className="font-bold text-primary-strong underline underline-offset-4">
              {ar ? 'ليس لديك حساب؟ أنشئ حساب طالب' : 'New here? Create a student account'}
            </a>
          </p>
          <p className="mt-3 text-xs text-muted sm:text-sm">
            {ar
              ? 'استعادة كلمة المرور حاليًا بمساعدة الإدارة.'
              : 'Password recovery requires admin assistance.'}
          </p>
          <a
            href="#/support"
            className="mt-1.5 inline-flex min-h-[40px] items-center text-sm font-semibold text-ink underline underline-offset-4 hover:text-primary-strong"
          >
            {ar ? 'المساعدة في استعادة الحساب' : 'Account recovery help'}
          </a>
        </div>
      </div>
    </Container>
  );
}
