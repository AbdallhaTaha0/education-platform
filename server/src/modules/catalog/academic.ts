import type { AccessMode } from '@prisma/client';
import { ApiError } from '../identity/errors.js';
import { rejectUnknownFields, validateDurationDays } from './validation.js';

export function invalid(field: string): never {
  throw new ApiError(400, 'VALIDATION_ERROR', `Invalid ${field}.`, { field });
}

export interface AcademicPlacement {
  grade: string | null;
  academicYear: string | null;
  term: number | null;
  courseKind: string | null;
  teachingMonth: string | null;
}

export function academicPlacement(raw: unknown): AcademicPlacement {
  if (raw === null)
    return { grade: null, academicYear: null, term: null, courseKind: null, teachingMonth: null };
  rejectUnknownFields(
    raw,
    new Set(['grade', 'academicYear', 'term', 'courseKind', 'teachingMonth']),
  );
  const b = raw as Record<string, unknown>;
  if (!['FIRST_SECONDARY', 'SECOND_SECONDARY'].includes(String(b.grade))) invalid('grade');
  if (typeof b.academicYear !== 'string' || !/^\d{4}\/\d{4}$/.test(b.academicYear))
    invalid('academicYear');
  const [first, second] = b.academicYear.split('/').map(Number);
  if (first! < 2000 || second! !== first! + 1 || second! > 2200) invalid('academicYear');
  const term = b.term ?? null;
  if (term !== null && term !== 1 && term !== 2) invalid('term');
  if (term === null) invalid('term');
  if (!['MONTHLY_EXPLANATION', 'REVISION'].includes(String(b.courseKind))) invalid('courseKind');
  const month = b.teachingMonth ?? null;
  if (b.courseKind === 'MONTHLY_EXPLANATION') {
    if (typeof month !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month))
      invalid('teachingMonth');
  } else if (month !== null) invalid('teachingMonth');
  return {
    grade: b.grade as string,
    academicYear: b.academicYear,
    term: term as number | null,
    courseKind: b.courseKind as string,
    teachingMonth: month as string | null,
  };
}

/** Explicit Cairo wall time + valid offset; rejects normalized invalid dates and DST gaps. */
export function cairoDeadline(value: unknown): Date {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?\+0[23]:00$/.test(value)
  )
    invalid('accessEndsAt');
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) invalid('accessEndsAt');
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Cairo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const p = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  if (`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}` !== value.slice(0, 19))
    invalid('accessEndsAt');
  return date;
}

export function accessTerms(
  body: Record<string, unknown>,
  prior: { accessMode: AccessMode; durationDays: number | null; accessEndsAt: Date | null } | null,
  course: { term: number | null; academicYear: string | null },
) {
  const mode = body.accessMode === undefined ? (prior?.accessMode ?? 'DURATION') : body.accessMode;
  if (!['DURATION', 'TERM_END', 'YEAR_END', 'UNTIL_REMOVAL'].includes(String(mode)))
    invalid('accessMode');
  if (mode === 'UNTIL_REMOVAL') {
    if (body.durationDays != null || body.accessEndsAt != null) invalid('accessMode');
    return { accessMode: mode as AccessMode, durationDays: null, accessEndsAt: null };
  }
  const switched = prior !== null && mode !== prior.accessMode;
  if (mode === 'DURATION') {
    if (body.accessEndsAt != null) invalid('accessEndsAt');
    return {
      accessMode: mode as AccessMode,
      durationDays: validateDurationDays(
        body.durationDays === undefined && !switched ? prior?.durationDays : body.durationDays,
      ),
      accessEndsAt: null,
    };
  }
  if (body.durationDays != null) invalid('durationDays');
  if (course.academicYear === null || (mode === 'TERM_END' && course.term === null))
    invalid('academic');
  const deadline =
    body.accessEndsAt === undefined && !switched
      ? prior?.accessEndsAt
      : cairoDeadline(body.accessEndsAt);
  if (!deadline) invalid('accessEndsAt');
  return { accessMode: mode as AccessMode, durationDays: null, accessEndsAt: deadline };
}
