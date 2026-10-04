import { useEffect, useState, type FormEvent } from 'react';
import { apiFetch, ApiError } from '../../../auth';
import { useLang } from '../../../i18n';
import { Button } from '../../../components/ui/Button';
import { FormActions } from '../../../components/ui/FormActions';
import { Notice, Loading } from '../../../components/ui/Notice';
import { useUnsavedChanges } from '../../../components/ui/UnsavedChanges';
import { StudentDetailsFields, emptyStudentDetails, studentDataError, type StudentDetails } from './StudentDetailsFields';
interface Profile extends Omit<StudentDetails,'nationalId'> { nationalIdMasked:string|null;version:number;complete:boolean }
export function StudentProfileForm({studentId}:{studentId?:string}):JSX.Element {
 const {lang}=useLang(),ar=lang==='ar';const admin=Boolean(studentId),path=admin?`/admin/students/${studentId}/profile`:'/auth/student-profile';
 const [profile,setProfile]=useState<Profile|null>(null),[value,setValue]=useState<StudentDetails>({...emptyStudentDetails}),[baseline,setBaseline]=useState(''),[retry,setRetry]=useState(0),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[errorField,setErrorField]=useState<string>(),[errorCode,setErrorCode]=useState<string>(),[success,setSuccess]=useState(false);
 const dirty=!!baseline&&JSON.stringify(value)!==baseline;
 useUnsavedChanges(dirty,ar?'توجد بيانات طالب غير محفوظة. هل تريد المغادرة؟':'You have unsaved student details. Leave without saving?');
 useEffect(()=>{let active=true;setLoading(true);setError('');void apiFetch<{data:Profile}>(path).then(r=>{if(!active)return;const next={...emptyStudentDetails,...r.data,nationalId:''};setProfile(r.data);setValue(next);setBaseline(JSON.stringify(next));}).catch(()=>{if(active)setError(ar?'تعذر تحميل بيانات الطالب.':'Could not load student details.');}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[path,retry]);
 async function save(event:FormEvent<HTMLFormElement>):Promise<void>{event.preventDefault();if(busy||!profile||!event.currentTarget.reportValidity())return;setBusy(true);setError('');setSuccess(false);setErrorField(undefined);setErrorCode(undefined);
  const body:Record<string,unknown>={version:profile.version};for(const key of ['parentPhone','schoolYear','governorate','schoolName'] as const)if(value[key]!==profile[key]||(!admin&&!profile.complete))body[key]=value[key];if(value.nationalId)body.nationalId=value.nationalId;
  try{const r=await apiFetch<{data:Profile}>(path,{method:'PATCH',body});const next={...emptyStudentDetails,...r.data,nationalId:''};setProfile(r.data);setValue(next);setBaseline(JSON.stringify(next));setSuccess(true);}catch(err){const code=err instanceof ApiError?err.code:undefined;setErrorCode(code);setError(studentDataError(code,ar));if(err instanceof ApiError)setErrorField((err.details as {field?:string}|undefined)?.field);}finally{setBusy(false);}
 }
 if(loading)return <Loading text={ar?'تحميل بيانات الطالب…':'Loading student details…'}/>;
 return <section className="my-5 border-t border-border pt-5" data-testid="student-profile-form" data-dirty={dirty}>{error?<Notice kind="error">{error}</Notice>:null}{success?<Notice kind="success">{ar?'تم حفظ بيانات الطالب.':'Student details saved.'}</Notice>:null}
 {!profile?<Button variant="secondary" onClick={()=>setRetry(n=>n+1)}>{ar?'إعادة المحاولة':'Retry'}</Button>:<><p className="mb-3 text-sm text-muted">{profile.complete?(ar?'بيانات الطالب مكتملة.':'Student details are complete.'):(ar?'يمكن للحسابات القديمة إكمال البيانات اختياريًا؛ الوصول إلى الدورات لا يتغير.':'Existing accounts can complete these details voluntarily; course access is unchanged.')}</p><form onSubmit={e=>void save(e)}><StudentDetailsFields prefix={admin?'admin-student':'profile-student'} value={value} onChange={setValue} maskedId={profile.nationalIdMasked} admin={admin} disabled={busy} errorField={errorField} errorCode={errorCode}/><FormActions><Button type="submit" disabled={busy||!dirty} disabledReason={ar?'غيّر البيانات أولًا، أو انتظر انتهاء الحفظ.':'Change the details first, or wait for saving to finish.'}>{ar?'حفظ بيانات الطالب':'Save student details'}</Button>{errorCode==='PROFILE_CHANGED'?<Button type="button" variant="secondary" onClick={()=>{if(!dirty||window.confirm(ar?'إعادة التحميل ستستبدل التعديلات غير المحفوظة. متابعة؟':'Reload will replace unsaved edits. Continue?'))setRetry(n=>n+1);}}>{ar?'إعادة تحميل البيانات':'Reload details'}</Button>:null}</FormActions></form></>}
 </section>;
}
