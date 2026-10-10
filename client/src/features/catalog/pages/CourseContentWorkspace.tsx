import { useEffect, useRef, useState } from 'react';
import { useLang } from '../../../i18n';
import { useConfirmNavigation } from '../../../components/ui/UnsavedChanges';
import { Button } from '../../../components/ui/Button';
import { PaginatedCollection } from '../../../components/ui/Pagination';
import { textInputClassName } from '../../../components/ui/Field';
import type { AdminCourseDetail } from '../types/models';
import { LessonList } from './LessonEditor';
import { SectionEditor } from './SectionEditor';
import { DeletionPanel } from './DeletionPanel';

export function CourseContentWorkspace({ course, mode, onChanged, blockedReason, additionBlockedReason }: {
  course: AdminCourseDetail; mode: 'video' | 'assessments' | 'materials'; onChanged: () => Promise<void>; blockedReason?: string; additionBlockedReason?: string;
}): JSX.Element {
  const { lang } = useLang(); const ar = lang === 'ar'; const confirmLeave = useConfirmNavigation();
  const [selected, setSelected] = useState(course.sections[0]?.id ?? ''), [search, setSearch] = useState('');
  const [createdSection, setCreatedSection] = useState<string | null>(null);
  const sectionHeading = useRef<HTMLHeadingElement>(null);
  const sections = course.sections.filter(s => `${s.titleAr} ${s.titleEn} ${s.lessons.map(l => `${l.titleAr} ${l.titleEn}`).join(' ')}`.toLowerCase().includes(search.trim().toLowerCase()));
  const section = course.sections.find(s => s.id === selected) ?? course.sections[0];
  const selectedId = section?.id ?? '';
  useEffect(() => { if (selected !== selectedId) setSelected(selectedId); }, [selected, selectedId]);
  useEffect(() => {
    if (!createdSection || !course.sections.some(s => s.id === createdSection)) return;
    setSelected(createdSection);
    setSearch('');
    if (selectedId !== createdSection) return;
    sectionHeading.current?.focus({ preventScroll: true });
    sectionHeading.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    setCreatedSection(null);
  }, [createdSection, course.sections, selectedId]);
  return <div data-testid="course-content-workspace">
    <p className="mb-4 text-sm text-muted">{course.sections.length} {ar ? 'أقسام' : 'sections'} · {course.sections.reduce((sum, s) => sum + s.lessons.length, 0)} {ar ? 'دروس' : 'lessons'} · {ar ? 'اختَر قسمًا ثم درسًا للعمل عليه.' : 'Choose a section, then a lesson to work on.'}</p>
    {mode === 'video' ? <details className="mb-5 rounded-control border border-border p-4" data-testid="manage-sections" open={course.sections.length === 0 ? true : undefined}>
      <summary className="cursor-pointer font-bold">{ar ? 'إضافة الأقسام وتعديل ترتيبها' : 'Add sections & edit their order'}</summary>
      <SectionEditor courseId={course.id} sections={course.sections} onChanged={onChanged} onCreated={setCreatedSection} blockedReason={blockedReason} />
    </details> : null}
    <label htmlFor="section-workspace-search" className="block text-sm font-semibold">{ar ? 'ابحث باسم القسم أو أحد دروسه' : 'Find a section or its lessons'}</label>
    <input id="section-workspace-search" value={search} maxLength={100} onChange={e => setSearch(e.target.value)} className={`${textInputClassName(false)} mt-2 mb-3`} />
    <div className="grid min-w-0 gap-5 xl:grid-cols-[240px_minmax(0,1fr)]">
      <nav aria-label={ar ? 'أقسام الكورس' : 'Course sections'} className="min-w-0">
        <PaginatedCollection id="course-sections" resetKey={search} className="space-y-2">
          {sections.map(s => <Button key={s.id} variant="secondary" unstyled aria-pressed={s.id === section?.id} aria-controls="selected-section-workspace" className={`min-h-[48px] w-full break-words rounded-control border p-3 text-start ${s.id === section?.id ? 'border-primary bg-elevated' : 'border-border bg-surface'}`} onClick={() => { if (s.id !== section?.id && confirmLeave()) setSelected(s.id); }}><span className="block font-bold">#{s.position} {ar ? s.titleAr : s.titleEn}</span><span className="text-sm text-muted">{s.lessons.length} {ar ? 'دروس' : 'lessons'}</span></Button>)}
        </PaginatedCollection>
        {!sections.length ? <p className="mt-3 text-sm text-muted">{ar ? 'لا توجد أقسام مطابقة.' : 'No matching sections.'}</p> : null}
      </nav>
      <section id="selected-section-workspace" className="min-w-0 rounded-card border border-border p-4 sm:p-5">
        {section ? <><h3 ref={sectionHeading} tabIndex={-1} className="text-xl font-bold">#{section.position} {ar ? section.titleAr : section.titleEn}</h3>
          <LessonList key={`${section.id}-${mode}`} sectionId={section.id} lessons={section.lessons} onChanged={onChanged} blockedReason={blockedReason} additionBlockedReason={additionBlockedReason} workspaceMode={mode} />
          {mode === 'video' ? <DeletionPanel kind="sections" targetId={section.id} expectedConfirmation={section.id} entityName={ar ? section.titleAr : section.titleEn} onChanged={onChanged} /> : null}
        </> : <p>{ar ? 'أضف أول قسم للبدء.' : 'Add the first section to begin.'}</p>}
      </section>
    </div>
  </div>;
}
