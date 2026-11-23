import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useRefetchOnVisible } from './useRefetchOnVisible';

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
  document.dispatchEvent(new Event('visibilitychange'));
}

describe('useRefetchOnVisible', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('refetches on the first return, even seconds after the page loaded', () => {
    const refetch = vi.fn().mockResolvedValue(undefined);
    renderHook(() => useRefetchOnVisible(refetch));

    vi.advanceTimersByTime(5_000);
    setVisibility('hidden');
    setVisibility('visible');
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('refetches when the window regains focus with the tab never hidden', () => {
    const refetch = vi.fn().mockResolvedValue(undefined);
    renderHook(() => useRefetchOnVisible(refetch));

    window.dispatchEvent(new Event('focus'));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('throttles quick back-and-forth and skips while a refresh is still running', async () => {
    let finish: () => void = () => {};
    const refetch = vi.fn(() => new Promise<void>(resolve => (finish = resolve)));
    renderHook(() => useRefetchOnVisible(refetch));

    window.dispatchEvent(new Event('focus'));
    // Still running, and well past the throttle: a second return doesn't start another one.
    vi.advanceTimersByTime(31_000);
    window.dispatchEvent(new Event('focus'));
    expect(refetch).toHaveBeenCalledTimes(1);

    finish();
    await vi.advanceTimersByTimeAsync(0);
    // Finished, and 31 s since it started: the next return refreshes; one right after is throttled.
    window.dispatchEvent(new Event('focus'));
    expect(refetch).toHaveBeenCalledTimes(2);
    window.dispatchEvent(new Event('focus'));
    expect(refetch).toHaveBeenCalledTimes(2);
  });

  it('calls the latest callback without re-subscribing', () => {
    const first = vi.fn().mockResolvedValue(undefined);
    const second = vi.fn().mockResolvedValue(undefined);
    const { rerender } = renderHook(({ cb }) => useRefetchOnVisible(cb), { initialProps: { cb: first } });
    rerender({ cb: second });

    window.dispatchEvent(new Event('focus'));
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('stops listening once unmounted', () => {
    const refetch = vi.fn().mockResolvedValue(undefined);
    const { unmount } = renderHook(() => useRefetchOnVisible(refetch));
    unmount();

    window.dispatchEvent(new Event('focus'));
    setVisibility('visible');
    expect(refetch).not.toHaveBeenCalled();
  });
});
