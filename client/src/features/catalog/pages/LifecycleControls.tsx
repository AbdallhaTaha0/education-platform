import { useEffect, useState } from 'react';
import { ApiError } from '../../../auth';
import { localizeCode, useLang } from '../../../i18n';
import { Button } from '../../../components/ui/Button';
import { FormActions } from '../../../components/ui/FormActions';
import { Notice } from '../../../components/ui/Notice';
import { ConfirmDialog } from '../../../components/ui/Dialog';
import { fetchLifecycleActions, transitionCourse } from '../api/client';
import type { LifecycleAction } from '../types/models';

export function LifecycleControls({courseId,status,onChanged}: {courseId:string;status:string;onChanged:()=>Promise<void>}): JSX.Element {
  const {t,lang}=useLang(); const ar=lang==='ar';
  const [actions,setActions]=useState<LifecycleAction[]>([]); const [busy,setBusy]=useState(false); const [error,setError]=useState<string|null>(null); const [retry,setRetry]=useState(0);
  const [confirmDraft,setConfirmDraft]=useState(false);
  useEffect(()=>{let live=true; setError(null); setActions([]); void fetchLifecycleActions(courseId).then(a=>{if(live)setActions(a);}).catch(()=>{if(live)setError('SERVICE_ERROR');});return()=>{live=false;};},[courseId,status,retry]);
  const target=({DRAFT:'PROCESSING',PROCESSING:'READY',READY:'PUBLISHED'} as Record<string,string>)[status]; const next=actions.find(a=>a.action===target);
  const draft=actions.find(a=>a.action==='DRAFT'&&a.enabled);
  async function run(action=next):Promise<void>{if(!action?.enabled || busy)return;setBusy(true);setError(null);try{const changed=await transitionCourse(courseId,action.action);if(changed.id!==courseId){window.location.hash=`#/admin/courses/${changed.id}`;}else{await onChanged();}setConfirmDraft(false);}catch(e){setError(e instanceof ApiError?e.code:'SERVICE_ERROR');}finally{setBusy(false);}}
  return <div className="my-5 space-y-3" aria-label={t.actionTransition}>
    {draft ? <><FormActions className="mt-0"><Button variant="secondary" data-testid="return-course-to-draft" disabled={busy||!draft} onClick={()=>setConfirmDraft(true)}>{ar?'إنشاء / فتح مسودة التعديل':'Create / open editing draft'}</Button></FormActions><p className="text-sm text-muted">{ar?'عدّل مسودة مستقلة بينما يبقى الإصدار الحالي منشورًا. انشر المسودة عندما تصبح جاهزة.':'Edit a separate draft while the current version stays published. Publish the draft when it is ready.'}</p></> : null}
    <ConfirmDialog open={confirmDraft} title={ar?'تعديل مسودة مستقلة':'Edit a separate draft'} body={ar?'يبقى الإصدار المنشور متاحًا للطلاب أثناء التعديل. تظهر تغييرات المسودة فقط عند نشرها، مع الحفاظ على الاشتراكات والتقدم.':'Students keep the current published version during editing. Draft changes become visible only when you publish them; subscriptions and progress remain unchanged.'} confirmLabel={ar?'فتح مسودة التعديل':'Open editing draft'} cancelLabel={t.actionCancel} onConfirm={()=>void run(draft)} onCancel={()=>{if(!busy)setConfirmDraft(false);}} />
    {error ? <><Notice kind="error">{localizeCode(t,error)}</Notice><FormActions className="mt-3"><Button variant="secondary" onClick={()=>setRetry(n=>n+1)}>{t.retryLabel}</Button></FormActions></>:null}
    {next ? <><FormActions className="mt-0"><Button disabled={busy || !next.enabled} disabledReason={busy ? undefined : { ar: "هذه الخطوة غير متاحة في حالة الكورس الحالية. حدّث حالة الكورس لمتابعة الخطوات بالترتيب.", en: "This step is unavailable in the current course state. Refresh the course status to follow the steps in order." }} onClick={()=>void run()}>{target==='PROCESSING'?(ar?'بدء تجهيز الفيديوهات':'Start processing'):target==='READY'?(ar?'التحقق من جاهزية الفيديوهات':'Check video readiness'):(ar?'نشر الكورس':'Publish course')}</Button></FormActions><p className="text-sm text-muted">{target==='PROCESSING'?(ar?'أكمل البيانات باللغتين وأضف عرضًا ودروسًا وفيديوهات مرفوعة.':'Complete bilingual details, an offer, lessons and uploaded videos.'):target==='READY'?(ar?'يجب أن تكون كل الفيديوهات جاهزة قبل الانتقال.':'Every video must be ready before continuing.'):(ar?'يتحقق الخادم من اكتمال البيانات وجاهزية الفيديوهات قبل النشر.':'The server checks bilingual content and video readiness before publication.')}</p></>:status==='PUBLISHED'?<Notice kind="success">{ar?'الكورس منشور ومتاح للمشتركين.':'The course is published and available to subscribers.'}</Notice>:status==='ARCHIVED'?<p>{ar?'أعد الكورس من الأرشيف لمتابعة إدارته.':'Restore the course from the archive to continue.'}</p>:!error?<p>{t.loading}</p>:null}
  </div>;
}
