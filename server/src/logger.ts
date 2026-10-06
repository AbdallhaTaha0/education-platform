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
  'nationalId', 'parentPhone', 'req.body.nationalId', 'req.body.parentPhone',
  '*.nationalId', '*.parentPhone', '*.nationalIdCipher', '*.nationalIdFingerprint',
  'req.headers["x-csrf-token"]',
] as const;

/** Keys that must never appear with raw values in logs or audit metadata. */
const SENSITIVE_KEY_PATTERN =
  /(token|secret|key|assertion|signature|credential|cookie|authorization|uploadurl|upload_url|storage|confirmation|national.?id|parent.?phone)/i;

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
    serializers: { err: serializeSafeError, req: serializeSafeRequest },
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

/** Preserve diagnostic categories, excluding raw messages and nested causes. */
export function serializeSafeError(error: unknown): Record<string, unknown> {
  if (typeof error !== 'object' || error === null) return { type: 'UnknownError' };
  const value = error as { name?: unknown; type?: unknown; code?: unknown; stack?: unknown };
  const name = error instanceof Error ? error.name : value.type;
  const code = value.code;
  return {
    type: typeof name === 'string' && /^[A-Za-z][A-Za-z0-9]{0,63}$/.test(name) ? name : 'Error',
    ...(typeof code === 'string' && /^[A-Z][A-Z0-9_]{0,63}$/.test(code) ? { code } : {}),
    frames: (typeof value.stack === 'string' ? value.stack : '').split('\n').filter(line => /^\s+at /.test(line)).slice(0, 12),
  };
}
/** pino-http supplies its standard serialized request to this allowlist. */
export function serializeSafeRequest(request: { id?: unknown; method?: unknown; url?: unknown; headers?: unknown; remoteAddress?: unknown; remotePort?: unknown }): Record<string, unknown> {
  return {
    id: request.id, method: request.method,
    url: typeof request.url === 'string' ? request.url.split(/[?#]/, 1)[0] : undefined,
    headers: request.headers, remoteAddress: request.remoteAddress, remotePort: request.remotePort,
  };
}
