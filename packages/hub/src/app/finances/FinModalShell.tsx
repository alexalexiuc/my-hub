'use client';

import { useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components';

type FinModalShellProps = {
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  /** Tailwind class to constrain max-width on desktop, e.g. "md:max-w-[420px]" */
  className?: string;
  /**
   * When true (default), wraps children in an overflow-y-auto scrollable area with padding.
   * Set to false when children manage their own scroll layout (e.g. TransactionModal).
   */
  scrollable?: boolean;
  /** When provided, renders a Cancel + Submit footer. */
  onSubmit?: () => void;
  submitLabel?: string;
  submitDisabled?: boolean;
  submitLoading?: boolean;
};

/**
 * Shared responsive wrapper for finances modals.
 * - Mobile (<md): full-screen with header (close button + title), scrollable body, and optional pinned footer.
 * - Desktop (≥md): centred overlay card with backdrop click-to-close and optional inline footer.
 * Locks body scroll while open.
 */
export function FinModalShell({
  onClose,
  title,
  children,
  className,
  scrollable = true,
  onSubmit,
  submitLabel = 'Save',
  submitDisabled,
  submitLoading,
}: FinModalShellProps) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <div className="fin-modal-shell finances-theme fixed inset-0 z-[1000] flex flex-col bg-[var(--fin-card)] md:items-center md:justify-center md:bg-[var(--fin-overlay)] md:p-4">
      {/* Desktop backdrop — absolutely positioned so it doesn't affect flex layout */}
      <div className="absolute inset-0 hidden md:block" onClick={onClose} />

      {/* Mobile header */}
      <div className="flex shrink-0 items-center border-b border-[var(--fin-border)] px-4 py-4 md:hidden">
        <Button
          type="button"
          variant="transparent"
          size="xs"
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--fin-muted)] active:opacity-60"
          aria-label="Close"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M2 2l14 14M16 2L2 16" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
        </Button>
        <h2 className="flex-1 text-center text-base font-bold text-[var(--fin-text)]">{title}</h2>
        <div className="h-8 w-8" />
      </div>

      {/* Content — full-height on mobile, constrained card on desktop */}
      <div
        className={cn(
          'fin-modal-card relative flex-1 bg-[var(--fin-card)]',
          scrollable ? 'overflow-y-auto p-4' : 'flex flex-col',
          'md:flex-none md:w-full md:max-h-[90vh] md:overflow-y-auto md:rounded-[14px] md:border md:border-[var(--fin-border)] md:p-5',
          className,
        )}
      >
        {/* Desktop title */}
        <div className="mb-4 hidden text-base font-bold text-[var(--fin-text)] md:block">{title}</div>
        {children}
        {/* Desktop footer — inside scrollable card, after content */}
        {onSubmit && (
          <div className="mt-4 hidden gap-2 md:flex">
            <Button type="button" variant="secondary" size="sm" className="flex-1" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              className="flex-[2]"
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
        <div className="flex shrink-0 gap-2 border-t border-[var(--fin-border)] p-4 md:hidden">
          <Button type="button" variant="secondary" size="sm" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            className="flex-[2]"
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
