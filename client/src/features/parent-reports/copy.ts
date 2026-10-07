/** Bilingual copy for the ADMIN Students & Parent Reports workspace.
 *
 * Arabic is primary (RTL) and English secondary (LTR). Keeping the strings in
 * the feature folder avoids touching the shared locale bundles, which are not
 * part of this worker's ownership.
 */

export interface Bilingual {
  ar: string;
  en: string;
}

function pick(value: Bilingual, lang: 'ar' | 'en'): string {
  return lang === 'ar' ? value.ar : value.en;
}

export function t(value: Bilingual, lang: 'ar' | 'en'): string {
  return pick(value, lang);
}

export const copy = {
  panelTitle: {
    ar: 'طلاب الكورس وتقارير أولياء الأمور',
    en: 'Course students & parent reports',
  },
  panelIntro: {
    ar: 'تصفح طلاب الكورس أو ابحث عن طالب، ثم اختر فترة التقرير. يتم توليد التقرير عند الضغط على الزر، وتُرسل الرسالة يدويًا في واتساب.',
    en: 'Browse the course students or search for a student, then choose the report period. Generate the report with the button and send the message manually in WhatsApp.',
  },
  search: {
    ar: 'ابحث في طلاب هذا الكورس بالاسم',
    en: 'Search this course roster by name',
  },
  searchHint: {
    ar: 'البحث يطبق على طلاب هذا الكورس فقط.',
    en: 'Search applies to this course roster only.',
  },
  loading: { ar: 'جارٍ التحميل…', en: 'Loading…' },
  retry: { ar: 'إعادة المحاولة', en: 'Retry' },
  rosterFailed: {
    ar: 'تعذّر تحميل قائمة طلاب هذا الكورس. لم تُحمَّل بيانات طلاب.',
    en: 'The course roster could not be loaded. No student data was loaded.',
  },
  emptyRoster: {
    ar: 'لا يوجد طلاب مسجلون في هذا الكورس. التسجيل وحده لا يمنح اشتراكًا.',
    en: 'No students are enrolled in this course. Registration alone does not grant course access.',
  },
  emptySearch: {
    ar: 'لا توجد نتائج لهذا البحث. جرّب اسمًا آخر.',
    en: 'No results for this search. Try another name.',
  },
  adminOnly: {
    ar: 'أعداد المشاهدات التفصيلية للإدارة فقط، ولا تظهر في نص التقرير.',
    en: 'Detailed view counts are ADMIN-only and never appear in the parent text.',
  },
  guardianAvailable: { ar: 'رقم ولي الأمر مسجل', en: 'Guardian number registered' },
  guardianMissing: {
    ar: 'لا يوجد رقم ولي أمر مسجل. يمكن عرض التقرير، لكن لا يمكن فتح محادثة واتساب.',
    en: 'No guardian number is registered. The report can be viewed, but no WhatsApp chat can be opened.',
  },
  noActivity: { ar: 'لا يوجد نشاط مسجل', en: 'No recorded activity' },
  viewsLabel: { ar: 'مشاهدات مسجلة', en: 'Recorded views' },
  unknownCount: { ar: 'غير معروف', en: 'Unknown' },
  lastViewed: { ar: 'آخر مشاهدة', en: 'Last viewed' },
  selectStudent: { ar: 'اختر طالبًا', en: 'Select a student' },
  selectedStudent: { ar: 'الطالب المختار', en: 'Selected student' },
  perVideoTitle: {
    ar: 'أعداد المشاهدة لكل فيديو (للإدارة فقط)',
    en: 'Per-video view counts (ADMIN only)',
  },
  perVideoIntro: {
    ar: 'العدد يخص نسخة الفيديو الحالية المعرّفة أدناه. لا يُفترض أن الفيديو القديم لم يُشاهَد.',
    en: 'Counts belong to the current media version shown below. An earlier media version is not assumed to be unseen.',
  },
  coverageKnown: { ar: 'التغطية معروفة', en: 'Coverage known' },
  coveragePartial: {
    ar: 'التغطية جزئية؛ قد لا تكون كل المشاهدات مسجلة.',
    en: 'Partial coverage; not every view may be recorded.',
  },
  coverageUnavailable: {
    ar: 'التعقب غير متاح لهذا الفيديو.',
    en: 'Tracking unavailable for this video.',
  },
  viewsFailed: {
    ar: 'تعذّر تحميل أعداد المشاهدة لهذا الطالب.',
    en: 'View counts could not be loaded for this student.',
  },
  trackingStarted: {
    ar: 'بدأ تسجيل المشاهدات في',
    en: 'View tracking started on',
  },
  trackingNotStarted: {
    ar: 'لم يبدأ تسجيل المشاهدات بعد. النشاط السابق غير مسجل وليس صفرًا.',
    en: 'View tracking has not started. Earlier activity is not recorded and is not zero.',
  },
  reportTitle: { ar: 'تقرير ولي الأمر', en: 'Parent report' },
  reportIntro: {
    ar: 'يُولَّد التقرير عند الضغط فقط. النص مؤقت ويُحذف فور handing-off إلى واتساب. لا يوجد أرشيف ولا سجل إرسال، ولا يستطيع المنصة معرفة إن كان الإرسال تم.',
    en: 'The report is generated only on click. The text is temporary and is discarded as soon as it is handed to WhatsApp. There is no archive and no sent log, and the platform cannot know whether the message was sent.',
  },
  scopeCourseOnly: { ar: 'هذا الكورس فقط', en: 'This course only' },
  scopeCombined: { ar: 'كورسات محددة', en: 'Selected courses' },
  scopeHint: {
    ar: 'التقرير يغطي الاشتراكات الحالية فقط. أرشفة الكورس تُعرض للاختيار إن كان متاحًا.',
    en: 'The report covers current memberships only. An archived course is offered for selection while it remains available.',
  },
  reportTypeWeek: { ar: 'أسبوع', en: 'Week' },
  reportTypeTwoWeeks: { ar: 'أسبوعان', en: 'Two weeks' },
  reportTypeFourWeeks: { ar: 'أربعة أسابيع', en: 'Four weeks' },
  reportTypeWeekHint: {
    ar: '٧ أيام تنتهي الآن، مقسمة إلى قسم أسبوعي واحد.',
    en: 'Seven days ending now, split into one weekly section.',
  },
  reportTypeTwoWeeksHint: {
    ar: '١٤ يومًا تنتهي الآن، مقسمة إلى قسمَي الأسبوع الأول والأسبوع الثاني.',
    en: 'Fourteen days ending now, split into Week 1 and Week 2.',
  },
  reportTypeFourWeeksHint: {
    ar: '٢٨ يومًا تنتهي الآن، مقسمة إلى أربعة أقسام أسبوعية.',
    en: 'Twenty-eight days ending now, split into four weekly sections.',
  },
  generate: { ar: 'توليد التقرير', en: 'Generate report' },
  generateAndSend: { ar: 'توليد وفتح واتساب', en: 'Generate & open WhatsApp' },
  noStudentReason: {
    ar: 'اختر طالبًا من القائمة أولًا.',
    en: 'Select a student from the roster first.',
  },
  noCourseReason: {
    ar: 'اختر كورسًا واحدًا على الأقل.',
    en: 'Select at least one course.',
  },
  busyReason: {
    ar: 'انتظر انتهاء الطلب الحالي.',
    en: 'Wait for the current request to finish.',
  },
  period: { ar: 'الفترة', en: 'Period' },
  periodNote: {
    ar: 'البداية شاملة والنهاية غير شاملة بتوقيت القاهرة.',
    en: 'Start is inclusive and end is exclusive, Africa/Cairo.',
  },
  generatedAt: { ar: 'وقت التوليد', en: 'Generated at' },
  preparedFor: { ar: 'المستلم الحالي', en: 'Current recipient' },
  partLabel: { ar: 'الجزء', en: 'Part' },
  openPart: { ar: 'فتح هذا الجزء في واتساب', en: 'Open this part in WhatsApp' },
  copyPart: { ar: 'نسخ النص', en: 'Copy text' },
  copied: { ar: 'تم نسخ النص. الصقه في محادثة واتساب بنفسك؛ المنصة لا ترسل ولا تؤكد الإرسال.', en: 'Text copied. Paste it into the WhatsApp chat yourself; the platform does not send and does not confirm delivery.' },
  copyFailed: { ar: 'تعذّر النسخ. حدّد النص وانسخه يدويًا.', en: 'Copy failed. Select the text and copy it manually.' },
  remaining: { ar: 'أجزاء لم تُسلَّم بعد', en: 'Parts not yet handed over' },
  allPartsHanded: {
    ar: 'سُلِّمت كل الأجزاء. حُذف نص المنصة؛ ويمكن للإدارة إعادة توليده عند الحاجة.',
    en: 'All parts were handed over. The platform copy is discarded; ADMIN can regenerate at any time.',
  },
  disposed: {
    ar: 'حُذف نص التقرير من المنصة. لا يمكن استعادته؛ ولّد تقريرًا جديدًا عند الحاجة.',
    en: 'The platform copy of the report was discarded. It cannot be recovered; generate a new report when needed.',
  },
  whatsappOpened: {
    ar: 'تم طلب فتح واتساب. الإرسال يتم يدويًا داخل المحادثة؛ لا يُعرف هنا إن كانت المحادثة فُتحت أو أُرسلت الرسالة.',
    en: 'WhatsApp open was requested. Sending stays manual inside the chat; this page cannot know whether the chat opened or the message was sent.',
  },
  popupBlocked: {
    ar: 'حظر المتصفح فتح النافذة. استخدم زر الفتح اليدوي أو النسخ أدناه. لم يتم تأكيد الإرسال.',
    en: 'The browser blocked the new window. Use the manual open or copy control below. Nothing is confirmed as sent.',
  },
  fallbackOpen: { ar: 'فتح المحادثة يدويًا', en: 'Open chat manually' },
  partTooLong: {
    ar: 'هذا الجزء أطول من حد رابط واتساب. انسخه والصقه في المحادثة؛ لم يُقتطع أي نص.',
    en: 'This part exceeds the WhatsApp URL limit. Copy it and paste it into the chat; nothing was truncated.',
  },
  contactChanged: {
    ar: 'تغيّر رقم ولي الأمر بعد تجهيز النص. حُذف النص ولم تُفتح أي محادثة. ولّد التقرير من جديد بعد مراجعة رقم ولي الأمر.',
    en: 'The guardian number changed after the text was prepared. The text was discarded and no chat was opened. Generate the report again after reviewing the guardian number.',
  },
  contactMissing: {
    ar: 'لا يوجد رقم ولي أمر مسجل حاليًا. يمكن عرض التقرير ونسخه، لكن لا يمكن فتح محادثة واتساب.',
    en: 'No guardian number is currently registered. The report can be viewed and copied, but no WhatsApp chat can be opened.',
  },
  contactUnverified: {
    ar: 'تعذّر التحقق من رقم ولي الأمر الآن، لذلك لم تُفتح المحادثة. أعد المحاولة.',
    en: 'The guardian number could not be rechecked now, so no chat was opened. Please retry.',
  },
  generateFailed: {
    ar: 'تعذّر توليد التقرير. لا يوجد نص محفوظ.',
    en: 'The report could not be generated. No text is held.',
  },
  coursesFailed: {
    ar: 'تعذّر تحميل كورسات هذا الطالب.',
    en: "This student's reportable courses could not be loaded.",
  },
  reportCoursesLabel: { ar: 'كورسات التقرير المتاحة', en: 'Available report courses' },
  disposeNow: { ar: 'حذف النص الآن', en: 'Discard text now' },
  cancel: { ar: 'إلغاء', en: 'Cancel' },
  adminRoleOnly: { ar: 'هذه الصفحة للإدارة فقط.', en: 'This page is ADMIN only.' },
  rosterPageLabel: { ar: 'صفحة القائمة', en: 'Roster page' },
  previous: { ar: 'السابق', en: 'Previous' },
  next: { ar: 'التالي', en: 'Next' },
  firstPage: { ar: 'أنت في أول صفحة.', en: 'You are on the first page.' },
  lastPage: { ar: 'أنت في آخر صفحة.', en: 'You are on the last page.' },
  viewsPageLabel: { ar: 'صفحة الدروس', en: 'Lesson page' },
  coursesPageLabel: { ar: 'صفحة الكورسات', en: 'Course page' },
  paginationNote: {
    ar: 'استخدم السابق والتالي لتصفح بقية القائمة.',
    en: 'Use Previous and Next to browse the rest of the list.',
  },
  viewedStatusNote: {
    ar: '«شاهد» تعني تشغيل ٣٠ ثانية على الأقل، ولا تعني إكمال الفيديو.',
    en: '"Viewed" means at least 30 seconds of playback; it does not mean the video was completed.',
  },
  whatsappDraftNote: {
    ar: 'المنصة تحذف نسختها فقط؛ لا يمكنها حذف المسودة أو الرسالة من جهازك أو من هاتف ولي الأمر.',
    en: 'The platform deletes only its own copy; it cannot erase the draft or message from your device or the guardian phone.',
  },
} as const;

export type CopyKey = keyof typeof copy;

export function bilingual(key: CopyKey): Bilingual {
  return copy[key] as Bilingual;
}

export function tr(key: CopyKey, lang: 'ar' | 'en'): string {
  return pick(bilingual(key), lang);
}

export type ReportTypeCopy = {
  label: Bilingual;
  hint: Bilingual;
};

export const reportTypeCopy = {
  WEEK: { label: copy.reportTypeWeek, hint: copy.reportTypeWeekHint },
  TWO_WEEKS: { label: copy.reportTypeTwoWeeks, hint: copy.reportTypeTwoWeeksHint },
  FOUR_WEEKS: { label: copy.reportTypeFourWeeks, hint: copy.reportTypeFourWeeksHint },
} as const;
