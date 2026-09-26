import { useEffect, useRef } from 'react';

/**
 * Module-level LIFO stack of currently-open overlays' close callbacks, shared by every
 * `useCloseOnBackButton` instance. Overlays can nest (e.g. a `MobileSelectSheet` opened from
 * inside an already-open `Modal`), and each holds its own history entry — a single shared
 * `popstate` listener (rather than one per overlay) ensures one back-press closes only the
 * topmost overlay instead of every open overlay firing at once.
 */
const stack: Array<() => void> = [];

/**
 * `window.history.back()` (called from `unsubscribe` below) fires `popstate` asynchronously.
 * Without this counter, a UI-driven close (e.g. selecting an option in a `MobileSelectSheet`)
 * removes its own entry from `stack` and then, when its deferred `popstate` finally arrives,
 * `handlePopState` would pop whatever overlay is still open underneath it — closing a parent
 * `Modal` that the user never asked to close. Every programmatic `history.back()` call must be
 * swallowed by the next `popstate` instead of being treated as a real back-press.
 */
let pendingProgrammaticBacks = 0;
let listenerInstalled = false;

function handlePopState() {
  if (pendingProgrammaticBacks > 0) {
    pendingProgrammaticBacks--;
    return;
  }
  const onClose = stack.pop();
  onClose?.();
}

function subscribe(onClose: () => void) {
  if (!listenerInstalled) {
    listenerInstalled = true;
    window.addEventListener('popstate', handlePopState);
  }
  stack.push(onClose);
}

function unsubscribe(onClose: () => void) {
  const index = stack.lastIndexOf(onClose);
  if (index === -1) return; // already popped by a popstate back-press
  stack.splice(index, 1);
  // Closed via UI (X/Cancel/backdrop/save), not a back-press — discard the synthetic history
  // entry pushed on mount so a second real back-press isn't needed to leave the page.
  pendingProgrammaticBacks++;
  window.history.back();
}

/**
 * Makes the mobile/browser back button close an open overlay (modal, sheet) instead of
 * navigating away from the page. Pushes a synthetic history entry on mount (same URL, so
 * Next.js's router sees no URL change and does nothing) and pops it on unmount. A back-press
 * fires `popstate`, which closes the topmost open overlay via the shared stack above.
 *
 * The entry is released on a microtask rather than straight from the effect cleanup. React
 * StrictMode (development only) runs every effect as mount → cleanup → mount, synchronously.
 * Releasing in that cleanup called `history.back()`, which resolves asynchronously — after the
 * remount had already pushed a second entry — so history ended up one step out of line with the
 * stack, and closing the overlay then walked the browser off the page entirely. Deferring the
 * release lets the remount reclaim the entry it still holds; a real unmount releases it a
 * microtask later.
 */
export function useCloseOnBackButton(onClose: () => void): void {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  // The history entry this overlay holds, and whether its release is scheduled. Refs survive an
  // effect re-run, which is what lets a StrictMode remount keep the entry instead of pushing another.
  const heldRef = useRef<{ close: () => void; releasing: boolean } | null>(null);

  useEffect(() => {
    const held = heldRef.current;
    if (held) {
      // Remounted before the scheduled release ran: keep the existing entry and subscription.
      held.releasing = false;
    } else {
      const close = () => onCloseRef.current();
      window.history.pushState({ ...window.history.state, hubOverlay: true }, '', window.location.href);
      subscribe(close);
      heldRef.current = { close, releasing: false };
    }

    return () => {
      const { current } = heldRef;
      if (!current) return;
      current.releasing = true;
      queueMicrotask(() => {
        if (!current.releasing) return; // reclaimed by a remount
        heldRef.current = null;
        unsubscribe(current.close);
      });
    };
  }, []);
}
