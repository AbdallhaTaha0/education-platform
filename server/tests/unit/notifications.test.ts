import { describe, expect, it } from 'vitest';
import {
  parseInboxQuery,
  parseReadAll,
  parseReadState,
  parseSequence,
} from '../../src/modules/notifications/validation.js';
import {
  presentNotification,
  type PresentationRow,
} from '../../src/modules/notifications/presentation.js';

describe('notification boundary validation', () => {
  it('keeps signed 64-bit sequences exact and rejects ambiguous representations', () => {
    expect(parseSequence('9223372036854775807')).toBe(9223372036854775807n);
    expect(parseSequence('0')).toBe(0n);
    for (const value of [
      '9223372036854775808',
      '-1',
      '01',
      '+1',
      '1e3',
      ' 1',
      '1.0',
      '',
      1,
      ['1'],
    ]) {
      expect(() => parseSequence(value)).toThrow();
    }
    expect(() => parseSequence('0', false)).toThrow();
  });
  it('bounds pages and rejects query multiplicity and recipient authority', () => {
    expect(parseInboxQuery({})).toEqual({ limit: 20, unreadOnly: false });
    expect(
      parseInboxQuery({ limit: '50', cursor: '9007199254740993', unreadOnly: 'true' }),
    ).toEqual({ limit: 50, before: 9007199254740993n, unreadOnly: true });
    for (const query of [
      { limit: '0' },
      { limit: '51' },
      { limit: ['1', '2'] },
      { cursor: ['1'] },
      { cursor: '0' },
      { unreadOnly: '1' },
      { unreadOnly: ['true'] },
      { recipientId: 'other' },
    ]) {
      expect(() => parseInboxQuery(query)).toThrow();
    }
  });
  it('accepts only the exact mutation fields and their documented types', () => {
    expect(parseReadState({ read: false })).toBe(false);
    expect(parseReadAll({ throughSequence: '0' })).toBe(0n);
    for (const body of [null, [], {}, { read: 'true' }, { read: true, recipientId: 'other' }]) {
      expect(() => parseReadState(body)).toThrow();
    }
    for (const body of [{ throughSequence: 1 }, { throughSequence: '1', read: true }]) {
      expect(() => parseReadAll(body)).toThrow();
    }
  });
});

describe('notification safe presentation', () => {
  const base: PresentationRow = {
    id: 'public-notice-id',
    recipientSequence: 9007199254740993n,
    createdAt: new Date(0),
    occurredAt: new Date(0),
    expiresAt: new Date(180 * 86400000),
    readAt: null,
    audience: { event: { type: 'RECHARGE_APPROVED', courseId: null, schemaVersion: 1 } },
  };
  it('projects bilingual copy and exact decimal sequence without internal fields', () => {
    const item = presentNotification(
      { ...base, internalSecret: 'secret' } as PresentationRow,
      new Map(),
    );
    expect(item.sequence).toBe('9007199254740993');
    expect(item.target).toEqual({ kind: 'WALLET' });
    expect(item.titleAr).toBeTruthy();
    expect(item.bodyEn).toBeTruthy();
    expect(JSON.stringify(item)).not.toContain('secret');
    expect(Object.keys(item).sort()).toEqual(
      [
        'id',
        'type',
        'schemaVersion',
        'sequence',
        'titleAr',
        'titleEn',
        'bodyAr',
        'bodyEn',
        'createdAt',
        'occurredAt',
        'expiresAt',
        'readAt',
        'target',
      ].sort(),
    );
  });
  it('only offers a course target when the caller resolved a currently public course', () => {
    for (const type of ['COURSE_PUBLISHED', 'SUBSCRIPTION_EXPIRED'] as const) {
      const row = {
        ...base,
        audience: { event: { type, courseId: 'course-id', schemaVersion: 1 } },
      };
      expect(presentNotification(row, new Map()).target).toBeNull();
      expect(presentNotification(row, new Map([['course-id', 'safe-course']])).target).toEqual({
        kind: 'COURSE_OFFER',
        slug: 'safe-course',
      });
    }
  });
});
