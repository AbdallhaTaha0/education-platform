/**
 * Server-only configuration.
 *
 * DATABASE_URL, REDIS_URL and any DRM credentials must never leave the
 * server: they are not exposed through responses, logs (only redacted hosts),
 * or frontend bundles. Browser-safe settings live in client/.env* (VITE_*).
 */

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
  return {
    nodeEnv: env['NODE_ENV'] ?? 'development',
    port: parsePort(env['PORT']),
    databaseUrl,
    redisUrl,
    logLevel: env['LOG_LEVEL'] ?? 'info',
    serviceName: 'education-platform-server',
    serviceVersion: env['SERVICE_VERSION'] ?? '0.1.0-m1',
    readyTimeoutMs: parsePositiveInt(env['READY_TIMEOUT_MS'], 2000, 'READY_TIMEOUT_MS'),
    drmBaseUrl: optionalEnv(env, 'DRM_BASE_URL'),
    drmClientId: optionalEnv(env, 'DRM_CLIENT_ID'),
    drmClientSecret: optionalEnv(env, 'DRM_CLIENT_SECRET'),
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
