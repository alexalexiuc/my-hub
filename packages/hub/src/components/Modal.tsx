'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/Button';
import { IconButton } from '@/components/IconButton';
import { XOutlineIcon } from '@/components/icons/XOutlineIcon';

export type ModalProps = {
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  /** Tailwind class to constrain max-width on desktop, e.g. "md:max-w-[420px]" */
  className?: string;
  /**
   * When true (default), wraps children in an overflow-y-auto scrollable area with padding.
   * Set to false when children manage their own scroll layout.
   */
  scrollable?: boolean;
  /** When provided, renders a Cancel + Submit footer. */
  onSubmit?: () => void;
  submitLabel?: string;
  submitDisabled?: boolean;
  submitLoading?: boolean;
};

/**
 * Responsive modal wrapper.
 * - Mobile (<md): full-screen with header (close button + title), scrollable body, and optional pinned footer.
 * - Desktop (≥md): centred overlay card with backdrop click-to-close and optional inline footer.
 * Locks body scroll while open.
 */
export function Modal({
  onClose,
  title,
  children,
  className,
  scrollable = true,
  onSubmit,
  submitLabel = 'Save',
  submitDisabled,
  submitLoading,
}: ModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // When the virtual keyboard opens, the visual viewport shrinks while the
  // layout viewport stays unchanged (interactiveWidget: resizes-visual).
  // Sync the modal height to the visual viewport so it doesn't extend under
  // the keyboard. We intentionally leave `top` alone — the CSS `top-0` class
  // keeps the modal flush with the layout viewport top, and setting it to
  // vv.offsetTop can push the modal down on Android when browser chrome
  // (e.g. AutoFill bar) makes offsetTop non-zero.
  useEffect(() => {
    const vv = window.visualViewport;
    const el = containerRef.current;
    if (!vv || !el) return;

    const sync = () => {
      if (window.innerWidth >= 768) return; // desktop modal handles itself
      el.style.height = `${vv.height}px`;
    };

    sync();
    vv.addEventListener('resize', sync);
    vv.addEventListener('scroll', sync);
    return () => {
      el.style.height = '';
      vv.removeEventListener('resize', sync);
      vv.removeEventListener('scroll', sync);
    };
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handle = (e: FocusEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') {
        setTimeout(() => t.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 300);
      }
    };
    el.addEventListener('focusin', handle);
    return () => el.removeEventListener('focusin', handle);
  }, []);

  return (
    <div
      ref={containerRef}
      className="modal-shell fixed inset-x-0 top-0 h-[100dvh] z-[1000] flex flex-col bg-[var(--card)] md:inset-0 md:h-auto md:items-center md:justify-center md:bg-[var(--overlay)] md:p-4"
    >
      {/* Desktop backdrop — absolute so it doesn't affect flex layout */}
      <div data-layout="desktop" className="absolute inset-0 hidden md:block" onClick={onClose} />

      {/* Mobile header */}
      <div
        data-layout="mobile"
        className="flex shrink-0 items-center border-b border-[var(--border)] px-4 py-4 md:hidden"
      >
        <IconButton
          variant="ghost"
          label="Close"
          icon={<XOutlineIcon className="size-7" />}
          onClick={onClose}
          className="text-[var(--muted)] hover:bg-[var(--card2)] hover:text-[var(--accent)]"
        />
        <h2 className="flex-1 text-center text-base font-bold text-[var(--text)]">{title}</h2>
        <div className="h-8 w-8" />
      </div>

      {/* Content — full-height on mobile, constrained card on desktop */}
      <div
        className={cn(
          'modal-card relative flex-1 bg-[var(--card)]',
          scrollable ? 'overflow-y-auto p-4' : 'flex flex-col',
          'md:flex-none md:w-full md:max-h-[90vh] md:overflow-y-auto md:rounded-[14px] md:border md:border-[var(--border)] md:p-5',
          className,
        )}
      >
        {/* Desktop title */}
        <div data-layout="desktop" className="mb-4 hidden text-base font-bold text-[var(--text)] md:block">
          <div className="flex items-center justify-between">
            {title}
            <IconButton
              variant="ghost"
              label="Close"
              icon={<XOutlineIcon className="size-6" />}
              onClick={onClose}
              className="text-[var(--muted)] hover:bg-[var(--card2)] hover:text-[var(--accent)]"
            />
          </div>
        </div>
        {children}
        {/* Desktop footer — inside scrollable card, after content */}
        {onSubmit && (
          <div data-layout="desktop" className="mt-4 hidden gap-2 md:flex">
            <Button
              type="button"
              variant="neutral"
              size="sm"
              className="flex-1 py-2.5 text-[13px] font-semibold hover:border-[var(--red)] hover:text-[var(--red)]"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              variant="accent"
              className="flex-[2] py-2.5 text-[13px]"
              disabled={submitDisabled}
              loading={submitLoading}
              onClick={onSubmit}
            >
              {submitLabel}
            </Button>
          </div>
        )}
      </div>

      {/* Mobile footer — pinned at bottom of full-screen, outside scrollable area */}
      {onSubmit && (
        <div data-layout="mobile" className="flex shrink-0 gap-2 border-t border-[var(--border)] p-2 md:hidden">
          <Button
            type="button"
            variant="neutral"
            size="sm"
            className="flex-1 py-2.5 text-[13px] font-semibold hover:border-[var(--red)] hover:text-[var(--red)]"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="accent"
            size="sm"
            className="flex-[2] py-2.5 text-[13px]"
            disabled={submitDisabled}
            loading={submitLoading}
            onClick={onSubmit}
          >
            {submitLabel}
          </Button>
        </div>
      )}
    </div>
  );
}
