type LogLevel = 'error' | 'warn' | 'info' | 'debug';

const LEVEL_ORDER: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

const readLevel = (): LogLevel => {
  const raw = String(import.meta.env.VITE_LOG_LEVEL || '').toLowerCase();
  if (raw === 'error' || raw === 'warn' || raw === 'info' || raw === 'debug') {
    return raw;
  }
  return import.meta.env.DEV ? 'debug' : 'warn';
};

const ACTIVE_LEVEL = readLevel();

const shouldLog = (level: LogLevel): boolean =>
  LEVEL_ORDER[level] <= LEVEL_ORDER[ACTIVE_LEVEL];

const formatPrefix = (scope: string) => `[${scope}]`;

export const logger = {
  error(scope: string, message: string, meta?: unknown) {
    if (!shouldLog('error')) return;
    if (meta !== undefined) {
      console.error(formatPrefix(scope), message, meta);
      return;
    }
    console.error(formatPrefix(scope), message);
  },
  warn(scope: string, message: string, meta?: unknown) {
    if (!shouldLog('warn')) return;
    if (meta !== undefined) {
      console.warn(formatPrefix(scope), message, meta);
      return;
    }
    console.warn(formatPrefix(scope), message);
  },
  info(scope: string, message: string, meta?: unknown) {
    if (!shouldLog('info')) return;
    if (meta !== undefined) {
      console.info(formatPrefix(scope), message, meta);
      return;
    }
    console.info(formatPrefix(scope), message);
  },
  debug(scope: string, message: string, meta?: unknown) {
    if (!shouldLog('debug')) return;
    if (meta !== undefined) {
      console.debug(formatPrefix(scope), message, meta);
      return;
    }
    console.debug(formatPrefix(scope), message);
  },
};

