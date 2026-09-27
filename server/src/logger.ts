import pino, { type Logger } from 'pino';

let rootLogger: Logger | null = null;

export function createLogger(level = 'info'): Logger {
  if (rootLogger) return rootLogger;
  rootLogger = pino({
    level,
    base: { service: 'education-platform-server' },
    timestamp: pino.stdTimeFunctions.isoTime,
  });
  return rootLogger;
}

export function getLogger(): Logger {
  return rootLogger ?? createLogger(process.env['LOG_LEVEL'] ?? 'info');
}
