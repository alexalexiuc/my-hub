import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { withBackoffRetry } from './withBackoffRetry';

describe('withBackoffRetry', () => {
  beforeAll(() => {
    // Use fake timers to control the backoff delays
    vi.useFakeTimers();
  });
  afterAll(() => {
    vi.useRealTimers();
  });
  it('should retry the function on failure and eventually succeed, with defaults', async () => {
    const mockFn = vi
      .fn()
      .mockRejectedValueOnce(new Error('First failure'))
      .mockRejectedValueOnce(new Error('Second failure'))
      .mockResolvedValue('Success');

    const promise = withBackoffRetry(mockFn);
    const resultExpectation = expect(promise).resolves.toBe('Success');
    await vi.runAllTimersAsync();
    await resultExpectation;
    expect(mockFn).toHaveBeenCalledTimes(3);
  });

  it('should retry the function on failure and eventually fail after max retries', async () => {
    const mockFn = vi.fn().mockRejectedValue(new Error('Always fails'));

    const promise = withBackoffRetry(mockFn, {
      retries: 3,
      delay: 10,
      shouldRetry: (_, error) => !!error, // Retry on any error
    });
    const rejectionExpectation = expect(promise).rejects.toThrow('Failed after 3 attempts');
    await vi.runAllTimersAsync();
    await rejectionExpectation;
    expect(mockFn).toHaveBeenCalledTimes(3);
  });

  it('Should retry on result condition', async () => {
    const mockFn = vi
      .fn()
      .mockResolvedValueOnce('Bad result')
      .mockResolvedValueOnce('Still bad')
      .mockResolvedValue('Good result');

    const promise = withBackoffRetry(mockFn, {
      shouldRetry: result => result === 'Bad result' || result === 'Still bad', // Retry on specific bad results
    });
    const resultExpectation = expect(promise).resolves.toBe('Good result');
    await vi.runAllTimersAsync();
    await resultExpectation;
    expect(mockFn).toHaveBeenCalledTimes(3);
  });
});
