export type LogLevel = 'info' | 'warn' | 'error';

export interface AppError {
  message: string;
  code?: string;
  cause?: unknown;
  context?: Record<string, unknown>;
}

const isDev = import.meta.env.DEV;

export function logError(
  error: unknown,
  context?: Record<string, unknown>,
  level: LogLevel = 'error'
): AppError {
  const normalized = normalizeError(error, context);

  if (isDev) {
    const logger = level === 'error' ? console.error : level === 'warn' ? console.warn : console.info;
    logger('[app]', normalized.message, { code: normalized.code, context: normalized.context, cause: normalized.cause });
  }

  return normalized;
}

export function normalizeError(error: unknown, context?: Record<string, unknown>): AppError {
  if (error instanceof Error) {
    return {
      message: error.message,
      code: (error as Error & { code?: string }).code,
      cause: error,
      context,
    };
  }
  if (typeof error === 'string') {
    return { message: error, context };
  }
  if (error && typeof error === 'object' && 'message' in error) {
    const maybe = error as { message?: unknown; code?: unknown };
    return {
      message: typeof maybe.message === 'string' ? maybe.message : 'Unknown error',
      code: typeof maybe.code === 'string' ? maybe.code : undefined,
      cause: error,
      context,
    };
  }
  return { message: 'Unknown error', cause: error, context };
}

export function getUserMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  const normalized = normalizeError(error);
  if (!normalized.message || normalized.message === 'Unknown error') return fallback;
  return normalized.message;
}

type ToastListener = (toast: ToastMessage) => void;

export interface ToastMessage {
  id: string;
  level: LogLevel;
  message: string;
  durationMs: number;
}

const listeners = new Set<ToastListener>();

export function subscribeToasts(listener: ToastListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function toast(message: string, level: LogLevel = 'info', durationMs = 4000): void {
  const msg: ToastMessage = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    level,
    message,
    durationMs,
  };
  listeners.forEach((l) => l(msg));
}

export function reportAndToast(error: unknown, userFallback?: string, context?: Record<string, unknown>): AppError {
  const normalized = logError(error, context, 'error');
  toast(getUserMessage(error, userFallback), 'error');
  return normalized;
}
