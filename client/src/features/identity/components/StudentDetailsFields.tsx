import { useLang } from '../../../i18n';
import { Field, textInputClassName } from '../../../components/ui/Field';
export interface StudentDetails { nationalId: string; parentPhone: string; schoolYear: string; governorate: string; schoolName: string }
export const emptyStudentDetails: StudentDetails = { nationalId:'',parentPhone:'',schoolYear:'',governorate:'',schoolName:'' };
const years = [
 ['SECONDARY_1','أولى ثانوي','First secondary'],
 ['SECONDARY_2','تانية ثانوي','Second secondary'],
];
const governorates = [
 ['CAIRO','القاهرة','Cairo'],['GIZA','الجيزة','Giza'],['ALEXANDRIA','الإسكندرية','Alexandria'],['DAKAHLIA','الدقهلية','Dakahlia'],['RED_SEA','البحر الأحمر','Red Sea'],['BEHEIRA','البحيرة','Beheira'],['FAYOUM','الفيوم','Fayoum'],['GHARBIA','الغربية','Gharbia'],['ISMAILIA','الإسماعيلية','Ismailia'],['MENOUFIA','المنوفية','Menoufia'],['MINYA','المنيا','Minya'],['QALYUBIA','القليوبية','Qalyubia'],['NEW_VALLEY','الوادي الجديد','New Valley'],['SUEZ','السويس','Suez'],['ASWAN','أسوان','Aswan'],['ASSIUT','أسيوط','Assiut'],['BENI_SUEF','بني سويف','Beni Suef'],['PORT_SAID','بورسعيد','Port Said'],['DAMIETTA','دمياط','Damietta'],['SHARQIA','الشرقية','Sharqia'],['SOUTH_SINAI','جنوب سيناء','South Sinai'],['KAFR_EL_SHEIKH','كفر الشيخ','Kafr El Sheikh'],['MATROUH','مطروح','Matrouh'],['LUXOR','الأقصر','Luxor'],['QENA','قنا','Qena'],['NORTH_SINAI','شمال سيناء','North Sinai'],['SOHAG','سوهاج','Sohag'],['OTHER','أخرى / خارج مصر','Other / outside Egypt'],
];
export function studentDataError(code: string | undefined, ar: boolean): string {
 if(code==='NATIONAL_ID_TAKEN')return ar?'هذا الرقم القومي مسجل بحساب آخر. لا يمكن إنشاء حساب ثانٍ بنفس الرقم.':'This national ID is already registered. A second account cannot use it.';
 if(code==='PROFILE_CHANGED')return ar?'تغيرت البيانات. أعد تحميلها قبل الحفظ؛ تعديلاتك ما زالت في النموذج.':'The details changed. Reload before saving; your edits are still in the form.';
 if(code==='NATIONAL_ID_ADMIN_ONLY')return ar?'لتصحيح الرقم القومي، تواصل مع الإدارة.':'Contact ADMIN to correct your national ID.';
 if(code==='STUDENT_DATA_UNCONFIGURED')return ar?'التسجيل غير متاح مؤقتًا. حاول لاحقًا.':'Registration is temporarily unavailable. Please try later.';
 return ar?'تعذر الحفظ. راجع البيانات المطلوبة وحاول مجددًا.':'Could not save. Check the required details and retry.';
}
export function StudentDetailsFields({value,onChange,prefix,maskedId,errorField,errorCode,admin=false,disabled=false}:{value:StudentDetails;onChange:(value:StudentDetails)=>void;prefix:string;maskedId?:string|null;errorField?:string;errorCode?:string;admin?:boolean;disabled?:boolean}):JSX.Element {
 const {lang}=useLang(),ar=lang==='ar';const label=(a:string,e:string)=>ar?a:e;
 const set=(field:keyof StudentDetails,text:string)=>onChange({...value,[field]:text});
 const error=(field:string)=>errorField===field?studentDataError(errorCode,ar):undefined;
 return <fieldset disabled={disabled} className="space-y-3" data-testid="student-details-fields"><legend className="mb-3 font-bold">{label('بيانات الطالب','Student details')}</legend>
 {maskedId?<p className="text-sm">{label('الرقم القومي المسجل','Registered national ID')}: <bdi dir="ltr">{maskedId}</bdi>{!admin?<span className="block text-muted">{label('تصحيح الرقم القومي عن طريق الإدارة فقط.','National ID corrections are handled by ADMIN.')}</span>:null}</p>:null}
 {!maskedId||admin?<Field id={`${prefix}-national-id`} label={admin&&maskedId?label('رقم قومي بديل (اتركه فارغًا للاحتفاظ بالحالي)','Replacement national ID (leave blank to keep current)'):label('الرقم القومي','National ID')} error={error('nationalId')}>
 <input id={`${prefix}-national-id`} name="nationalId" dir="ltr" type="text" inputMode="numeric" autoComplete="off" required={!maskedId&&!admin} minLength={14} maxLength={14} pattern="[0-9٠-٩۰-۹]{14}" value={value.nationalId} onChange={e=>set('nationalId',e.target.value)} aria-invalid={errorField==='nationalId'} aria-describedby={`${prefix}-id-hint`} className={textInputClassName(errorField==='nationalId')}/><p id={`${prefix}-id-hint`} className="mt-2 text-sm text-muted">{label('١٤ رقمًا. يستخدم لمنع تكرار الحسابات، ويُحفظ مشفرًا. هذا ليس تحققًا حكوميًا من الهوية.','14 digits. Used to prevent duplicate accounts and stored encrypted. This is not government identity verification.')}</p></Field>:null}
 <Field id={`${prefix}-parent-phone`} label={label('رقم هاتف ولي الأمر','Parent/guardian phone')} error={error('parentPhone')}><input id={`${prefix}-parent-phone`} name="parentPhone" type="tel" dir="ltr" autoComplete="off" inputMode="tel" required={!admin} maxLength={25} value={value.parentPhone} onChange={e=>set('parentPhone',e.target.value)} aria-invalid={errorField==='parentPhone'} className={textInputClassName(errorField==='parentPhone')}/></Field>
 {(['schoolYear','governorate'] as const).map(field=><Field key={field} id={`${prefix}-${field}`} label={field==='schoolYear'?label('الصف الدراسي','School year'):label('المحافظة','Governorate')} error={error(field)}><select id={`${prefix}-${field}`} name={field} required={!admin} value={value[field]} onChange={e=>set(field,e.target.value)} aria-invalid={errorField===field} className={textInputClassName(errorField===field)}><option value="">{label('اختر…','Select…')}</option>{(field==='schoolYear'?years:governorates).map(([key,a,e])=><option key={key} value={key}>{ar?a:e}</option>)}</select></Field>)}
 <Field id={`${prefix}-school-name`} label={label('اسم المدرسة (اختياري)','School name (optional)')} error={error('schoolName')}><input id={`${prefix}-school-name`} name="schoolName" maxLength={150} value={value.schoolName} onChange={e=>set('schoolName',e.target.value)} className={textInputClassName(errorField==='schoolName')}/></Field>
 </fieldset>;
}
