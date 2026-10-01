import { apiFetch, ApiError } from '../../auth';
export async function assessmentApi<T>(path: string, method = 'GET', body?: Record<string, unknown>): Promise<T> {
  const result = await apiFetch<{ data: T }>(path, { method, ...(body ? { body } : {}) }); return result.data;
}
export function errorLabel(error: unknown, ar: boolean): string {
  const code = error instanceof ApiError ? error.code : '';
  const messages: Record<string, [string, string]> = {
    SUBSCRIPTION_REQUIRED: ['يلزم اشتراك نشط في كورس واحد على الأقل.', 'An active course subscription is required.'],
    PRACTICE_LIMIT_REACHED: ['انتهى رصيد التشغيل. انتظر موعد التجديد أو تواصل مع الإدارة.', 'Run allowance exhausted. Wait for reset or contact ADMIN.'],
    DRAFT_CONFLICT: ['توجد نسخة أحدث من عملك. أعد تحميل الصفحة قبل الحفظ.', 'A newer draft exists. Reload before saving.'],
    ASSESSMENT_CHANGED: ['تم تعديل التمرين. احفظ عملك ثم أعد تحميله.', 'The assessment changed. Keep your work and reload.'],
    ASSESSMENTS_REQUIRED: ['اجتز التقييمات المطلوبة للمتابعة.', 'Pass the required assessments to continue.'],
    CHECKING_IN_PROGRESS: ['انتظر نتيجة الإرسال الحالي قبل المحاولة التالية.', 'Wait for the current check before trying again.'],
    CHECKING_BUSY: ['خدمة التقييم مشغولة. عملك محفوظ؛ حاول لاحقًا.', 'Checking is busy. Keep your work and retry later.'],
    TESTS_NOT_READY: ['احفظ المسودة، ثم حضّر الاختبارات وراجعها قبل النشر.', 'Save the draft, then prepare and review tests before publishing.'],
    PREPARATION_BUSY: ['قائمة تحضير الاختبارات ممتلئة. حاول لاحقًا.', 'Test preparation is busy. Try again later.'],
    NO_PROGRAM_PROBLEMS: ['لا توجد مسائل مدخلات ومخرجات في هذا التقييم.', 'This assessment has no input/output problems.'],
    VALIDATION_ERROR: ['تحقق من البيانات والتعليمات في جميع الحقول.', 'Check the values and instructions in every field.'],
    TOKEN_MISSING: ['سجل الدخول للمتابعة.', 'Sign in to continue.'],
    FORBIDDEN: ['لا يمكنك استخدام هذه الصفحة.', 'This page is not available to your account.'],
  };
  return messages[code]?.[ar ? 0 : 1] ?? (ar ? 'تعذر إكمال الطلب. احتفظ بعملك وحاول مرة أخرى.' : 'Request failed. Keep your work and retry.');
}
