/**
 * Server-only configuration.
 *
 * DATABASE_URL, REDIS_URL and any DRM credentials must never leave the
 * server: they are not exposed through responses, logs (only redacted hosts),
 * or frontend bundles. Browser-safe settings live in client/.env* (VITE_*).
 */

import type { Argon2Params } from './modules/identity/password.js';
import { ARGON2_MAXIMUMS, ARGON2_MINIMUMS, PRODUCTION_ARGON2 } from './modules/identity/password.js';

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
  return {
    nodeEnv,
    port: parsePort(env['PORT']),
    databaseUrl,
    redisUrl,
    logLevel: env['LOG_LEVEL'] ?? 'info',
    serviceName: 'education-platform-server',
    serviceVersion: env['SERVICE_VERSION'] ?? '0.2.0-m2',
    readyTimeoutMs: parsePositiveInt(env['READY_TIMEOUT_MS'], 2000, 'READY_TIMEOUT_MS'),
    drmBaseUrl: optionalEnv(env, 'DRM_BASE_URL'),
    drmClientId: optionalEnv(env, 'DRM_CLIENT_ID'),
    drmClientSecret: optionalEnv(env, 'DRM_CLIENT_SECRET'),
    isProduction,
    jwtSecret,
    authIssuer: parseIdentifierValue(env['AUTH_ISSUER'], 'AUTH_ISSUER'),
    authAudience: parseIdentifierValue(env['AUTH_AUDIENCE'], 'AUTH_AUDIENCE'),
    allowedOrigins: parseOrigins(requiredEnv(env, 'ALLOWED_ORIGINS', 'exact approved origins for identity requests')),
    cookieSecure: cookieSecureRaw === 'true',
    argon2,
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
