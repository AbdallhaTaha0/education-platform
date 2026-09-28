import argon2 from 'argon2';

/** Argon2id parameters. Production defaults follow OWASP/RFC 9106 guidance
 * for interactive logins; explicit environment overrides exist ONLY so
 * automated tests run fast (see .env.example). Reduced cost must never be
 * used outside test configuration. */
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

export async function hashPassword(password: string, params: Argon2Params): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: params.memoryKb,
    timeCost: params.timeCost,
    parallelism: params.parallelism,
  });
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}
