'use client';

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { usePortalTheme } from '@/hooks/usePortalTheme';
import { InfoCircleIcon } from '@/components/icons/InfoCircleIcon';

export type FieldInfoProps = {
  /** The explanation itself. Keep it to a sentence or two of plain prose. */
  children: React.ReactNode;
  /** Field name, used to build the trigger's accessible name ("About Goal weight"). */
  label: string;
  className?: string;
};

/** Panel width on desktop; narrower viewports clamp it via `max-w`. */
const PANEL_WIDTH = 248;
/** Keep the panel this far from the viewport edges. */
const GUTTER = 8;
/** Gap between the trigger and the panel. */
const GAP = 6;

/**
 * An info icon that reveals a short explanation of the field it sits next to.
 *
 * Use it for anything the user still needs *after* they start typing — a placeholder is the wrong
 * home for that, because it vanishes on the first keystroke, is truncated by the input width, and
 * is styled as if it were a value.
 *
 * Two implementation notes, both load-bearing:
 *
 * - The trigger is a `<span role="button">`, not a `<button>`. `Field` renders a `<label>` wrapping
 *   its control, and a `<label>` takes its labeled control from the first *labelable* descendant —
 *   a real `<button>` placed before the input would silently steal the association and leave the
 *   input with no accessible name. A span is not labelable, so the label keeps pointing at the
 *   control. Click is `preventDefault`ed for the same reason: label activation runs as the click's
 *   default action, so without it tapping the icon would focus (or, on a checkbox, toggle) the field.
 * - The panel is portaled to `document.body` and positioned `fixed`. Cards on these forms are
 *   `overflow-hidden`, which would clip an absolutely-positioned panel.
 *
 * Opening is click/tap only, not hover: hover has no touch equivalent, and mixing the two makes a
 * tap both open and immediately re-close the panel on devices that emit synthetic mouse events.
 */
export function FieldInfo({ children, label, className }: FieldInfoProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [themeAnchorRef, themeClassName] = usePortalTheme();
  const panelId = useId();

  // Position after the panel is in the DOM so its measured size can decide which side to sit on.
  useLayoutEffect(() => {
    if (!open) return;

    function place() {
      const trigger = triggerRef.current;
      const panel = panelRef.current;
      if (!trigger || !panel) return;

      const rect = trigger.getBoundingClientRect();
      const { offsetWidth: width, offsetHeight: height } = panel;

      // Centre on the trigger, then pull back inside the viewport.
      const centred = rect.left + rect.width / 2 - width / 2;
      const left = Math.max(GUTTER, Math.min(centred, window.innerWidth - GUTTER - width));

      // Below by default; flip above only when that fits better, so the panel never hangs off-screen.
      const spaceBelow = window.innerHeight - rect.bottom - GAP - GUTTER;
      const spaceAbove = rect.top - GAP - GUTTER;
      const top = spaceBelow >= height || spaceBelow >= spaceAbove ? rect.bottom + GAP : rect.top - GAP - height;

      setPosition({ top, left });
    }

    place();
    // Reposition rather than close, so a small scroll while reading doesn't dismiss the panel.
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function handlePointerOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      setOpen(false);
      triggerRef.current?.focus();
    }

    document.addEventListener('mousedown', handlePointerOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handlePointerOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  function toggle(event: React.SyntheticEvent) {
    // Stops the enclosing <label> from focusing or toggling its control. See the note above.
    event.preventDefault();
    event.stopPropagation();
    setOpen(prev => {
      if (prev) return false;
      setPosition(null); // Re-measure on every open — the field may have moved since last time.
      return true;
    });
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLSpanElement>) {
    if (event.key === 'Enter' || event.key === ' ') toggle(event);
  }

  return (
    <>
      {/* Negative margin keeps the enlarged tap target from padding out the label row. */}
      <span
        ref={triggerRef}
        role="button"
        tabIndex={0}
        aria-label={`About ${label}`}
        aria-expanded={open}
        aria-describedby={open ? panelId : undefined}
        onClick={toggle}
        onKeyDown={handleKeyDown}
        className={cn(
          'inline-flex -m-1 cursor-pointer items-center justify-center rounded-full p-1 align-middle transition-colors',
          'text-[var(--subtle,#71717a)] hover:text-[var(--accent,#818cf8)]',
          'focus-visible:outline focus-visible:outline-1 focus-visible:outline-[var(--accent,#818cf8)]',
          open && 'text-[var(--accent,#818cf8)]',
          className,
        )}
      >
        <InfoCircleIcon className="size-3.5" />
      </span>

      {/* Stays in the tree so the theme hook can find the `*-theme` ancestor to copy across. */}
      <span ref={themeAnchorRef} aria-hidden="true" className="hidden" />

      {open &&
        createPortal(
          <div
            ref={panelRef}
            id={panelId}
            role="tooltip"
            style={{
              top: position?.top ?? 0,
              left: position?.left ?? 0,
              width: PANEL_WIDTH,
              // Hidden until measured, otherwise the first paint lands in the top-left corner.
              visibility: position ? 'visible' : 'hidden',
            }}
            className={cn(
              themeClassName,
              'fixed z-[1200] max-w-[calc(100vw-16px)] rounded-lg border p-2.5 text-xs leading-relaxed shadow-lg',
              'border-[var(--border,#27272a)] bg-[var(--card2,#27272a)] text-[var(--muted,#a1a1aa)]',
            )}
          >
            {children}
          </div>,
          document.body,
        )}
    </>
  );
}
