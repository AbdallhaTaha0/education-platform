import { describe, expect, it } from 'vitest';
import {
  DURATION_DAYS_MAX,
  DURATION_DAYS_MIN,
  PRICE_MAX_PIASTRES,
  PRICE_MIN_PIASTRES,
  assertValidTransition,
  mapDrmStatusToLocal,
  nonBlankString,
  normalizeContentType,
  validateDurationDays,
  validatePricePair,
  validateSlug,
} from '../../src/modules/catalog/validation.js';
import { ApiError } from '../../src/modules/identity/errors.js';

describe('bilingual + slug + position validation', () => {
  it('rejects blank Arabic/English values', () => {
    expect(() => nonBlankString('   ', 'titleAr')).toThrow(ApiError);
    expect(() => nonBlankString('', 'titleEn')).toThrow(ApiError);
    expect(nonBlankString('  درس  ', 'titleAr')).toBe('درس');
  });

  it('validates slugs strictly', () => {
    expect(validateSlug('intro-to-js')).toBe('intro-to-js');
    expect(() => validateSlug('Bad Slug!')).toThrow(ApiError);
    expect(() => validateSlug('ab')).toThrow(ApiError);
  });

  it('normalizes MP4/WebM/QuickTime aliases', () => {
    expect(normalizeContentType('MP4')).toBe('video/mp4');
    expect(normalizeContentType('video/webm')).toBe('video/webm');
    expect(normalizeContentType('QuickTime')).toBe('video/quicktime');
    expect(() => normalizeContentType('video/avi')).toThrow(ApiError);
  });
});

describe('exact price + duration bounds', () => {
  it(`duration ${DURATION_DAYS_MIN}–${DURATION_DAYS_MAX}`, () => {
    expect(validateDurationDays(1)).toBe(1);
    expect(validateDurationDays(3650)).toBe(3650);
    expect(() => validateDurationDays(0)).toThrow(ApiError);
    expect(() => validateDurationDays(3651)).toThrow(ApiError);
    expect(() => validateDurationDays(1.5)).toThrow(ApiError);
  });

  it(`prices ${PRICE_MIN_PIASTRES}–${PRICE_MAX_PIASTRES} integer piastres`, () => {
    const ok = validatePricePair(60000, 90000);
    expect(ok).toEqual({ current: 60000, previous: 90000 });
    expect(validatePricePair(5000, null).previous).toBeNull();
    expect(() => validatePricePair(0, null)).toThrow(ApiError);
    expect(() => validatePricePair(2000000001, null)).toThrow(ApiError);
    expect(() => validatePricePair(10.5, null)).toThrow(ApiError);
  });

  it('requires previous strictly greater than current', () => {
    expect(() => validatePricePair(90000, 90000)).toThrow(ApiError);
    expect(() => validatePricePair(90000, 50000)).toThrow(ApiError);
  });
});

describe('lifecycle transition matrix', () => {
  it('allows only DRAFT→PROCESSING→READY→PUBLISHED', () => {
    expect(() => assertValidTransition('DRAFT', 'PROCESSING')).not.toThrow();
    expect(() => assertValidTransition('PROCESSING', 'READY')).not.toThrow();
    expect(() => assertValidTransition('READY', 'PUBLISHED')).not.toThrow();
    for (const [from, to] of [
      ['DRAFT', 'READY'],
      ['DRAFT', 'PUBLISHED'],
      ['READY', 'DRAFT'],
      ['PUBLISHED', 'DRAFT'],
    ] as const) {
      try {
        assertValidTransition(from, to);
        expect.unreachable(`${from}→${to} should fail`);
      } catch (err) {
        expect((err as ApiError).code).toBe('INVALID_TRANSITION');
        expect((err as ApiError).status).toBe(409);
      }
    }
  });

  it('routes archive through dedicated endpoints', () => {
    for (const [from, to] of [
      ['DRAFT', 'ARCHIVED'],
      ['ARCHIVED', 'DRAFT'],
    ] as const) {
      try {
        assertValidTransition(from, to);
        expect.unreachable();
      } catch (err) {
        expect((err as ApiError).code).toBe('INVALID_TRANSITION');
      }
    }
  });
});

describe('archive restoration + publication validation helpers', () => {
  it('maps DRM states to local lifecycle deterministically', () => {
    expect(mapDrmStatusToLocal('UPLOADED')).toBe('UPLOAD_PENDING');
    expect(mapDrmStatusToLocal('PROCESSING')).toBe('PROCESSING');
    expect(mapDrmStatusToLocal('TRANSCODING')).toBe('PROCESSING');
    expect(mapDrmStatusToLocal('PACKAGING')).toBe('PROCESSING');
    expect(mapDrmStatusToLocal('READY')).toBe('READY');
    expect(mapDrmStatusToLocal('FAILED')).toBe('FAILED');
    expect(mapDrmStatusToLocal('DELETING')).toBe('DELETION_PENDING');
    expect(mapDrmStatusToLocal('DELETE_FAILED')).toBe('DELETION_FAILED');
  });
});
