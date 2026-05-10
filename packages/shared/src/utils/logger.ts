/**
 * Minimal structured logger with ISO timestamps and colored level labels.
 *
 * Exports:
 * - `logger` — object with info/warn/error methods, each prefixed with an ISO 8601 timestamp
 *   and a pino-pretty-style colored level label. Colors are suppressed when stdout is not a TTY.
 *   Suitable for worker processes and server startup code where no framework logger is available.
 */

const isTTY = process?.stdout?.isTTY === true;

const c = {
  green: isTTY ? '\x1b[32m' : '',
  yellow: isTTY ? '\x1b[33m' : '',
  red: isTTY ? '\x1b[31m' : '',
  reset: isTTY ? '\x1b[0m' : '',
};

function ts(): string {
  return new Date().toISOString();
}

export const logger = {
  info: (...args: unknown[]): void => {
    console.info(`[${ts()}] ${c.green}INFO: ${c.reset}`, ...args);
  },
  warn: (...args: unknown[]): void => {
    console.warn(`[${ts()}] ${c.yellow}WARN: ${c.reset}`, ...args);
  },
  error: (...args: unknown[]): void => {
    console.error(`[${ts()}] ${c.red}ERROR: ${c.reset}`, ...args);
  },
};
