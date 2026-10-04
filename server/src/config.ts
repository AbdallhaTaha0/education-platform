/**
 * Server-only configuration.
 *
 * DATABASE_URL, REDIS_URL and any DRM credentials must never leave the
 * server: they are not exposed through responses, logs (only redacted hosts),
 * or frontend bundles. Browser-safe settings live in client/.env* (VITE_*).
 */

import { createPrivateKey } from 'node:crypto';
import type { Argon2Params } from './modules/identity/password.js';
import {
  ARGON2_MAXIMUMS,
  ARGON2_MINIMUMS,
  PRODUCTION_ARGON2,
} from './modules/identity/password.js';

export const DRM_TIMEOUT_DEFAULT_MS = 5000;
export const DRM_TIMEOUT_MIN_MS = 250;
export const DRM_TIMEOUT_MAX_MS = 30000;
export const DRM_RETRIES_DEFAULT = 2;
export const DRM_RETRIES_MIN = 0;
/** M5 assertion lifetime bounds; the ceiling is the external maximum. */
export const DRM_ASSERTION_MAX_LIFETIME_DEFAULT_SEC = 120;
export const DRM_ASSERTION_MAX_LIFETIME_MIN_SEC = 30;
export const DRM_ASSERTION_MAX_LIFETIME_CEILING_SEC = 300;
export const DRM_RETRIES_MAX = 3;

/** Private storage defaults. */
export const STORAGE_TIMEOUT_DEFAULT_MS = 5000;
export const STORAGE_TIMEOUT_MIN_MS = 250;
export const STORAGE_TIMEOUT_MAX_MS = 30000;
export const STORAGE_RETRIES_DEFAULT = 2;
export const STORAGE_RETRIES_MIN = 0;
export const STORAGE_RETRIES_MAX = 3;

/** M4 approved manual-funding channel identifier. */
export type PaymentChannelId = 'INSTAPAY' | 'BANK_TRANSFER' | 'MOBILE_WALLET';

export const PAYMENT_CHANNEL_IDS: PaymentChannelId[] = [
  'INSTAPAY',
  'BANK_TRANSFER',
  'MOBILE_WALLET',
];

/**
 * M4 receiving-channel configuration. Values are deployment configuration
 * (receiving identifiers + localized student instructions), never code.
 * Absent/empty means payments are explicitly UNCONFIGURED: submission and
 * instruction endpoints fail with a safe category instead of guessing.
 */
export interface PaymentChannelConfig {
  channel: PaymentChannelId;
  accountLabel: string;
  instructionsAr: string;
  instructionsEn: string;
}

export interface ServerConfig {
  nodeEnv: string;
  port: number;
  databaseUrl: string;
  redisUrl: string;
  logLevel: string;
  serviceName: string;
  serviceVersion: string;
  /** Bounded per-dependency timeout (ms) for readiness checks. */
  readyTimeoutMs: number;
  /** Optional external DRM base URL. Absence must NOT fail readiness (M1). */
  drmBaseUrl?: string;
  drmClientId?: string;
  drmClientSecret?: string;
  /** Bounded DRM HTTP timeout (ms) and retry budget (M3). */
  drmRequestTimeoutMs: number;
  drmMaxRetries: number;
  /** Platform-owned private object storage (S3-compatible). Separate from DRM video storage. */
  storageEndpoint?: string;
  storageRegion?: string;
  storageAccessKeyId?: string;
  storageSecretAccessKey?: string;
  storageBucket?: string;
  /** Bounded storage HTTP timeout (ms) and retry budget. */
  storageRequestTimeoutMs: number;
  storageMaxRetries: number;
  /** Identity/auth settings below. Production fails closed on any weakness. */
  isProduction: boolean;
  /** Strong server-only access-token signing secret (min 32 chars). */
  jwtSecret: string;
  authIssuer: string;
  authAudience: string;
  /** Exact approved origins for state-changing identity requests. */
  allowedOrigins: string[];
  /** Secure cookie flag. Production requires explicit true. */
  cookieSecure: boolean;
  argon2: Argon2Params;
  /** M4 manual-funding channels. Empty array = explicitly unconfigured. */
  paymentChannels: PaymentChannelConfig[];
  /** M5 playback-assertion issuer; must equal the configured DRM expectation. */
  drmAssertionIssuer?: string;
  /** M5 playback-assertion audience. */
  drmAssertionAudience?: string;
  /** M5 playback-assertion algorithm. Real DRM uses RS256 + JWKS. */
  drmAssertionAlgorithm?: 'HS256' | 'RS256';
  /** Server-only signing key: RSA PKCS#8 PEM, or an explicit test-fixture HMAC secret. */
  drmAssertionSigningKey?: string;
  /** Public JWKS key identifier for RS256 assertions. */
  drmAssertionKeyId?: string;
  /** M5 assertion lifetime in seconds; never exceeds the DRM maximum. */
  drmAssertionMaxLifetimeSec: number;
  /**
   * Browser-facing DRM origin. The DRM returns relative manifest/license
   * paths, so the platform resolves and validates them against this origin
   * before returning them to the player. Absent means the server-side base URL
   * is used and the platform refuses to hand out cross-origin media URLs.
   */
  drmPublicBaseUrl?: string;
}

