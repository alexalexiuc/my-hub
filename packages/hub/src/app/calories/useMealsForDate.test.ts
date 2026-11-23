import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch } from '@/lib/utils';
import { mealEvents } from './mealEvents';
import { useMealsForDate } from './useMealsForDate';

vi.mock('@/lib/utils', async () => {
  const actual = await vi.importActual<typeof import('@/lib/utils')>('@/lib/utils');
  return { ...actual, apiFetch: vi.fn() };
});

const fetchMock = vi.mocked(apiFetch);
const meal = (description: string) => ({ mealId: description, description });

/** A response the test releases by hand, to land requests out of order. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(r => (resolve = r));
  return { promise, resolve };
}

describe('useMealsForDate', () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the date's meals, null until they arrive", async () => {
    fetchMock.mockResolvedValueOnce({ meals: [meal('oats')] });
    const { result } = renderHook(() => useMealsForDate('2026-11-22'));
    expect(result.current.meals).toBeNull();
    await waitFor(() => expect(result.current.meals).toEqual([meal('oats')]));
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/calories/meals',
      expect.objectContaining({ query: { date: '2026-11-22', limit: 100 } }),
    );
  });

  it("never shows the previous day's meals as the new day's, even when its response lands late", async () => {
    const slowFirst = deferred<{ meals: unknown[] }>();
    fetchMock.mockReturnValueOnce(slowFirst.promise).mockResolvedValueOnce({ meals: [meal('soup')] });
    const { result, rerender } = renderHook(({ date }) => useMealsForDate(date), {
      initialProps: { date: '2026-11-21' },
    });

    rerender({ date: '2026-11-22' });
    await waitFor(() => expect(result.current.meals).toEqual([meal('soup')]));
    await act(async () => slowFirst.resolve({ meals: [meal('stale')] }));
    expect(result.current.meals).toEqual([meal('soup')]);
  });

  it('reloads quietly on any meal change, keeping the list if that fails', async () => {
    fetchMock.mockResolvedValueOnce({ meals: [meal('oats')] });
    const { result } = renderHook(() => useMealsForDate('2026-11-22'));
    await waitFor(() => expect(result.current.meals).not.toBeNull());

    fetchMock.mockResolvedValueOnce({ meals: [meal('oats'), meal('apple')] });
    await act(async () => mealEvents.emit('changed'));
    await waitFor(() => expect(result.current.meals).toHaveLength(2));
    expect(fetchMock.mock.calls[1]![1]).toMatchObject({ silentToast: true });

    fetchMock.mockRejectedValueOnce(new Error('offline'));
    await act(async () => mealEvents.emit('changed'));
    expect(result.current.meals).toHaveLength(2);
    expect(result.current.error).toBeNull();
  });

  it('keeps the latest of two reloads of the same day, whichever answers last', async () => {
    fetchMock.mockResolvedValueOnce({ meals: [meal('oats'), meal('apple'), meal('soup')] });
    const { result } = renderHook(() => useMealsForDate('2026-11-22'));
    await waitFor(() => expect(result.current.meals).toHaveLength(3));

    const afterFirstDelete = deferred<{ meals: unknown[] }>();
    fetchMock.mockReturnValueOnce(afterFirstDelete.promise).mockResolvedValueOnce({ meals: [meal('soup')] });
    await act(async () => mealEvents.emit('changed'));
    await act(async () => mealEvents.emit('changed'));
    await waitFor(() => expect(result.current.meals).toEqual([meal('soup')]));

    await act(async () => afterFirstDelete.resolve({ meals: [meal('apple'), meal('soup')] }));
    expect(result.current.meals).toEqual([meal('soup')]);
  });

  it('reports the failure when a reload overtakes the first load and fails', async () => {
    const first = deferred<{ meals: unknown[] }>();
    fetchMock.mockReturnValueOnce(first.promise).mockRejectedValueOnce(new Error('offline'));
    const { result } = renderHook(() => useMealsForDate('2026-11-22'));
    await act(async () => mealEvents.emit('changed'));
    await act(async () => first.resolve({ meals: [meal('oats')] }));

    await waitFor(() => expect(result.current.error).toBe('offline'));
    expect(result.current.meals).toBeNull();
  });

  it('reports a day that never loaded', async () => {
    fetchMock.mockRejectedValueOnce(new Error('Server down'));
    const { result } = renderHook(() => useMealsForDate('2026-11-22'));
    await waitFor(() => expect(result.current.error).toBe('Server down'));
    expect(result.current.meals).toBeNull();
  });
});
