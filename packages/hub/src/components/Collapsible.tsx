'use client';

import { useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { IconButton } from './IconButton';
import { ChevronRightOutlineIcon } from './icons';

export type CollapsibleVariant = 'box' | 'text';

export type CollapsibleProps = {
  label: ReactNode;
  children: ReactNode;
  variant?: CollapsibleVariant;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  showIcon?: boolean;
  leading?: ReactNode;
  inlineActions?: ReactNode;
  actions?: ReactNode;
  className?: string;
  headerClassName?: string;
  contentClassName?: string;
};

export function Collapsible({
  label,
  children,
  variant = 'box',
  defaultOpen = true,
  open,
  onOpenChange,
  showIcon = true,
  leading,
  inlineActions,
  actions,
  className,
  headerClassName,
  contentClassName,
}: CollapsibleProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isOpen = open ?? internalOpen;

  function toggle() {
    const next = !isOpen;
    if (open === undefined) setInternalOpen(next);
    onOpenChange?.(next);
  }

  return (
    <div
      className={cn(
        variant === 'box' && 'space-y-3 rounded-lg border border-[var(--border)] bg-[var(--card)] p-4',
        className,
      )}
    >
      <div className={cn('flex items-center justify-between gap-2', variant === 'text' && 'mb-1.5', headerClassName)}>
        <div className="flex min-w-0 items-center gap-1.5">
          {leading}
          {showIcon && (
            <IconButton
              label={isOpen ? 'Collapse' : 'Expand'}
              icon={
                <ChevronRightOutlineIcon
                  className={cn('size-3.5 transition-transform duration-200', isOpen && 'rotate-90')}
                />
              }
              onClick={toggle}
              variant="ghost"
              aria-expanded={isOpen}
              className="shrink-0 rounded p-1 text-[var(--subtle)] hover:bg-[var(--card2)] hover:text-[var(--text)]"
            />
          )}
          <span
            onClick={toggle}
            className={cn(
              'min-w-0 cursor-pointer truncate select-none font-semibold text-[var(--text)]',
              variant === 'box' ? 'text-sm' : 'text-[13px]',
            )}
          >
            {label}
          </span>
          {inlineActions}
        </div>
        {actions}
      </div>
      {isOpen && <div className={contentClassName}>{children}</div>}
    </div>
  );
}
