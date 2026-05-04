'use client';

import { cn } from '@/lib/utils';

type FinModalShellProps = {
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  /** Tailwind class to constrain max-width on desktop, e.g. "md:max-w-[420px]" */
  className?: string;
};

/**
 * Shared responsive wrapper for finances creation modals.
 * - Desktop (≥md): centred overlay card.
 * - Mobile (<md): bottom-anchored sheet with rounded top corners.
 */
export function FinModalShell({ onClose, title, children, className }: FinModalShellProps) {
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[1000] flex items-end bg-[var(--fin-overlay)] md:items-center md:justify-center md:p-4"
    >
      <div
        onClick={e => e.stopPropagation()}
        className={cn(
          'max-h-[90vh] w-full overflow-y-auto rounded-t-[18px] border border-[var(--fin-border)] bg-[var(--fin-card)] p-5 md:rounded-[14px]',
          className,
        )}
      >
        <div className="mb-4 text-base font-bold text-[var(--fin-text)]">{title}</div>
        {children}
      </div>
    </div>
  );
}
