import { describe, expect, it } from 'vitest';
import { ApiError } from '../../src/modules/identity/errors.js';
import { assertIdempotencyKey, assertNonEmptyString, assertPiastres, normalizeReference } from '../../src/modules/wallet/money.js';

function expectValidationError(fn: () => unknown): void {
  try {
    fn();
  } catch (err) {
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).code).toBe('VALIDATION_ERROR');
    return;
  }
  expect.unreachable('expected VALIDATION_ERROR');
}

describe('integer piastres', () => {
  it('accepts bounded integers', () => {
    expect(assertPiastres(100, 'amountPiastres')).toBe(100);
    expect(assertPiastres(100_000_000, 'amountPiastres')).toBe(100_000_000);
  });

  it('rejects floats, strings, and out-of-range values', () => {
    for (const bad of [99, 100_000_001, 10.5, '100', NaN, null, undefined, -1]) {
      expectValidationError(() => assertPiastres(bad, 'amountPiastres'));
    }
  });
});

describe('reference normalization', () => {
  it('uppercases and strips spaces/dashes', () => {
    expect(normalizeReference(' instapay-123 456 ')).toBe('INSTAPAY123456');
  });

  it('rejects short, long, or non-alphanumeric references', () => {
    for (const bad of ['ab', 'x'.repeat(65), 'ref!', '', null, 123]) {
      expectValidationError(() => normalizeReference(bad));
    }
  });
});

describe('idempotency keys', () => {
  it('accepts 8-64 url-safe chars', () => {
    expect(assertIdempotencyKey('abc123-_XYZ')).toBe('abc123-_XYZ');
  });

  it('rejects short, long, or unsafe keys', () => {
    for (const bad of ['short', 'x'.repeat(65), 'has space', 'semi;colon', '', null]) {
      expectValidationError(() => assertIdempotencyKey(bad));
    }
  });
});

describe('non-empty strings', () => {
  it('trims and enforces bounds', () => {
    expect(assertNonEmptyString('  Ahmed  ', 'senderName', 120)).toBe('Ahmed');
    expectValidationError(() => assertNonEmptyString('   ', 'senderName', 120));
    expectValidationError(() => assertNonEmptyString('x'.repeat(121), 'senderName', 120));
  });
});
