/** "Students & Parent Reports" tab body for the ADMIN course workspace.
 *
 * Composes the server-paged roster, ADMIN-only per-video counts and the
 * click-driven parent-report handoff. It never loads the whole registered
 * population and never exposes detailed counts outside this ADMIN surface.
 */
import { useCallback, useState } from 'react';
import { useAuth } from '../../../auth';
import { useLang } from '../../../i18n';
import { Notice } from '../../../components/ui/Notice';
import { AdminCourseRoster, type RosterSelection } from './AdminCourseRoster';
import { AdminStudentVideoViews } from './AdminStudentVideoViews';
import { ParentReportWorkspace } from './ParentReportWorkspace';
import { tr } from '../copy';
import type { OpenedReportSelection } from '../useParentReportHandoff';

export function AdminCourseStudentsPanel({ courseId }: { courseId: string }): JSX.Element {
  const { user } = useAuth();
  const { lang } = useLang();
  const ar = lang === 'ar';
  const [selected, setSelected] = useState<RosterSelection | null>(null);
  const [showViews, setShowViews] = useState(false);
  // UI-only visit markers; never retain report text, phone or delivery claims.
  const [openedReports, setOpenedReports] = useState<ReadonlySet<string>>(() => new Set());
  const markOpened = useCallback(({ studentId, courseIds }: OpenedReportSelection) => {
    setOpenedReports(current => {
      const next = new Set(current);
      courseIds.forEach(id => next.add(`${id}:${studentId}`));
      return next;
    });
  }, []);

  const select = useCallback((next: RosterSelection) => {
    setShowViews(false);
    setSelected(next);
  }, []);

  // Backend authorization is the real control; this only avoids asking a
  // non-ADMIN for data the API will refuse.
  if (user?.role !== 'ADMIN') {
    return <Notice kind="error">{tr('adminRoleOnly', lang)}</Notice>;
  }

  return (
    <div className="grid gap-3" data-testid="admin-course-students">
      <AdminCourseRoster
        courseId={courseId}
        selectedStudentId={selected?.studentId ?? null}
        onSelect={select}
        openedReports={openedReports}
      />
      {selected === null ? (
        <Notice kind="info">{tr('noStudentReason', lang)}</Notice>
      ) : (
        <>
          <ParentReportWorkspace
            key={`${courseId}:${selected.studentId}`}
            courseId={courseId}
            studentId={selected.studentId}
            studentName={selected.name}
            guardianContactAvailable={selected.guardianContactAvailable}
            onReportOpened={markOpened}
          />
          <div>
            <button type="button" aria-expanded={showViews} onClick={() => setShowViews(value => !value)}
              className="min-h-[44px] text-sm text-muted underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
              {ar ? 'تفاصيل المشاهدات' : 'View details'}
            </button>
            {showViews ? <AdminStudentVideoViews key={`${courseId}:${selected.studentId}`} courseId={courseId} studentId={selected.studentId} /> : null}
          </div>
        </>
      )}
    </div>
  );
}
