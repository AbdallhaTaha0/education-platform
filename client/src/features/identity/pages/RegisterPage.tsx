import { useState, type FormEvent } from 'react';
import { ApiError, apiFetch, useAuth } from '../../../auth';
import { Button } from '../../../components/ui/Button';
import { FormActions } from '../../../components/ui/FormActions';
import { BrandMark } from '../../../components/ui/BrandMark';
import { Container } from '../../../components/ui/Card';
import { Field, textInputClassName } from '../../../components/ui/Field';
import { Notice } from '../../../components/ui/Notice';
import { useLang } from '../../../i18n';
import { fieldError, localize, useTitleFocus } from '../components/IdentityForm';
import {
  StudentDetailsFields,
  emptyStudentDetails,
  studentDataError,
} from '../components/StudentDetailsFields';

export function RegisterScreen({ onDone }: { onDone: () => void }): JSX.Element {
  const { t, lang } = useLang();
  const ar = lang === 'ar';
  const { reload } = useAuth();
  const titleRef = useTitleFocus();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [details, setDetails] = useState({ ...emptyStudentDetails });
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
        body: { displayName: name, email, phone, password, ...details },
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
      <div className="form-card mx-auto my-6 w-full max-w-2xl rounded-2xl border border-border bg-surface p-6 text-start shadow-rest sm:my-10 sm:p-8">
        <div className="auth-form-header mb-6">
          <div className="mb-4 flex justify-center">
            <BrandMark size="md" />
          </div>
          <h1 ref={titleRef} tabIndex={-1} className="text-2xl font-extrabold text-ink sm:text-3xl">
            {t.registerTitle}
          </h1>
          <p className="mt-2 text-sm text-muted sm:text-base">{t.registerBody}</p>
        </div>

        <Notice kind="error">
          {errorCode === 'MISMATCH'
            ? t.passwordsMismatch
            : errorCode
              ? [
                  'NATIONAL_ID_TAKEN',
                  'STUDENT_DATA_UNCONFIGURED',
                  'STUDENT_PROFILE_UNAVAILABLE',
                ].includes(errorCode)
                ? studentDataError(errorCode, ar)
                : localize(t, errorCode)
              : null}
        </Notice>
        <Notice kind="success">{null}</Notice>

        <form onSubmit={(e) => void submit(e)} noValidate className="space-y-5">
          <div className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
            <Field
              id="reg-name"
              label={ar ? 'اسم الطالب بالكامل' : 'Student full name'}
              className="sm:col-span-2"
              error={
                errorField === 'displayName'
                  ? fieldError(t, errorCode ?? undefined, errorField)
                  : undefined
              }
            >
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

            <Field
              id="reg-email"
              label={t.fieldEmail}
              error={
                errorField === 'email' || errorCode === 'EMAIL_TAKEN'
                  ? fieldError(t, errorCode ?? undefined, 'email')
                  : undefined
              }
            >
              <input
                id="reg-email"
                name="email"
                dir="ltr"
                type="email"
                placeholder="student@example.com"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={errorField === 'email' || errorCode === 'EMAIL_TAKEN'}
                className={textInputClassName(
                  errorField === 'email' || errorCode === 'EMAIL_TAKEN',
                )}
              />
            </Field>

            <Field
              id="reg-phone"
              label={t.fieldPhone}
              error={
                errorField === 'phone' || errorCode === 'PHONE_TAKEN'
                  ? fieldError(t, errorCode ?? undefined, 'phone')
                  : undefined
              }
            >
              <input
                id="reg-phone"
                name="phone"
                dir="ltr"
                type="tel"
                placeholder="+201012345678"
                inputMode="tel"
                autoComplete="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                aria-invalid={errorField === 'phone' || errorCode === 'PHONE_TAKEN'}
                className={textInputClassName(
                  errorField === 'phone' || errorCode === 'PHONE_TAKEN',
                )}
              />
            </Field>
          </div>

          <div className="border-t border-border/70 pt-5">
            <StudentDetailsFields
              prefix="reg"
              value={details}
              onChange={setDetails}
              disabled={busy}
              errorField={errorField}
              errorCode={errorCode ?? undefined}
            />
          </div>

          <div className="border-t border-border/70 pt-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-extrabold text-ink">
                {ar ? 'كلمة المرور والأمان' : 'Password & security'}
              </p>
              <button
                type="button"
                aria-pressed={showPassword}
                onClick={() => setShowPassword((v) => !v)}
                className="inline-flex min-h-[36px] items-center rounded-lg border border-border bg-elevated px-3 py-1 text-xs font-bold text-ink transition-colors hover:border-border-strong"
              >
                {ar
                  ? showPassword
                    ? 'إخفاء كلمات المرور'
                    : 'إظهار كلمات المرور'
                  : showPassword
                    ? 'Hide passwords'
                    : 'Show passwords'}
              </button>
            </div>
            <div className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
              <Field
                id="reg-password"
                label={t.fieldPassword}
                error={
                  errorField === 'password'
                    ? fieldError(t, errorCode ?? undefined, 'password')
                    : undefined
                }
              >
                <input
                  id="reg-password"
                  name="new-password"
                  dir="ltr"
                  type={showPassword ? 'text' : 'password'}
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
                <p
                  className="mt-1.5 text-start text-xs text-muted sm:text-sm"
                  id="reg-password-hint"
                  dir={ar ? 'rtl' : 'ltr'}
                >
                  {t.passwordHint}
                </p>
              </Field>

              <Field id="reg-confirm" label={t.fieldPasswordConfirm}>
                <input
                  id="reg-confirm"
                  name="confirm-password"
                  dir="ltr"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className={textInputClassName(false)}
                />
              </Field>
            </div>
          </div>

          <FormActions>
            <Button type="submit" disabled={busy} className="w-full sm:w-auto sm:min-w-[220px]">
              {t.submitRegister}
            </Button>
          </FormActions>
        </form>

        <p className="mt-6 border-t border-border/70 pt-5 text-center text-sm">
          <a href="#/login" className="font-bold text-primary-strong underline underline-offset-4">
            {ar ? 'لديك حساب؟ سجل الدخول' : 'Already have an account? Sign in'}
          </a>
        </p>
      </div>
    </Container>
  );
}
