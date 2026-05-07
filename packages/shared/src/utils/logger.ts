/**
 * Minimal structured logger with ISO timestamps.
 *
 * Exports:
 * - `logger` — object with info/warn/error methods, each prefixed with an ISO 8601 timestamp.
 *   Suitable for worker processes and server startup code where no framework logger is available.
 */

function ts(): string {
  return new Date().toISOString();
}

export const logger = {
  info: (...args: unknown[]): void => {
    console.info(`[${ts()}]`, ...args);
  },
  warn: (...args: unknown[]): void => {
    console.warn(`[${ts()}]`, ...args);
  },
  error: (...args: unknown[]): void => {
    console.error(`[${ts()}]`, ...args);
  },
};
