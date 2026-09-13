import { StrictMode, createElement, type ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCloseOnBackButton } from './useCloseOnBackButton';

function back() {
  window.dispatchEvent(new PopStateEvent('popstate'));
}

/** Resolves once already-queued microtasks have run — the hook releases its entry on one. */
function flushMicrotasks() {
  return new Promise<void>(resolve => queueMicrotask(resolve));
}

const strictMode = ({ children }: { children: ReactNode }) => createElement(StrictMode, null, children);

describe('useCloseOnBackButton', () => {
  let historyBackSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Real `history.back()` fires `popstate` asynchronously; resolving it synchronously here
    // keeps tests deterministic. The hook's popstate listener is a permanent module-level
    // singleton (never removed), so a stray real back-navigation left over from a test that
    // forgot to unmount would otherwise bleed into later tests in this file.
    historyBackSpy = vi.spyOn(window.history, 'back').mockImplementation(() => back());
  });

  afterEach(async () => {
    // Let a release scheduled by an unmount at the end of the test run against the mocked
    // `back` before it is restored.
    await flushMicrotasks();
    historyBackSpy.mockRestore();
    window.history.replaceState(null, '', window.location.href);
  });

  it('pushes a history entry on mount', () => {
    const before = window.history.length;
    const { unmount } = renderHook(() => useCloseOnBackButton(vi.fn()));
    expect(window.history.length).toBe(before + 1);
    unmount();
  });

  it('calls onClose when the browser back button is pressed', () => {
    const onClose = vi.fn();
    const { unmount } = renderHook(() => useCloseOnBackButton(onClose));
    act(() => back());
    expect(onClose).toHaveBeenCalledOnce();
    unmount();
  });

  it('discards the pushed history entry when closed without a back-press', async () => {
    const { unmount } = renderHook(() => useCloseOnBackButton(vi.fn()));
    unmount();
    await flushMicrotasks();
    expect(historyBackSpy).toHaveBeenCalledOnce();
  });

  it('does not call history.back again if already closed via a back-press', async () => {
    const onClose = vi.fn();
    const { unmount } = renderHook(() => useCloseOnBackButton(onClose));
    act(() => back());
    unmount();
    await flushMicrotasks();
    expect(historyBackSpy).not.toHaveBeenCalled();
  });

  it('only closes the topmost of two nested overlays on one back-press', () => {
    const outerClose = vi.fn();
    const innerClose = vi.fn();
    const outer = renderHook(() => useCloseOnBackButton(outerClose));
    const inner = renderHook(() => useCloseOnBackButton(innerClose));

    act(() => back());
    expect(innerClose).toHaveBeenCalledOnce();
    expect(outerClose).not.toHaveBeenCalled();

    act(() => back());
    expect(outerClose).toHaveBeenCalledOnce();

    inner.unmount();
    outer.unmount();
  });

  it('does not close an outer overlay when an inner overlay is closed via UI, not a back-press', async () => {
    // This is the exact sequence that regressed selecting a mobile dropdown option (which
    // closes only the sheet via its own onClose) into also closing the parent modal: the
    // inner overlay's cleanup removes itself from the stack and triggers a deferred
    // history.back(), and the resulting popstate must not fall through to the overlay
    // still open underneath it.
    const outerClose = vi.fn();
    const innerClose = vi.fn();
    const outer = renderHook(() => useCloseOnBackButton(outerClose));
    const inner = renderHook(() => useCloseOnBackButton(innerClose));

    inner.unmount();
    await flushMicrotasks();

    expect(historyBackSpy).toHaveBeenCalledOnce();
    expect(outerClose).not.toHaveBeenCalled();
    expect(innerClose).not.toHaveBeenCalled();

    // A subsequent real back-press should still correctly close the outer overlay.
    act(() => back());
    expect(outerClose).toHaveBeenCalledOnce();

    outer.unmount();
  });

  it('holds exactly one history entry under StrictMode, which mounts effects twice', async () => {
    // Development StrictMode runs the effect as mount → cleanup → mount. Releasing the entry in
    // that cleanup called history.back() mid-mount, which knocked history out of line with the
    // stack — and closing the overlay then navigated away from the page.
    const pushSpy = vi.spyOn(window.history, 'pushState');
    const { unmount } = renderHook(() => useCloseOnBackButton(vi.fn()), { wrapper: strictMode });
    await flushMicrotasks();

    expect(pushSpy).toHaveBeenCalledOnce();
    expect(historyBackSpy).not.toHaveBeenCalled();

    unmount();
    await flushMicrotasks();
    expect(historyBackSpy).toHaveBeenCalledOnce();
    pushSpy.mockRestore();
  });

  it('still closes on a back-press under StrictMode, without a second history.back', async () => {
    const onClose = vi.fn();
    const { unmount } = renderHook(() => useCloseOnBackButton(onClose), { wrapper: strictMode });
    await flushMicrotasks();

    act(() => back());
    expect(onClose).toHaveBeenCalledOnce();

    unmount();
    await flushMicrotasks();
    expect(historyBackSpy).not.toHaveBeenCalled();
  });
});
