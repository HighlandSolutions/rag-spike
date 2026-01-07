/**
 * Basic logging utility with structured logging
 * Provides consistent logging format for production and development
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

/**
 * Format log entry as JSON for structured logging
 */
const formatLogEntry = (entry: LogEntry): string => {
  return JSON.stringify(entry);
};

/**
 * Log debug message (development only)
 */
export const logDebug = (message: string, context?: Record<string, unknown>): void => {
  if (process.env.NODE_ENV === 'development') {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'debug',
      message,
      context,
    };
    console.debug(formatLogEntry(entry));
  }
};

/**
 * Log info message
 */
export const logInfo = (message: string, context?: Record<string, unknown>): void => {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level: 'info',
    message,
    context,
  };
  console.log(formatLogEntry(entry));
};

/**
 * Log warning message
 */
export const logWarn = (message: string, context?: Record<string, unknown>): void => {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level: 'warn',
    message,
    context,
  };
  console.warn(formatLogEntry(entry));
};

/**
 * Log error message with optional error object
 */
export const logError = (
  message: string,
  error?: Error | unknown,
  context?: Record<string, unknown>
): void => {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level: 'error',
    message,
    context,
  };

  if (error instanceof Error) {
    entry.error = {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  } else if (error) {
    entry.context = { ...context, error: String(error) };
  }

  console.error(formatLogEntry(entry));
};

/**
 * Log API usage for cost monitoring
 */
export const logApiUsage = (
  service: string,
  operation: string,
  tokens?: number,
  cost?: number,
  metadata?: Record<string, unknown>
): void => {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level: 'info',
    message: 'API usage',
    context: {
      service,
      operation,
      tokens,
      cost,
      ...metadata,
    },
  };
  console.log(formatLogEntry(entry));
};

