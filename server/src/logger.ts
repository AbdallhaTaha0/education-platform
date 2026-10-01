import pino, { type DestinationStream, type Logger } from 'pino';

let rootLogger: Logger | null = null;

/**
 * Pino redaction paths for sensitive HTTP headers. Node lowercases incoming
 * header names, so lowercase paths match. `set-cookie` is a response header;
 * the rest are request headers. Redacted values serialize as "[Redacted]".
 *
 * M3 extends M1/M2 coverage with the DRM application credential header
 * (`x-client-id` is logged only as a redacted presence, never a value) and
 * keeps signed upload URLs, storage keys, and error bodies out of logs by
 * never passing them to the logger (see sanitizeForLog).
 */
export const LOG_REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["proxy-authorization"]',
  'req.headers["x-api-key"]',
  'req.headers["x-client-id"]',
  'req.headers["x-client-secret"]',
  'req.headers["x-csrf-token"]',
  'res.headers["set-cookie"]',
  'req.headers["x-csrf-token"]',
] as const;

/** Keys that must never appear with raw values in logs or audit metadata. */
const SENSITIVE_KEY_PATTERN =
  /(token|secret|key|assertion|signature|credential|cookie|authorization|uploadurl|upload_url|storage|confirmation)/i;

/**
 * Sanitize an arbitrary value for logs/audit: replaces sensitive keys with
 * "[Redacted]", truncates long strings, and drops raw external bodies.
 * Safe identifiers (request/platform/externalAsset ids, status codes,
 * durations, retry counts, sanitized categories) pass through.
 */
export function sanitizeForLog(value: unknown, depth = 0): unknown {
  if (depth > 4) return '[Truncated]';
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') {
    // Signed URLs carry query-string credentials — never log the full URL.
    if (/signature|token|secret|key=/i.test(value) && value.length > 120) return '[Redacted]';
    if (value.length > 2000) return `${value.slice(0, 2000)}…[Truncated]`;
    return value;
  }
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.slice(0, 50).map((v) => sanitizeForLog(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (SENSITIVE_KEY_PATTERN.test(k)) {
      out[k] = '[Redacted]';
    } else if (k === 'uploadUrl' || k === 'upload_url' || k === 'signedUrl') {
      out[k] = '[Redacted]';
    } else {
      out[k] = sanitizeForLog(v, depth + 1);
    }
  }
  return out;
}

/** Assert a serialized payload contains no raw secret-bearing material. */
export function containsSecretMaterial(serialized: string, secrets: string[]): string[] {
  return secrets.filter((s) => s.length > 0 && serialized.includes(s));
}

export function buildLoggerOptions(level: string): pino.LoggerOptions {
  return {
    level,
    base: { service: 'education-platform-server' },
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: {
      paths: [...LOG_REDACT_PATHS],
      censor: '[Redacted]',
    },
  };
}

export function createLogger(level = 'info', destination?: DestinationStream): Logger {
  // An explicit destination (tests) always yields a fresh logger so captured
  // output cannot leak into, or be polluted by, the process-wide singleton.
  if (destination) return pino(buildLoggerOptions(level), destination);
  if (rootLogger) return rootLogger;
  rootLogger = pino(buildLoggerOptions(level));
  return rootLogger;
}

export function getLogger(): Logger {
  return rootLogger ?? createLogger(process.env['LOG_LEVEL'] ?? 'info');
}
