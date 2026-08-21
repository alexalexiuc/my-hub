import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCloseOnBackButton } from './useCloseOnBackButton';

function back() {
  window.dispatchEvent(new PopStateEvent('popstate'));
}

describe('useCloseOnBackButton', () => {
  let historyBackSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Real `history.back()` fires `popstate` asynchronously; resolving it synchronously here
    // keeps tests deterministic. The hook's popstate listener is a permanent module-level
    // singleton (never removed), so a stray real back-navigation left over from a test that
    // forgot to unmount would otherwise bleed into later tests in this file.
    historyBackSpy = vi.spyOn(window.history, 'back').mockImplementation(() => back());
  });

  afterEach(() => {
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

  it('discards the pushed history entry when closed without a back-press', () => {
    const { unmount } = renderHook(() => useCloseOnBackButton(vi.fn()));
    unmount();
    expect(historyBackSpy).toHaveBeenCalledOnce();
  });

  it('does not call history.back again if already closed via a back-press', () => {
    const onClose = vi.fn();
    const { unmount } = renderHook(() => useCloseOnBackButton(onClose));
    act(() => back());
    unmount();
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

  it('does not close an outer overlay when an inner overlay is closed via UI, not a back-press', () => {
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

    expect(historyBackSpy).toHaveBeenCalledOnce();
    expect(outerClose).not.toHaveBeenCalled();
    expect(innerClose).not.toHaveBeenCalled();

    // A subsequent real back-press should still correctly close the outer overlay.
    act(() => back());
    expect(outerClose).toHaveBeenCalledOnce();

    outer.unmount();
  });
});