function parsePort(raw: string | undefined): number {
  const port = Number(raw ?? '3000');
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid PORT (expected 1-65535): ${JSON.stringify(raw)}`);
  }
  return port;
}

function parsePositiveInt(raw: string | undefined, fallback: number, name: string): number {
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`Invalid ${name} (expected positive integer ms): ${JSON.stringify(raw)}`);
  }
  return value;
}

function parseBoundedInt(
  raw: string | undefined,
  fallback: number,
  min: number,
  max: number,
  name: string,
): number {
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`Invalid ${name} (expected integer ${min}–${max}): ${JSON.stringify(raw)}`);
  }
  return value;
}

function optionalEnv(env: NodeJS.ProcessEnv, name: string): string | undefined {
  const value = env[name];
  if (value === undefined || value.trim() === '') return undefined;
  return value;
}

function requiredEnv(env: NodeJS.ProcessEnv, name: string, what: string): string {
  const value = optionalEnv(env, name);
  if (!value) {
    throw new Error(`Missing required ${name} (${what}). See .env.example.`);
  }
  return value;
}

function parseOrigins(raw: string): string[] {
  const origins = raw
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter((o) => o.length > 0);
  if (origins.length === 0) {
    throw new Error('Invalid ALLOWED_ORIGINS (at least one origin is required).');
  }
  for (const origin of origins) {
    if (origin.includes('*')) {
      throw new Error(`Invalid ALLOWED_ORIGINS (wildcards are forbidden): ${origin}`);
    }
    let url: URL;
    try {
      url = new URL(origin);
    } catch {
      throw new Error(`Invalid ALLOWED_ORIGINS (not a URL): ${origin}`);
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error(`Invalid ALLOWED_ORIGINS (http/https only): ${origin}`);
    }
  }
  return origins;
}

function parsePaymentChannels(env: NodeJS.ProcessEnv): PaymentChannelConfig[] {
  const raw = optionalEnv(env, 'PAYMENT_CHANNELS');
  // Absent configuration is an explicit unconfigured state, not a startup
  // error: M4 endpoints report PAYMENT_UNCONFIGURED instead of guessing
  // receiving identifiers. Malformed configuration fails startup closed.
  if (raw === undefined) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Invalid PAYMENT_CHANNELS (must be a JSON array).');
  }
  if (!Array.isArray(parsed) || parsed.length === 0 || parsed.length > 3) {
    throw new Error('Invalid PAYMENT_CHANNELS (expected a JSON array of 1-3 channels).');
  }
  const seen = new Set<string>();
  return parsed.map((entry: unknown, index: number) => {
    const where = `PAYMENT_CHANNELS[${index}]`;
    if (typeof entry !== 'object' || entry === null) {
      throw new Error(`Invalid ${where} (expected an object).`);
    }
    const { channel, accountLabel, instructionsAr, instructionsEn } = entry as Record<
      string,
      unknown
    >;
    if (channel !== 'INSTAPAY' && channel !== 'BANK_TRANSFER' && channel !== 'MOBILE_WALLET') {
      throw new Error(
        `Invalid ${where}.channel (expected INSTAPAY, BANK_TRANSFER or MOBILE_WALLET).`,
      );
    }
    if (seen.has(channel))
      throw new Error(`Invalid ${where}.channel (duplicate channel ${channel}).`);
    seen.add(channel);
    for (const [field, value, max] of [
      ['accountLabel', accountLabel, 120],
      ['instructionsAr', instructionsAr, 2000],
      ['instructionsEn', instructionsEn, 2000],
    ] as const) {
      if (typeof value !== 'string' || value.trim().length === 0 || value.length > max) {
        throw new Error(`Invalid ${where}.${field} (expected 1-${max} chars).`);
      }
    }
    return {
      channel,
      accountLabel: (accountLabel as string).trim(),
      instructionsAr: (instructionsAr as string).trim(),
      instructionsEn: (instructionsEn as string).trim(),
    };
  });
}

function parseIdentifierValue(raw: string | undefined, name: string): string {
  const value = (raw ?? '').trim();
  if (value.length === 0 || value.includes('*')) {
    throw new Error(`Invalid ${name} (non-empty value without wildcards is required).`);
  }
  return value;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const databaseUrl = optionalEnv(env, 'DATABASE_URL');
  if (!databaseUrl) {
    throw new Error(
      'Missing required DATABASE_URL (platform PostgreSQL). See .env.example for the local Docker value.',
    );
  }
  const redisUrl = optionalEnv(env, 'REDIS_URL');
  if (!redisUrl) {
    throw new Error(
      'Missing required REDIS_URL (platform Redis). See .env.example for the local Docker value.',
    );
  }
  const nodeEnv = env['NODE_ENV'] ?? 'development';
  const isProduction = nodeEnv === 'production';

  const jwtSecret = requiredEnv(env, 'AUTH_JWT_SECRET', 'server-only access-token signing secret');
  if (jwtSecret.length < 32) {
    throw new Error('Invalid AUTH_JWT_SECRET (at least 32 characters are required).');
  }
  const cookieSecureRaw = (env['COOKIE_SECURE'] ?? '').trim().toLowerCase();
  if (isProduction && cookieSecureRaw !== 'true') {
    throw new Error('Invalid COOKIE_SECURE (production requires explicit COOKIE_SECURE=true).');
  }
  if (cookieSecureRaw !== '' && cookieSecureRaw !== 'true' && cookieSecureRaw !== 'false') {
    throw new Error("Invalid COOKIE_SECURE (expected 'true' or 'false').");
  }
  const argon2: Argon2Params = {
    memoryKb: parsePositiveInt(
      env['ARGON2_MEMORY_KB'],
      PRODUCTION_ARGON2.memoryKb,
      'ARGON2_MEMORY_KB',
    ),
    timeCost: parsePositiveInt(
      env['ARGON2_TIME_COST'],
      PRODUCTION_ARGON2.timeCost,
      'ARGON2_TIME_COST',
    ),
    parallelism: parsePositiveInt(
      env['ARGON2_PARALLELISM'],
      PRODUCTION_ARGON2.parallelism,
      'ARGON2_PARALLELISM',
    ),
  };
  // Reduced hashing cost is allowed ONLY under explicit NODE_ENV=test
  // (isolated automated suites). Development and production enforce the
  // approved minimums; every environment enforces upper bounds against
  // resource-exhaustion misconfiguration.
  const isTest = nodeEnv === 'test';
  if (!isTest) {
    if (
      argon2.memoryKb < ARGON2_MINIMUMS.memoryKb ||
      argon2.timeCost < ARGON2_MINIMUMS.timeCost ||
      argon2.parallelism < ARGON2_MINIMUMS.parallelism
    ) {
      throw new Error(
        `Invalid Argon2 cost (minimum ${ARGON2_MINIMUMS.memoryKb}/${ARGON2_MINIMUMS.timeCost}/${ARGON2_MINIMUMS.parallelism} memory-KiB/time/parallelism outside NODE_ENV=test).`,
      );
    }
  }
  if (
    argon2.memoryKb > ARGON2_MAXIMUMS.memoryKb ||
    argon2.timeCost > ARGON2_MAXIMUMS.timeCost ||
    argon2.parallelism > ARGON2_MAXIMUMS.parallelism
  ) {
    throw new Error(
      `Invalid Argon2 cost (maximum ${ARGON2_MAXIMUMS.memoryKb}/${ARGON2_MAXIMUMS.timeCost}/${ARGON2_MAXIMUMS.parallelism} memory-KiB/time/parallelism).`,
    );
  }
  const drmBaseUrl = optionalEnv(env, 'DRM_BASE_URL');
  const drmClientId = optionalEnv(env, 'DRM_CLIENT_ID');
  const drmClientSecret = optionalEnv(env, 'DRM_CLIENT_SECRET');
  const drmConfiguredCount = [drmBaseUrl, drmClientId, drmClientSecret].filter(
    (v) => v !== undefined,
  ).length;
  // All-or-none: partial DRM configuration fails startup in every env.
  if (drmConfiguredCount > 0 && drmConfiguredCount < 3) {
    throw new Error(
      'Invalid DRM configuration (DRM_BASE_URL, DRM_CLIENT_ID and DRM_CLIENT_SECRET are all-or-none).',
    );
  }
  const drmRequestTimeoutMs = parseBoundedInt(
    env['DRM_REQUEST_TIMEOUT_MS'],
    DRM_TIMEOUT_DEFAULT_MS,
    DRM_TIMEOUT_MIN_MS,
    DRM_TIMEOUT_MAX_MS,
    'DRM_REQUEST_TIMEOUT_MS',
  );
  const drmMaxRetries = parseBoundedInt(
    env['DRM_MAX_RETRIES'],
    DRM_RETRIES_DEFAULT,
    DRM_RETRIES_MIN,
    DRM_RETRIES_MAX,
    'DRM_MAX_RETRIES',
  );

  const storageEndpoint = optionalEnv(env, 'STORAGE_ENDPOINT');
  const storageRegion = optionalEnv(env, 'STORAGE_REGION');
  const storageAccessKeyId = optionalEnv(env, 'STORAGE_ACCESS_KEY_ID');
  const storageSecretAccessKey = optionalEnv(env, 'STORAGE_SECRET_ACCESS_KEY');
  const storageBucket = optionalEnv(env, 'STORAGE_BUCKET');
  const storageConfiguredCount = [storageEndpoint, storageRegion, storageAccessKeyId, storageSecretAccessKey, storageBucket].filter(
    (v) => v !== undefined,
  ).length;
  // All-or-none: partial storage configuration fails startup in every env.
  if (storageConfiguredCount > 0 && storageConfiguredCount < 5) {
    throw new Error(
      'Invalid storage configuration (STORAGE_ENDPOINT, STORAGE_REGION, STORAGE_ACCESS_KEY_ID, STORAGE_SECRET_ACCESS_KEY and STORAGE_BUCKET are all-or-none).',
    );
  }
  const storageRequestTimeoutMs = parseBoundedInt(
    env['STORAGE_REQUEST_TIMEOUT_MS'],
    STORAGE_TIMEOUT_DEFAULT_MS,
    STORAGE_TIMEOUT_MIN_MS,
    STORAGE_TIMEOUT_MAX_MS,
    'STORAGE_REQUEST_TIMEOUT_MS',
  );
  const storageMaxRetries = parseBoundedInt(
    env['STORAGE_MAX_RETRIES'],
    STORAGE_RETRIES_DEFAULT,
    STORAGE_RETRIES_MIN,
    STORAGE_RETRIES_MAX,
    'STORAGE_MAX_RETRIES',
  );
  if (storageConfiguredCount === 5) {
    let storageUrl: URL;
    try {
      storageUrl = new URL(storageEndpoint as string);
    } catch {
      throw new Error('Invalid STORAGE_ENDPOINT (must be a parseable HTTP/HTTPS URL).');
    }
    if (storageUrl.protocol !== 'http:' && storageUrl.protocol !== 'https:') {
      throw new Error('Invalid STORAGE_ENDPOINT (must be an HTTP/HTTPS URL).');
    }
    if (storageUrl.username || storageUrl.password || storageUrl.search || storageUrl.hash) throw new Error('Invalid STORAGE_ENDPOINT (credentials/query/fragment are not permitted).');
    if (!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(storageBucket as string)) throw new Error('Invalid STORAGE_BUCKET.');
    if (isProduction && storageUrl.protocol !== 'https:') {
      throw new Error('Invalid STORAGE_ENDPOINT (production requires an HTTPS base URL).');
    }
  }
  // Storage is optional in all environments (local dev, test, production).
  // Production deployments must configure it explicitly, but the application
  // does not fail startup without it to maintain compatibility with existing
  // test fixtures and local development workflows.
  // TODO: Make required in production after owner approval for storage deployment.

  if (drmConfiguredCount === 3) {
    let drmUrl: URL;
    try {
      drmUrl = new URL(drmBaseUrl as string);
    } catch {
      throw new Error('Invalid DRM_BASE_URL (must be a parseable HTTP/HTTPS URL).');
    }
    if (drmUrl.protocol !== 'http:' && drmUrl.protocol !== 'https:') {
      throw new Error('Invalid DRM_BASE_URL (must be an HTTP/HTTPS URL).');
    }
    if (isProduction && drmUrl.protocol !== 'https:') {
      throw new Error('Invalid DRM_BASE_URL (production requires an HTTPS base URL).');
    }
  }
  if (isProduction && drmConfiguredCount === 0) {
    throw new Error(
      'Invalid DRM configuration (production requires DRM_BASE_URL, DRM_CLIENT_ID and DRM_CLIENT_SECRET).',
    );
  }

  // ---- M5 playback-assertion and dependency-origin configuration ----
  // The assertion identity must be present whenever DRM playback is possible,
  // because the platform is the issuer of the signed assertion.
  const drmAssertionIssuer = optionalEnv(env, 'DRM_ASSERTION_ISSUER');
  const drmAssertionAudience = optionalEnv(env, 'DRM_ASSERTION_AUDIENCE');
  const drmAssertionSecret = optionalEnv(env, 'DRM_ASSERTION_SECRET');
  const drmAssertionPrivateKeyB64 = optionalEnv(env, 'DRM_ASSERTION_PRIVATE_KEY_B64');
  const drmAssertionKeyId = optionalEnv(env, 'DRM_ASSERTION_KEY_ID');
  const fixtureHs256 = env['DRM_ASSERTION_MODE'] === 'fixture-hs256';
  let drmAssertionAlgorithm: 'HS256' | 'RS256' | undefined;
  let drmAssertionSigningKey: string | undefined;
  if (
    drmConfiguredCount === 3 &&
    (drmAssertionIssuer === undefined || drmAssertionAudience === undefined)
  ) {
    throw new Error(
      'Invalid playback assertion configuration (DRM_ASSERTION_ISSUER and DRM_ASSERTION_AUDIENCE are required when DRM is configured).',
    );
  }
  if (drmAssertionIssuer !== undefined)
    parseIdentifierValue(drmAssertionIssuer, 'DRM_ASSERTION_ISSUER');
  if (drmAssertionAudience !== undefined)
    parseIdentifierValue(drmAssertionAudience, 'DRM_ASSERTION_AUDIENCE');
  if (drmAssertionPrivateKeyB64 !== undefined || drmAssertionKeyId !== undefined) {
    if (
      drmAssertionPrivateKeyB64 === undefined ||
      drmAssertionKeyId === undefined ||
      drmAssertionSecret !== undefined
    ) {
      throw new Error(
        'Invalid DRM assertion key configuration (RSA key and key id must be complete and exclusive).',
      );
    }
    if (!/^[A-Za-z0-9._-]{1,64}$/.test(drmAssertionKeyId)) {
      throw new Error('Invalid DRM_ASSERTION_KEY_ID.');
    }
    try {
      const pem = Buffer.from(drmAssertionPrivateKeyB64, 'base64').toString('utf8');
      const key = createPrivateKey(pem);
      if (
        key.asymmetricKeyType !== 'rsa' ||
        (key.asymmetricKeyDetails?.modulusLength ?? 0) < 2048
      ) {
        throw new Error('RSA key must be at least 2048 bits');
      }
      drmAssertionAlgorithm = 'RS256';
      drmAssertionSigningKey = pem;
    } catch {
      throw new Error(
        'Invalid DRM_ASSERTION_PRIVATE_KEY_B64 (expected a base64 PKCS#8 RSA private key of at least 2048 bits).',
      );
    }
  } else if (drmAssertionSecret !== undefined) {
    if (drmAssertionSecret.length < 32) {
      throw new Error('Invalid DRM_ASSERTION_SECRET (at least 32 characters are required).');
    }
    if (isProduction || (nodeEnv !== 'test' && !fixtureHs256)) {
      throw new Error(
        'DRM_ASSERTION_SECRET is test-fixture-only; real DRM requires RS256 configuration.',
      );
    }
    drmAssertionAlgorithm = 'HS256';
    drmAssertionSigningKey = drmAssertionSecret;
  } else if (drmConfiguredCount === 3) {
    throw new Error(
      'Invalid playback assertion configuration (RS256 signing key is required for real DRM).',
    );
  }
  // The external service enforces a 300 s maximum assertion lifetime (see
  // drm-integration.md). The platform never mints anything longer.
  const drmAssertionMaxLifetimeSec = parseBoundedInt(
    env['DRM_ASSERTION_MAX_LIFETIME_SEC'],
    DRM_ASSERTION_MAX_LIFETIME_DEFAULT_SEC,
    DRM_ASSERTION_MAX_LIFETIME_MIN_SEC,
    DRM_ASSERTION_MAX_LIFETIME_CEILING_SEC,
    'DRM_ASSERTION_MAX_LIFETIME_SEC',
  );
  const drmPublicBaseUrlRaw = optionalEnv(env, 'DRM_PUBLIC_BASE_URL');
  let drmPublicBaseUrl: string | undefined;
  if (drmPublicBaseUrlRaw !== undefined) {
    let publicUrl: URL;
    try {
      publicUrl = new URL(drmPublicBaseUrlRaw);
    } catch {
      throw new Error('Invalid DRM_PUBLIC_BASE_URL (must be a parseable HTTP/HTTPS URL).');
    }
    if (publicUrl.protocol !== 'http:' && publicUrl.protocol !== 'https:') {
      throw new Error('Invalid DRM_PUBLIC_BASE_URL (must be an HTTP/HTTPS URL).');
    }
    if (isProduction && publicUrl.protocol !== 'https:') {
      throw new Error('Invalid DRM_PUBLIC_BASE_URL (production requires HTTPS).');
    }
    if (publicUrl.username !== '' || publicUrl.password !== '') {
      throw new Error('Invalid DRM_PUBLIC_BASE_URL (embedded credentials are forbidden).');
    }
    drmPublicBaseUrl = drmPublicBaseUrlRaw.replace(/\/+$/, '');
  }
  return {
    nodeEnv,
    port: parsePort(env['PORT']),
    databaseUrl,
    redisUrl,
    logLevel: env['LOG_LEVEL'] ?? 'info',
    serviceName: 'education-platform-server',
    serviceVersion: env['SERVICE_VERSION'] ?? '0.4.0-m4',
    readyTimeoutMs: parsePositiveInt(env['READY_TIMEOUT_MS'], 2000, 'READY_TIMEOUT_MS'),
    drmBaseUrl,
    drmClientId,
    drmClientSecret,
    drmRequestTimeoutMs,
    drmMaxRetries,
    storageEndpoint,
    storageRegion,
    storageAccessKeyId,
    storageSecretAccessKey,
    storageBucket,
    storageRequestTimeoutMs,
    storageMaxRetries,
    isProduction,
    jwtSecret,
    authIssuer: parseIdentifierValue(env['AUTH_ISSUER'], 'AUTH_ISSUER'),
    authAudience: parseIdentifierValue(env['AUTH_AUDIENCE'], 'AUTH_AUDIENCE'),
    allowedOrigins: parseOrigins(
      requiredEnv(env, 'ALLOWED_ORIGINS', 'exact approved origins for identity requests'),
    ),
    cookieSecure: cookieSecureRaw === 'true',
    argon2,
    paymentChannels: parsePaymentChannels(env),
    ...(drmAssertionIssuer !== undefined ? { drmAssertionIssuer } : {}),
    ...(drmAssertionAudience !== undefined ? { drmAssertionAudience } : {}),
    ...(drmAssertionAlgorithm !== undefined ? { drmAssertionAlgorithm } : {}),
    ...(drmAssertionSigningKey !== undefined ? { drmAssertionSigningKey } : {}),
    ...(drmAssertionKeyId !== undefined ? { drmAssertionKeyId } : {}),
    drmAssertionMaxLifetimeSec,
    ...(drmPublicBaseUrl !== undefined ? { drmPublicBaseUrl } : {}),
  };
}

/**
 * Host-only redaction for logs/status payloads. Connection strings and
 * secrets must never appear in responses or log lines.
 */
export function redactUrlForLog(url: string): string {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname || 'unknown-host';
    return `${parsed.protocol}//${host}${parsed.port ? `:${parsed.port}` : ''}`;
  } catch {
    return 'unparseable-url';
  }
}
