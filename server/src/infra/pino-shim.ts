import { sanitizeForLog } from '../logger.js';

export interface WorkerLogger {
  level: string;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  debug: (...args: unknown[]) => void;
  trace: (...args: unknown[]) => void;
  fatal: (...args: unknown[]) => void;
  child: (bindings?: Record<string, unknown>) => WorkerLogger;
}

function makeLogger(level = 'info', bindings: Record<string, unknown> = {}): WorkerLogger {
  const silent = level === 'silent';
  const emit = (lvl: 'info' | 'warn' | 'error' | 'debug', args: unknown[]) => {
    if (silent) return;
    const first = args[0];
    const second = args[1];
    const payload =
      typeof first === 'object' && first !== null
        ? { level: lvl, ...bindings, ...(sanitizeForLog(first) as Record<string, unknown>), msg: typeof second === 'string' ? second : undefined }
        : { level: lvl, ...bindings, msg: typeof first === 'string' ? first : undefined };
    if (lvl === 'error') console.error(JSON.stringify(payload));
    else if (lvl === 'warn') console.warn(JSON.stringify(payload));
    else console.log(JSON.stringify(payload));
  };
  return {
    level,
    info: (...args) => emit('info', args),
    warn: (...args) => emit('warn', args),
    error: (...args) => emit('error', args),
    debug: (...args) => emit('debug', args),
    trace: (...args) => emit('debug', args),
    fatal: (...args) => emit('error', args),
    child: (extra = {}) => makeLogger(level, { ...bindings, ...extra }),
  };
}

function pinoFactory(opts?: { level?: string; base?: Record<string, unknown> }) {
  return makeLogger(opts?.level ?? 'info', opts?.base ?? { service: 'education-platform-server' });
}

pinoFactory.stdTimeFunctions = {
  isoTime: () => `,"time":"${new Date().toISOString()}"`,
};

pinoFactory.symbols = {
  stringifySym: Symbol('pino.stringify'),
};

export const stdTimeFunctions = pinoFactory.stdTimeFunctions;
export const symbols = pinoFactory.symbols;
export default pinoFactory;
