/**
 * Server-only configuration.
 *
 * DATABASE_URL, REDIS_URL and any DRM credentials must never leave the
 * server: they are not exposed through responses, logs (only redacted hosts),
 * or frontend bundles. Browser-safe settings live in client/.env* (VITE_*).
 */

import type { Argon2Params } from './modules/identity/password.js';
import { ARGON2_MAXIMUMS, ARGON2_MINIMUMS, PRODUCTION_ARGON2 } from './modules/identity/password.js';

export const DRM_TIMEOUT_DEFAULT_MS = 5000;
export const DRM_TIMEOUT_MIN_MS = 250;
export const DRM_TIMEOUT_MAX_MS = 30000;
export const DRM_RETRIES_DEFAULT = 2;
export const DRM_RETRIES_MIN = 0;
export const DRM_RETRIES_MAX = 3;

/** M4 approved manual-funding channel identifier. */
export type PaymentChannelId = 'INSTAPAY' | 'BANK_TRANSFER' | 'MOBILE_WALLET';

export const PAYMENT_CHANNEL_IDS: PaymentChannelId[] = ['INSTAPAY', 'BANK_TRANSFER', 'MOBILE_WALLET'];

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
    const { channel, accountLabel, instructionsAr, instructionsEn } = entry as Record<string, unknown>;
    if (channel !== 'INSTAPAY' && channel !== 'BANK_TRANSFER' && channel !== 'MOBILE_WALLET') {
      throw new Error(`Invalid ${where}.channel (expected INSTAPAY, BANK_TRANSFER or MOBILE_WALLET).`);
    }
    if (seen.has(channel)) throw new Error(`Invalid ${where}.channel (duplicate channel ${channel}).`);
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
    memoryKb: parsePositiveInt(env['ARGON2_MEMORY_KB'], PRODUCTION_ARGON2.memoryKb, 'ARGON2_MEMORY_KB'),
    timeCost: parsePositiveInt(env['ARGON2_TIME_COST'], PRODUCTION_ARGON2.timeCost, 'ARGON2_TIME_COST'),
    parallelism: parsePositiveInt(env['ARGON2_PARALLELISM'], PRODUCTION_ARGON2.parallelism, 'ARGON2_PARALLELISM'),
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
  const drmConfiguredCount = [drmBaseUrl, drmClientId, drmClientSecret].filter((v) => v !== undefined).length;
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
    throw new Error('Invalid DRM configuration (production requires DRM_BASE_URL, DRM_CLIENT_ID and DRM_CLIENT_SECRET).');
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
    isProduction,
    jwtSecret,
    authIssuer: parseIdentifierValue(env['AUTH_ISSUER'], 'AUTH_ISSUER'),
    authAudience: parseIdentifierValue(env['AUTH_AUDIENCE'], 'AUTH_AUDIENCE'),
    allowedOrigins: parseOrigins(requiredEnv(env, 'ALLOWED_ORIGINS', 'exact approved origins for identity requests')),
    cookieSecure: cookieSecureRaw === 'true',
    argon2,
    paymentChannels: parsePaymentChannels(env),
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
