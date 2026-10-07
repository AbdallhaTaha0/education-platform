/** Compact click-only report handoff; text remains transient. */
import { useEffect, useState } from 'react';
import { useLang } from '../../../i18n';
import { Button } from '../../../components/ui/Button';
import { tr, type CopyKey } from '../copy';
import { useParentReportHandoff, type HandoffNote, type OpenedReportSelection } from '../useParentReportHandoff';
import { isSameSelection } from '../session';
import type { ReportType } from '../types';
import { ReportCoursePicker } from './ReportCoursePicker';

const noteCopy: Record<Exclude<HandoffNote, null>, CopyKey> = {
  OPENED: 'whatsappOpened', POPUP_BLOCKED: 'popupBlocked', PART_TOO_LONG: 'partTooLong',
  CONTACT_CHANGED: 'contactChanged', CONTACT_MISSING: 'contactMissing',
  CONTACT_UNVERIFIED: 'contactUnverified', COPIED: 'copied', COPY_FAILED: 'copyFailed',
};
export interface ParentReportWorkspaceProps {
  courseId: string; studentId: string; studentName: string; guardianContactAvailable: boolean;
  onReportOpened?: (selection: OpenedReportSelection) => void;
}
export function ParentReportWorkspace({ courseId, studentId, studentName, guardianContactAvailable, onReportOpened }: ParentReportWorkspaceProps): JSX.Element {
  const { lang } = useLang();
  const ar = lang === 'ar';
  const handoff = useParentReportHandoff(onReportOpened);
  const [reportType, setReportType] = useState<ReportType>('WEEK');
  const [courseIds, setCourseIds] = useState<string[]>([courseId]);
  const [showCourses, setShowCourses] = useState(false);
  const busy = handoff.generating;
  useEffect(() => { setCourseIds([courseId]); }, [courseId, studentId]);
  const selectionKey = studentId + '|' + [...courseIds].sort().join(',');
  useEffect(() => {
    if (handoff.state.studentId !== null && !isSameSelection(handoff.state, { studentId, courseIds })) handoff.dispose();
    // Selection guards cancel pending generation/contact requests.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectionKey, handoff.state.studentId]);
  useEffect(() => {
    if (handoff.state.reportType && (handoff.state.reportType !== reportType || handoff.state.language !== lang)) handoff.dispose();
  }, [reportType, lang, handoff.state.reportType, handoff.state.language, handoff.dispose]);
  const parts = handoff.state.parts.filter(part => part.text);
  return (
    <section aria-labelledby="parent-report-heading" data-testid="parent-report-workspace" className="rounded-card border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 id="parent-report-heading" className="font-bold">{studentName}</h3>
          <p className="mt-1 text-xs text-muted">{ar ? 'تقرير ولي الأمر' : 'Parent report'}</p>
        </div>
        <div className="flex w-full flex-wrap items-end gap-2 sm:w-auto">
          <label className="min-w-32 flex-1 text-sm font-semibold sm:flex-none">
            {ar ? 'المدة' : 'Period'}
            <select data-testid="report-type-picker" value={reportType} disabled={busy}
              onChange={event => setReportType(event.target.value as ReportType)}
              className="mt-1 block min-h-[44px] w-full rounded-control border border-border bg-surface px-3 text-ink">
              <option value="WEEK">{ar ? 'أسبوع' : 'One week'}</option>
              <option value="TWO_WEEKS">{ar ? 'أسبوعان' : 'Two weeks'}</option>
              <option value="FOUR_WEEKS">{ar ? 'شهر (٤ أسابيع)' : 'Month (4 weeks)'}</option>
            </select>
          </label>
          <Button type="button" data-testid="generate-and-open-whatsapp"
            disabledReason="" aria-describedby={!guardianContactAvailable ? 'guardian-contact-warning' : undefined}
            disabled={busy || !studentId || courseIds.length === 0 || !guardianContactAvailable}
            onClick={() => handoff.generateAndSend({ studentId, courseIds, reportType, language: lang, format: 'SHORT' })}>
            {busy ? (ar ? 'جارٍ التجهيز…' : 'Preparing…') : (ar ? 'إرسال واتساب' : 'Send via WhatsApp')}
          </Button>
          {busy ? <Button type="button" variant="secondary" data-testid="cancel-generation" onClick={handoff.dispose}>{tr('cancel', lang)}</Button> : null}
        </div>
      </div>
      {!guardianContactAvailable ? <p id="guardian-contact-warning" className="mt-2 text-sm text-error-fg">{ar ? 'أضف رقم ولي الأمر لإرسال التقرير.' : 'Add a guardian number to send the report.'}</p> : null}
      <button type="button" aria-expanded={showCourses} disabled={busy} onClick={() => setShowCourses(value => !value)}
        className="mt-2 min-h-[44px] text-sm text-muted underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
        {ar ? 'تضمين كورسات أخرى' : 'Include other courses'}{courseIds.length > 1 ? ' (' + courseIds.length + ')' : ''}
      </button>
      {showCourses ? <ReportCoursePicker studentId={studentId} currentCourseId={courseId} selected={courseIds} onChange={setCourseIds} disabled={busy} /> : null}
      {handoff.note ? <p className="mt-2 text-sm" data-testid="handoff-note" role="status">{tr(noteCopy[handoff.note], lang)}</p> : null}
      {handoff.state.error ? <p className="mt-2 text-sm text-error-fg" role="alert">{ar ? 'تعذّر تجهيز التقرير. حاول مرة أخرى.' : 'Could not prepare the report. Try again.'}</p> : null}
      {parts.length > 0 ? <div className="mt-3" data-testid="report-parts">
        {parts.map(part => <div key={part.index}>
          <pre data-testid={'report-text-' + part.index} dir={lang === 'ar' ? 'rtl' : 'ltr'}
            className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-control bg-elevated p-3 text-sm">{part.text}</pre>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button type="button" variant="secondary" data-testid={'copy-part-' + part.index} onClick={() => void handoff.copyPart(part.index)}>{ar ? 'نسخ الرسالة' : 'Copy message'}</Button>
            <Button type="button" data-testid={'manual-open-part-' + part.index} disabledReason="" disabled={!handoff.canHandOff} onClick={() => handoff.openPartManually(part.index)}>{ar ? 'فتح واتساب' : 'Open WhatsApp'}</Button>
            <Button type="button" variant="secondary" data-testid="dispose-report" onClick={handoff.dispose}>{tr('cancel', lang)}</Button>
          </div>
        </div>)}
      </div> : null}
    </section>
  );
}
