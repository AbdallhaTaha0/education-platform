import { randomUUID } from 'node:crypto';
import type { Course, Prisma } from '@prisma/client';
import { ApiError } from '../../identity/errors.js';
import type { TxClient } from '../types.js';
import { audit } from '../audit.js';

const details = (c: Course) => ({ titleAr: c.titleAr, titleEn: c.titleEn, descriptionAr: c.descriptionAr, descriptionEn: c.descriptionEn, grade: c.grade, academicYear: c.academicYear, term: c.term, courseKind: c.courseKind, teachingMonth: c.teachingMonth });
const json = (v: Prisma.JsonValue) => v as Prisma.InputJsonValue;

/** Called under the canonical course lock. A working copy never owns inherited video objects. */
export async function createWorkingCopy(tx: TxClient, actor: string, live: Course) {
  if (live.status !== 'PUBLISHED' || live.revisionOwnerId || live.historical) {
    throw new ApiError(409, 'INVALID_TRANSITION', 'Only a published course can create an editing draft.');
  }
  if (live.workingCopyId) return tx.course.findUniqueOrThrow({ where: { id: live.workingCopyId } });
  const draft = await tx.course.create({ data: { ...details(live), slug: `draft-${randomUUID()}`, requestedSlug: live.slug, revisionOwnerId: live.id } });
  const sections = await tx.courseSection.findMany({ where: { courseId: live.id }, include: { lessons: { include: { media: true, assessments: { include: { versions: true } } } } } });
  for (const s of sections) {
    const copy = await tx.courseSection.create({ data: { courseId: draft.id, originId: s.id, titleAr: s.titleAr, titleEn: s.titleEn, position: s.position } });
    for (const l of s.lessons) {
      const lesson = await tx.lesson.create({ data: { sectionId: copy.id, originId: l.id, inheritedMediaId: l.media?.id ?? null, titleAr: l.titleAr, titleEn: l.titleEn, position: l.position } });
      for (const a of l.assessments) {
        const copied = await tx.assessment.create({ data: { lessonId: lesson.id, originId: a.id, kind: a.kind, status: a.status, required: a.required, draftRequired: a.draftRequired, version: a.version, content: json(a.content) } });
        if (a.versions.length) await tx.assessmentVersion.createMany({ data: a.versions.map(v => ({ assessmentId: copied.id, version: v.version, content: json(v.content) })) });
      }
    }
  }
  const plans = await tx.subscriptionPlan.findMany({ where: { courseId: live.id } });
  if (plans.length) await tx.subscriptionPlan.createMany({ data: plans.map(p => ({ courseId: draft.id, originId: p.id, currentPricePiastres: p.currentPricePiastres, previousPricePiastres: p.previousPricePiastres, durationDays: p.durationDays, accessMode: p.accessMode, accessEndsAt: p.accessEndsAt })) });
  await tx.course.update({ where: { id: live.id }, data: { workingCopyId: draft.id } });
  await audit(tx, { actorUserId: actor, action: 'COURSE_DRAFT_CREATED', entityType: 'Course', entityId: live.id, metadata: { draftId: draft.id } });
  return draft;
}

export async function effectiveHierarchy(tx: TxClient, courseId: string) {
  const course = await tx.course.findUniqueOrThrow({ where: { id: courseId }, include: { plans: { orderBy: { createdAt: 'asc' } }, sections: { orderBy: { position: 'asc' }, include: { lessons: { orderBy: { position: 'asc' }, include: { media: true } } } } } });
  const ids = course.sections.flatMap(s => s.lessons.flatMap(l => l.inheritedMediaId ? [l.inheritedMediaId] : []));
  const inherited = await tx.mediaMapping.findMany({ where: { id: { in: ids }, retiredAt: null } });
  const byId = new Map(inherited.map(m => [m.id, m]));
  return { ...course, slug: course.requestedSlug ?? course.slug, sections: course.sections.map(s => ({ ...s, lessons: s.lessons.map(l => ({ ...l, media: l.media ?? (l.inheritedMediaId ? byId.get(l.inheritedMediaId) ?? null : null) })) })) };
}

