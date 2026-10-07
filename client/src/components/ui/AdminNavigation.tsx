import { useLang } from '../../i18n';
import { useAuth } from '../../auth';
import { useCodingIde } from '../../features';

export function AdminNavigation(): JSX.Element | null {
  const { user } = useAuth(); const { lang } = useLang(); const ar = lang === 'ar';
  const codingEnabled = useCodingIde();
  if (user?.role !== 'ADMIN') return null;
  const links = [['#/admin/summary','نظرة عامة','Overview'],['#/admin/catalog','الكورسات','Courses'],['#/admin/packages','الباقات','Packages'],['#/admin/recharge','مراجعة الشحن','Recharge review'],['#/admin/practice','حدود التدريب','Practice limits'],['#/admin','إضافة مسؤول','Create admin'],['#/admin/students','الطلاب','Students'],['#/admin/policies','مسودات السياسات','Policy drafts'],['#/admin/support','بيانات الدعم','Support contacts']];
  return <nav aria-label={ar ? 'إدارة المنصة' : 'Platform management'} className="mb-6 flex flex-wrap gap-2 border-b border-border pb-4">{links.filter(([href]) => codingEnabled || href !== '#/admin/practice').map(([href,a,e]) => <a key={href} href={href} aria-current={location.hash === href ? 'page' : undefined} className="rounded-control border border-border px-3 py-2 text-sm font-semibold aria-[current=page]:bg-elevated">{ar?a:e}</a>)}</nav>;
}

export function businessState(state: string, ar: boolean): string {
  const labels: Record<string,[string,string]> = {UNREGISTERED:['لم يبدأ الرفع','Upload not started'],UPLOAD_PENDING:['بانتظار الرفع','Awaiting upload'],DELETION_PENDING:['جارٍ الحذف','Deleting'],DELETION_FAILED:['تعذر الحذف','Deletion failed'],RUNNING:['جارٍ التنفيذ','Running'],DRAFT:['مسودة','Draft'],PROCESSING:['جارٍ تجهيز الفيديو','Processing'],READY:['جاهز','Ready'],PUBLISHED:['منشور','Published'],ARCHIVED:['مؤرشف','Archived'],UPLOADED:['تم رفع الفيديو','Uploaded'],PENDING:['قيد الانتظار','Pending'],FAILED:['فشل','Failed'],COMPLETED:['مكتمل','Completed']};
  return labels[state]?.[ar?0:1] ?? (ar?'حالة غير معروفة':'Unknown state');
}
