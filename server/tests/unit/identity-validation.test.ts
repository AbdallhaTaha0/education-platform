import { describe, expect, it } from 'vitest';
import { ApiError } from '../../src/modules/identity/errors.js';
import {
  normalizeDisplayName,
  normalizeEmail,
  normalizePhone,
  rejectPrivilegeFields,
  validatePassword,
  PASSWORD_MIN_LENGTH,
} from '../../src/modules/identity/validation.js';

function codeOf(fn: () => unknown): string {
  try {
    fn();
  } catch (err) {
    expect(err).toBeInstanceOf(ApiError);
    return (err as ApiError).code;
  }
  throw new Error('expected ApiError');
}

describe('email normalization', () => {
  it('trims and lowercases before uniqueness checks', () => {
    expect(normalizeEmail('  Student@Example.COM  ')).toBe('student@example.com');
  });

  it('rejects invalid values', () => {
    for (const bad of ['', '   ', 'no-at-sign', 'a@', '@b.com', 'a@b', 'a b@c.com', 42, null]) {
      expect(codeOf(() => normalizeEmail(bad))).toBe('VALIDATION_ERROR');
    }
  });
});

describe('phone normalization (Egypt default region, E.164 canonical)', () => {
  it('accepts Egyptian local mobile input', () => {
    expect(normalizePhone('01512345678')).toBe('+201512345678');
    expect(normalizePhone('010 1234 5678')).toBe('+201012345678');
    expect(normalizePhone('011-1234-5678')).toBe('+201112345678');
  });

  it('accepts Arabic-Indic digits', () => {
    expect(normalizePhone('٠١٥١٢٣٤٥٦٧٨')).toBe('+201512345678');
  });

  it('keeps explicit valid international numbers (no Egypt-only rule)', () => {
    expect(normalizePhone('+14155552671')).toBe('+14155552671');
    expect(normalizePhone('+442071234567')).toBe('+442071234567');
  });

  it('rejects invalid values', () => {
    for (const bad of ['', '   ', 'abc', '123', '01512345', '+999', 42, null]) {
      expect(codeOf(() => normalizePhone(bad))).toBe('VALIDATION_ERROR');
    }
  });
});

describe('display name and password policy', () => {
  it('trims and bounds display names', () => {
    expect(normalizeDisplayName('  Layla  Hassan ')).toBe('Layla Hassan');
    expect(codeOf(() => normalizeDisplayName('x'))).toBe('VALIDATION_ERROR');
  });

  it('requires 12+ characters, allows 128+, no composition rules', () => {
    expect(PASSWORD_MIN_LENGTH).toBe(12);
    expect(codeOf(() => validatePassword('short1!'))).toBe('VALIDATION_ERROR');
    // Passphrase without symbols/digits is fine.
    expect(validatePassword('correct horse battery staple extra')).toBe('correct horse battery staple extra');
    expect(validatePassword('x'.repeat(128)).length).toBe(128);
    expect(codeOf(() => validatePassword('x'.repeat(257)))).toBe('VALIDATION_ERROR');
  });
});

describe('mass-assignment protection', () => {
  it('rejects privilege-related fields without trusting the rest', () => {
    for (const field of ['role', 'Role', 'isAdmin', 'is_admin', 'ADMIN', 'privileges']) {
      expect(codeOf(() => rejectPrivilegeFields({ [field]: 'ADMIN' }))).toBe('INVALID_FIELD');
    }
    expect(() => rejectPrivilegeFields({ displayName: 'Layla', nickname: 'x' })).not.toThrow();
  });
});
