import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { ApiError } from './errors.js';

/** Password policy: at least 12 chars, up to 256. No composition rules, so
 * password managers and passphrases work. Never log passwords. */
export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 256;
export const DISPLAY_NAME_MIN_LENGTH = 2;
export const DISPLAY_NAME_MAX_LENGTH = 100;
const EMAIL_MAX_LENGTH = 254;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Fields that must never be accepted from public input (mass assignment). */
const PRIVILEGE_FIELDS = new Set([
  'role',
  'isadmin',
  'is_admin',
  'admin',
  'privileges',
  'permissions',
]);

/** Reject bodies that attempt to set privilege-related fields. Comparison is
 * case-insensitive on common spellings; all other unknown fields are ignored. */
export function rejectPrivilegeFields(body: unknown): void {
  if (typeof body !== 'object' || body === null) return;
  const present = Object.keys(body as Record<string, unknown>)
    .map((k) => k.toLowerCase())
    .filter((k) => PRIVILEGE_FIELDS.has(k));
  if (present.length > 0) {
    throw new ApiError(400, 'INVALID_FIELD', 'Request contains forbidden fields.', {
      fields: present,
    });
  }
}

export function normalizeEmail(raw: unknown): string {
  if (typeof raw !== 'string') {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Email is required.', { field: 'email' });
  }
  const email = raw.trim().toLowerCase();
  if (email.length === 0 || email.length > EMAIL_MAX_LENGTH || !EMAIL_PATTERN.test(email)) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Email is invalid.', { field: 'email' });
  }
  return email;
}

const ARABIC_INDIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

function toAsciiDigits(value: string): string {
  return value.replace(/[٠-٩]/g, (d) => String(ARABIC_INDIC_DIGITS.indexOf(d)));
}

/**
 * Normalize a phone number to canonical E.164.
 * Egyptian local mobile input (e.g. 015…) is parsed with Egypt as the
 * default region; explicit valid international numbers stay valid as-is.
 * No Egypt-only restriction is invented.
 */
export function normalizePhone(raw: unknown): string {
  if (typeof raw !== 'string') {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Phone is required.', { field: 'phone' });
  }
  const cleaned = toAsciiDigits(raw).trim();
  if (cleaned.length === 0) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Phone is required.', { field: 'phone' });
  }
  let parsed = parsePhoneNumberFromString(cleaned, 'EG');
  if ((parsed === undefined || !parsed.isValid()) && cleaned.startsWith('+')) {
    parsed = parsePhoneNumberFromString(cleaned);
  }
  if (parsed === undefined || !parsed.isValid()) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Phone is invalid.', { field: 'phone' });
  }
  return parsed.number;
}

export function normalizeDisplayName(raw: unknown): string {
  if (typeof raw !== 'string') {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Display name is required.', {
      field: 'displayName',
    });
  }
  const name = raw.trim().replace(/\s+/g, ' ');
  if (name.length < DISPLAY_NAME_MIN_LENGTH || name.length > DISPLAY_NAME_MAX_LENGTH) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Display name is invalid.', {
      field: 'displayName',
    });
  }
  return name;
}

export function validatePassword(raw: unknown): string {
  if (
    typeof raw !== 'string' ||
    raw.length < PASSWORD_MIN_LENGTH ||
    raw.length > PASSWORD_MAX_LENGTH
  ) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Password is invalid.', { field: 'password' });
  }
  return raw;
}
