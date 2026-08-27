/**
 * Application and storage error types.
 * Keep messages diagnostic; UI maps them to friendly copy when needed.
 */

/** Thrown when SQLite / adapter operations fail unexpectedly. */
export class StorageError extends Error {
  readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'StorageError';
    this.cause = cause;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** Generic application error for non-storage domain failures. */
export class AppError extends Error {
  readonly cause?: unknown;
  readonly code?: string;

  constructor(message: string, options?: { cause?: unknown; code?: string }) {
    super(message);
    this.name = 'AppError';
    this.cause = options?.cause;
    this.code = options?.code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Returns a human-readable diagnostic string for logs / loading screens.
 */
export function formatErrorForDiagnostics(error: unknown): string {
  if (error instanceof StorageError || error instanceof AppError) {
    const base = `${error.name}: ${error.message}`;
    const isDev =
      (typeof __DEV__ !== 'undefined' && __DEV__) ||
      process.env.NODE_ENV !== 'production';
    if (error.cause !== undefined && isDev) {
      const causeText =
        error.cause instanceof Error
          ? `${error.cause.name}: ${error.cause.message}`
          : String(error.cause);
      return `${base} | cause: ${causeText}`;
    }
    return base;
  }

  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }

  return String(error);
}
