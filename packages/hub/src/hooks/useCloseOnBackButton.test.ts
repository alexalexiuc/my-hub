import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useCloseOnBackButton } from './useCloseOnBackButton';

function back() {
  window.dispatchEvent(new PopStateEvent('popstate'));
}

describe('useCloseOnBackButton', () => {
  afterEach(() => {
    window.history.replaceState(null, '', window.location.href);
  });

  it('pushes a history entry on mount', () => {
    const before = window.history.length;
    renderHook(() => useCloseOnBackButton(vi.fn()));
    expect(window.history.length).toBe(before + 1);
  });

  it('calls onClose when the browser back button is pressed', () => {
    const onClose = vi.fn();
    renderHook(() => useCloseOnBackButton(onClose));
    act(() => back());
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('discards the pushed history entry when closed without a back-press', () => {
    const historyBackSpy = vi.spyOn(window.history, 'back').mockImplementation(() => back());
    const { unmount } = renderHook(() => useCloseOnBackButton(vi.fn()));
    unmount();
    expect(historyBackSpy).toHaveBeenCalledOnce();
    historyBackSpy.mockRestore();
  });

  it('does not call history.back again if already closed via a back-press', () => {
    const historyBackSpy = vi.spyOn(window.history, 'back');
    const onClose = vi.fn();
    const { unmount } = renderHook(() => useCloseOnBackButton(onClose));
    act(() => back());
    unmount();
    expect(historyBackSpy).not.toHaveBeenCalled();
    historyBackSpy.mockRestore();
  });

  it('only closes the topmost of two nested overlays on one back-press', () => {
    const outerClose = vi.fn();
    const innerClose = vi.fn();
    renderHook(() => useCloseOnBackButton(outerClose));
    renderHook(() => useCloseOnBackButton(innerClose));

    act(() => back());
    expect(innerClose).toHaveBeenCalledOnce();
    expect(outerClose).not.toHaveBeenCalled();

    act(() => back());
    expect(outerClose).toHaveBeenCalledOnce();
  });
});
