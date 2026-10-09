import { describe, expect, it } from 'vitest';
import { assertTransferDate } from '../../src/modules/wallet/recharge/service.js';

describe('recharge transfer calendar dates', () => {
  it.each([
    ['2026-10-08T23:34:00Z', '2026-10-09'],
    ['2026-10-08T21:01:00Z', '2026-10-09'],
    ['2026-01-08T22:01:00Z', '2026-01-09'],
    ['2026-10-09T12:00:00Z', '2026-10-09'],
  ])('accepts the current Cairo day at %s without changing stored date semantics', (now, day) => {
    expect(assertTransferDate(day, Date.parse(now)).toISOString()).toBe(`${day}T00:00:00.000Z`);
  });

  it.each([
    ['2026-10-08T20:59:00Z', '2026-10-09'],
    ['2026-01-08T21:59:00Z', '2026-01-09'],
    ['2026-10-08T23:34:00Z', '2026-10-10'],
  ])('rejects a future Cairo day at %s', (now, day) => {
    expect(() => assertTransferDate(day, Date.parse(now))).toThrow('Invalid transferDate.');
  });

  it.each(['2026-02-30', '2026-13-01', '2019-12-31', 'invalid', '', null])(
    'rejects invalid or out-of-range date %s', (day) => {
      expect(() => assertTransferDate(day, Date.parse('2026-10-08T23:34:00Z'))).toThrow('Invalid transferDate.');
    },
  );

  it('keeps timestamp future checks precise and accepts past calendar days', () => {
    const now = Date.parse('2026-10-08T23:34:00Z');
    expect(assertTransferDate('2026-10-08', now).toISOString()).toBe('2026-10-08T00:00:00.000Z');
    expect(assertTransferDate('2026-10-08T23:33:00Z', now).toISOString()).toBe('2026-10-08T23:33:00.000Z');
    expect(() => assertTransferDate('2026-10-08T23:35:00Z', now)).toThrow('Invalid transferDate.');
  });
});