/** Preserve stable public IDs and learning records; retain removed rows privately until course deletion. */
export async function publishWorkingCopy(tx: TxClient, actor: string, draft: Course) {
  const live = await tx.course.findUniqueOrThrow({ where: { id: draft.revisionOwnerId! } });
  if (live.workingCopyId !== draft.id || live.status !== 'PUBLISHED' || live.deletionRequestedAt) throw new ApiError(409, 'INVALID_TRANSITION', 'The published course changed; restore it before publishing the draft.');
  const sections = await tx.courseSection.findMany({ where: { courseId: draft.id }, orderBy: { position: 'asc' }, include: { lessons: { orderBy: { position: 'asc' }, include: { media: true, assessments: { include: { versions: true } } } } } });
  const oldSections = await tx.courseSection.findMany({ where: { courseId: live.id }, include: { lessons: true } });
  // Positive staging positions preserve the database's position > 0 constraints.
  for (const s of oldSections) {
    await tx.courseSection.update({ where: { id: s.id }, data: { position: s.position + 1000000 } });
    for (const l of s.lessons) await tx.lesson.update({ where: { id: l.id }, data: { position: l.position + 1000000 } });
  }
  const retained = await tx.courseSection.create({ data: { courseId: draft.id, titleAr: 'سجل المحتوى السابق', titleEn: 'Previous content history', position: sections.length + 1000000 } });
  let retainedPosition = 1;
  const retire = async (mappingId: string) => {
    const holder = await tx.lesson.create({ data: { sectionId: retained.id, titleAr: 'فيديو سابق', titleEn: 'Previous video', position: retainedPosition++ } });
    await tx.mediaMapping.update({ where: { id: mappingId }, data: { lessonId: holder.id, retiredAt: new Date(), retirementNextAttempt: new Date() } });
  };
  const keptLessons = new Set<string>();
  const keptSections = new Set<string>();
  for (const s of sections) {
    const sectionId = s.originId ?? s.id;
    if (s.originId && !oldSections.some(o => o.id === s.originId)) throw new ApiError(409, 'INVALID_TRANSITION', 'Draft section origin is invalid.');
    await tx.courseSection.update({ where: { id: sectionId }, data: { courseId: live.id, titleAr: s.titleAr, titleEn: s.titleEn, position: s.position, originId: null } });
    keptSections.add(sectionId);
    for (const l of s.lessons) {
      const lessonId = l.originId ?? l.id;
      if (l.originId && !oldSections.some(o => o.lessons.some(old => old.id === l.originId))) throw new ApiError(409, 'INVALID_TRANSITION', 'Draft lesson origin is invalid.');
      if (l.originId) {
        const oldMedia = await tx.mediaMapping.findUnique({ where: { lessonId } });
        if (l.media && oldMedia) await retire(oldMedia.id);
        if (l.media) await tx.mediaMapping.update({ where: { id: l.media.id }, data: { lessonId } });
        // New caption uploads replace the old pair only at publication.
        const captions = await tx.lessonCaption.findMany({ where: { lessonId: l.id } });
        if (captions.length) {
          const old = await tx.lessonCaption.findMany({ where: { lessonId } });
          await tx.materialObject.updateMany({ where: { storageKey: { in: old.map(c => c.storageKey) } }, data: { state: 'DELETE' } });
          await tx.lessonCaption.deleteMany({ where: { lessonId } });
          await tx.lessonCaption.updateMany({ where: { lessonId: l.id }, data: { lessonId } });
        }
        await tx.lessonResource.updateMany({ where: { lessonId: l.id }, data: { lessonId } });
      }
      await tx.lesson.update({ where: { id: lessonId }, data: { sectionId, titleAr: l.titleAr, titleEn: l.titleEn, position: l.position, originId: null, inheritedMediaId: null } });
      keptLessons.add(lessonId);
      const keepAssessments = new Set<string>();
      for (const a of l.assessments) {
        if (!a.originId) { await tx.assessment.update({ where: { id: a.id }, data: { lessonId } }); keepAssessments.add(a.id); continue; }
        const old = await tx.assessment.findUniqueOrThrow({ where: { id: a.originId } });
        if (old.lessonId !== lessonId) throw new ApiError(409, 'INVALID_TRANSITION', 'Draft assessment origin is invalid.');
        keepAssessments.add(old.id);
        let version = old.version;
        if (a.status === 'PUBLISHED') {
          const frozen = a.versions.find(v => v.version === a.version);
          const previous = await tx.assessmentVersion.findUnique({ where: { assessmentId_version: { assessmentId: old.id, version: old.version } } });
          if (!frozen) throw new ApiError(409, 'TESTS_NOT_READY', 'Publish assessment tests before publishing the course.');
          if (JSON.stringify(frozen.content) !== JSON.stringify(previous?.content) || a.required !== old.required || old.status !== 'PUBLISHED') {
            version++;
            await tx.assessmentVersion.create({ data: { assessmentId: old.id, version, content: json(frozen.content) } });
          }
        }
        await tx.assessment.update({ where: { id: old.id }, data: { kind: a.kind, content: json(a.content), status: a.status, required: a.required, draftRequired: a.draftRequired, version } });
      }
      if (l.originId) await tx.assessment.updateMany({ where: { lessonId, id: { notIn: [...keepAssessments] } }, data: { status: 'ARCHIVED' } });
    }
  }
  for (const s of oldSections) {
    for (const l of s.lessons) if (!keptLessons.has(l.id)) {
      await tx.lesson.update({ where: { id: l.id }, data: { sectionId: retained.id, position: retainedPosition++ } });
      await tx.mediaMapping.updateMany({ where: { lessonId: l.id }, data: { retiredAt: new Date(), retirementNextAttempt: new Date() } });
    }
    if (!keptSections.has(s.id)) await tx.courseSection.delete({ where: { id: s.id } });
  }
  const plans = await tx.subscriptionPlan.findMany({ where: { courseId: draft.id } });
  const keepPlans: string[] = [];
  for (const p of plans) {
    const id = p.originId ?? p.id;
    if (p.originId && !(await tx.subscriptionPlan.findFirst({ where: { id, courseId: live.id } }))) throw new ApiError(409, 'INVALID_TRANSITION', 'Draft plan origin is invalid.');
    await tx.subscriptionPlan.update({ where: { id }, data: { courseId: live.id, originId: null, currentPricePiastres: p.currentPricePiastres, previousPricePiastres: p.previousPricePiastres, durationDays: p.durationDays, accessMode: p.accessMode, accessEndsAt: p.accessEndsAt } });
    keepPlans.push(id);
  }
  await tx.subscriptionPlan.deleteMany({ where: { courseId: live.id, id: { notIn: keepPlans } } });
  // Copied rows have no student records. Keep only the historical holder hierarchy.
  await tx.courseSection.deleteMany({ where: { courseId: draft.id, id: { not: retained.id } } });
  await tx.subscriptionPlan.deleteMany({ where: { courseId: draft.id } });
  await tx.course.update({ where: { id: draft.id }, data: { historical: true, status: 'ARCHIVED', requestedSlug: null } });
  const updated = await tx.course.update({ where: { id: live.id }, data: { ...details(draft), slug: draft.requestedSlug ?? live.slug, workingCopyId: null, publishedAt: new Date() } });
  await audit(tx, { actorUserId: actor, action: 'COURSE_DRAFT_PUBLISHED', entityType: 'Course', entityId: live.id, metadata: { draftId: draft.id } });
  return updated;
}
