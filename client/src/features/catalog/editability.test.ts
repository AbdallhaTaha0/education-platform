import { describe, expect, it } from 'vitest';
import { lessonAdditionBlockCode, structuralBlockCode } from './editability';
import { localizeCode } from '../../i18n';
import { ar } from '../../locales/ar';
import { en } from '../../locales/en';

describe('course editing feedback', () => {
  it.each(['PROCESSING', 'READY', 'PUBLISHED'])('blocks structural controls in %s', status => {
    expect(structuralBlockCode({ status, deletionRequestedAt: null })).toBe('COURSE_NOT_DRAFT');
  });
  it('allows draft editing and gives deletion precedence over archive', () => {
    expect(structuralBlockCode({ status: 'DRAFT', deletionRequestedAt: null })).toBeNull();
    expect(structuralBlockCode({ status: 'ARCHIVED', deletionRequestedAt: null })).toBe('COURSE_ARCHIVED');
    expect(structuralBlockCode({ status: 'ARCHIVED', deletionRequestedAt: '2026-10-05' })).toBe('DELETION_PENDING');
  });
  it('permits additions to published courses without unlocking other structural edits', () => {
    expect(lessonAdditionBlockCode({ status: 'PUBLISHED', deletionRequestedAt: null })).toBeNull();
    expect(lessonAdditionBlockCode({ status: 'DRAFT', deletionRequestedAt: null })).toBeNull();
    expect(lessonAdditionBlockCode({ status: 'PUBLISHED', deletionRequestedAt: '2026-10-05' })).toBe('DELETION_PENDING');
    expect(lessonAdditionBlockCode({ status: 'ARCHIVED', deletionRequestedAt: null })).toBe('COURSE_ARCHIVED');
    for (const status of ['PROCESSING', 'READY']) expect(lessonAdditionBlockCode({ status, deletionRequestedAt: null })).toBe('COURSE_NOT_DRAFT');
  });
  it.each(['COURSE_NOT_DRAFT', 'COURSE_ARCHIVED', 'DELETION_PENDING', 'SLUG_TAKEN', 'REORDER_INVALID', 'MEDIA_EXISTS', 'INVALID_TRANSITION', 'MEDIA_MISSING'])('explains %s in both languages instead of unknown error', code => {
    for (const t of [ar, en]) expect(localizeCode(t, code)).not.toBe(t.err_UNKNOWN);
  });
});
