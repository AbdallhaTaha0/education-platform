import { useState, type FormEvent } from 'react';
import { ApiError } from '../../../auth';
import { localizeCode, useLang } from '../../../i18n';
import { Button } from '../../../components/ui/Button';
import { Notice } from '../../../components/ui/Notice';
import { textInputClassName } from '../../../components/ui/Field';
import { useUnsavedChanges } from '../../../components/ui/UnsavedChanges';
export function EntityRename({titleAr,titleEn,onSave}:{titleAr:string;titleEn:string;onSave:(body:{titleAr:string;titleEn:string})=>Promise<void>}):JSX.Element {
  const {t,lang}=useLang();const [editing,setEditing]=useState(false);const [ar,setAr]=useState(titleAr);const [en,setEn]=useState(titleEn);const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  const discard=useUnsavedChanges(editing && (ar!==titleAr || en!==titleEn),lang==='ar'?'الاسم غير محفوظ. هل تريد ترك التعديل؟':'The name is unsaved. Discard this edit?');
  async function save(e:FormEvent<HTMLFormElement>):Promise<void>{e.preventDefault();if(busy || !e.currentTarget.reportValidity())return;setBusy(true);setError('');try{await onSave({titleAr:ar,titleEn:en});setEditing(false);}catch(e){setError(e instanceof ApiError?e.code:'SERVICE_ERROR');}finally{setBusy(false);}}
  return editing?<form onSubmit={e=>void save(e)} className="flex flex-wrap items-end gap-2"><label>{t.fieldTitleAr}<input required maxLength={200} className={textInputClassName(false)} value={ar} onChange={e=>setAr(e.target.value)}/></label><label>{t.fieldTitleEn}<input required maxLength={200} dir="ltr" className={textInputClassName(false)} value={en} onChange={e=>setEn(e.target.value)}/></label><Button type="submit" disabled={busy}>{t.submitSave}</Button><Button type="button" variant="secondary" disabled={busy} onClick={()=>{if(discard()){setEditing(false);setError('');}}}>{t.cancel}</Button>{error?<Notice kind="error">{localizeCode(t,error)}</Notice>:null}</form>:<Button variant="secondary" onClick={()=>{setAr(titleAr);setEn(titleEn);setEditing(true);}}>{t.actionEdit}</Button>;
}
