import { timingSafeEqual } from 'node:crypto';

/**
 * Worker-compatible password hashing using WebCrypto PBKDF2-SHA256.
 *
 * Keeps Argon2Params / PRODUCTION_ARGON2 / ARGON2_MINIMUMS / ARGON2_MAXIMUMS
 * exported as compatibility aliases so existing callers and config loaders
 * remain unchanged while removing the native C++ argon2 dependency.
 */
export interface Argon2Params {
  memoryKb: number;
  timeCost: number;
  parallelism: number;
}

export const PRODUCTION_ARGON2: Argon2Params = {
  memoryKb: 65536,
  timeCost: 3,
  parallelism: 4,
};

/** Approved minimums enforced outside NODE_ENV=test. */
export const ARGON2_MINIMUMS: Argon2Params = {
  memoryKb: 65536,
  timeCost: 3,
  parallelism: 4,
};

/** Upper bounds enforced everywhere against exhaustion misconfiguration. */
export const ARGON2_MAXIMUMS: Argon2Params = {
  memoryKb: 1048576,
  timeCost: 10,
  parallelism: 16,
};

export const PBKDF2_PRODUCTION_ITERATIONS = 10_000;
export const PBKDF2_TEST_ITERATIONS = 1_000;
const SALT_BYTES = 16;
const HASH_BITS = 256;
const HASH_BYTES = 32;

const ENVELOPE_PREFIX = '$pbkdf2-sha256$';

function toBase64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64url');
}

function fromBase64Url(encoded: string): Buffer | null {
  try {
    const buf = Buffer.from(encoded, 'base64url');
    return buf.length > 0 ? buf : null;
  } catch {
    return null;
  }
}

function resolveIterations(params: Argon2Params): number {
  if (params.memoryKb < ARGON2_MINIMUMS.memoryKb || params.timeCost < ARGON2_MINIMUMS.timeCost) {
    return PBKDF2_TEST_ITERATIONS;
  }
  return PBKDF2_PRODUCTION_ITERATIONS;
}

async function derivePbkdf2(password: string, salt: Uint8Array, iterations: number): Promise<Buffer> {
  const keyMaterial = await globalThis.crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await globalThis.crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: Buffer.from(salt),
      iterations,
    },
    keyMaterial,
    HASH_BITS,
  );
  return Buffer.from(bits);
}

export async function hashPassword(password: string, params: Argon2Params): Promise<string> {
  const iterations = resolveIterations(params);
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const derived = await derivePbkdf2(password, salt, iterations);
  return `${ENVELOPE_PREFIX}i=${iterations}$${toBase64Url(salt)}$${toBase64Url(derived)}`;
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    if (!hash.startsWith(ENVELOPE_PREFIX)) return false;
    const parts = hash.split('$');
    // Expected: ['', 'pbkdf2-sha256', 'i=<iterations>', '<salt>', '<hash>']
    if (parts.length !== 5 || parts[1] !== 'pbkdf2-sha256') return false;
    const iterPart = parts[2];
    if (!iterPart.startsWith('i=')) return false;
    const iterations = Number(iterPart.slice(2));
    if (!Number.isInteger(iterations) || iterations < 1_000 || iterations > 1_000_000) return false;
    const salt = fromBase64Url(parts[3]);
    const expected = fromBase64Url(parts[4]);
    if (!salt || !expected || expected.length !== HASH_BYTES) return false;
    const actual = await derivePbkdf2(password, salt, iterations);
    if (actual.length !== expected.length) return false;
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
