/**
 * Async retry utility
 * - withBackoffRetry(fn, options?) — retry a promise-returning function with exponential backoff
 *     options: retries (default 5), delay in ms (default 500), shouldRetry(result, error) callback
 */

/** Options for configuring the backoff retry behavior */
type BackoffRetryOptions<T> = {
  /** The maximum number of retry attempts (default: 5) */
  retries?: number;
  /** The initial delay in milliseconds before the first retry (default: 1000ms) */
  delay?: number;
  /** A function that determines whether to retry based on the result or error (default: retry on any error) */
  shouldRetry?: (result: T | null, error: unknown) => boolean;
};

/**
 * Utility function to retry a promise-returning function with exponential backoff.
 * @param fn The function to execute, which returns a promise.
 * @param options Configuration options for the backoff retry.
 * @param options.retries The maximum number of retry attempts (default: 5).
 * @param options.delay The initial delay in milliseconds before the first retry (default: 1000ms).
 * @param options.shouldRetry A function that determines whether to retry based on the result or error (default: retry on any error).
 * @returns A promise that resolves with the result of the function or rejects after exhausting retries.
 */
export async function withBackoffRetry<T>(fn: () => Promise<T>, options: BackoffRetryOptions<T> = {}): Promise<T> {
  const { retries = 5, delay = 500, shouldRetry = (_, error) => !!error } = options;
  let attempt = 0;
  while (attempt < retries) {
    try {
      const result = await fn();
      if (!shouldRetry(result, null)) {
        return result;
      }
    } catch (error) {
      if (!shouldRetry(null, error)) {
        throw error;
      }
    }
    attempt++;
    await new Promise((res) => setTimeout(res, delay * Math.pow(2, attempt - 1)));
  }
  throw new Error(`Failed after ${retries} attempts`);
}
