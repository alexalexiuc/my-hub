import { describe, expect, it, vi } from 'vitest';

import { withBackoffRetry } from './withBackoffRetry';

describe('withBackoffRetry', () => {
  it('should retry the function on failure and eventually succeed, with defaults', async () => {
    const mockFn = vi
      .fn()
      .mockRejectedValueOnce(new Error('First failure'))
      .mockRejectedValueOnce(new Error('Second failure'))
      .mockResolvedValue('Success');

    const result = await withBackoffRetry(mockFn);

    expect(result).toBe('Success');
    expect(mockFn).toHaveBeenCalledTimes(3);
  });

  it('should retry the function on failure and eventually fail after max retries', async () => {
    const mockFn = vi.fn().mockRejectedValue(new Error('Always fails'));

    await expect(
      withBackoffRetry(mockFn, {
        retries: 3,
        delay: 100,
        shouldRetry: (_, error) => !!error, // Retry on any error
      }),
    ).rejects.toThrow('Failed after 3 attempts');

    expect(mockFn).toHaveBeenCalledTimes(3);
  });

  it('Should retry on result condition', async () => {
    const mockFn = vi
      .fn()
      .mockResolvedValueOnce('Bad result')
      .mockResolvedValueOnce('Still bad')
      .mockResolvedValue('Good result');

    const result = await withBackoffRetry(mockFn, {
      shouldRetry: (result) => result === 'Bad result' || result === 'Still bad', // Retry on specific bad results
    });

    expect(result).toBe('Good result');
    expect(mockFn).toHaveBeenCalledTimes(3);
  });
});
