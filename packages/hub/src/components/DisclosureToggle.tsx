'use client';

import { ReactNode, useEffect, useState } from 'react';
import { ChevronDownOutlineIcon, ChevronRightOutlineIcon } from './icons';

export type DisclosureToggleProps = {
  label: string;
  children: ReactNode;
  defaultOpen?: boolean;
  openSignal?: number;
  className?: string;
  contentClassName?: string;
};

/**
 * Disclosure toggle with internal open/close state.
 *
 * Use `openSignal` when a parent action should force-open the content
 * without turning this into a controlled component.
 */
export function DisclosureToggle({
  label,
  children,
  defaultOpen = false,
  openSignal = 0,
  className,
  contentClassName,
}: DisclosureToggleProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  useEffect(() => {
    if (openSignal > 0) {
      setIsOpen(true);
    }
  }, [openSignal]);

  const ToggleIcon = isOpen ? ChevronDownOutlineIcon : ChevronRightOutlineIcon;

  return (
    <div className={className ?? 'space-y-3'}>
      <button
        type="button"
        className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors flex items-center gap-1"
        onClick={() => setIsOpen(v => !v)}
      >
        <ToggleIcon className="size-3.5" />
        <span>{label}</span>
      </button>

      {isOpen ? <div className={contentClassName}>{children}</div> : null}
    </div>
  );
}
