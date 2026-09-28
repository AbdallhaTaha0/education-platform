import pino, { type DestinationStream, type Logger } from 'pino';

let rootLogger: Logger | null = null;

/**
 * Pino redaction paths for sensitive HTTP headers. Node lowercases incoming
 * header names, so lowercase paths match. `set-cookie` is a response header;
 * the rest are request headers. Redacted values serialize as "[Redacted]".
 */
export const LOG_REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["proxy-authorization"]',
  'req.headers["x-api-key"]',
  'req.headers["x-client-secret"]',
  'res.headers["set-cookie"]',
] as const;

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
