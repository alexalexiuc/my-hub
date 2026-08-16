import { useEffect, useRef } from 'react';

/**
 * Module-level LIFO stack of currently-open overlays' close callbacks, shared by every
 * `useCloseOnBackButton` instance. Overlays can nest (e.g. a `MobileSelectSheet` opened from
 * inside an already-open `Modal`), and each holds its own history entry — a single shared
 * `popstate` listener (rather than one per overlay) ensures one back-press closes only the
 * topmost overlay instead of every open overlay firing at once.
 */
const stack: Array<() => void> = [];

function handlePopState() {
  const onClose = stack.pop();
  onClose?.();
}

function subscribe(onClose: () => void) {
  if (stack.length === 0) window.addEventListener('popstate', handlePopState);
  stack.push(onClose);
}

function unsubscribe(onClose: () => void) {
  const index = stack.lastIndexOf(onClose);
  if (index === -1) return; // already popped by a popstate back-press
  stack.splice(index, 1);
  if (stack.length === 0) window.removeEventListener('popstate', handlePopState);
  // Closed via UI (X/Cancel/backdrop/save), not a back-press — discard the synthetic history
  // entry pushed on mount so a second real back-press isn't needed to leave the page.
  window.history.back();
}

/**
 * Makes the mobile/browser back button close an open overlay (modal, sheet) instead of
 * navigating away from the page. Pushes a synthetic history entry on mount (same URL, so
 * Next.js's router sees no URL change and does nothing) and pops it on unmount. A back-press
 * fires `popstate`, which closes the topmost open overlay via the shared stack above.
 */
export function useCloseOnBackButton(onClose: () => void): void {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const close = () => onCloseRef.current();
    window.history.pushState({ ...window.history.state, hubOverlay: true }, '', window.location.href);
    subscribe(close);
    return () => unsubscribe(close);
  }, []);
}
