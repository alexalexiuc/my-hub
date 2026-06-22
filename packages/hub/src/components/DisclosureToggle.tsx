'use client';

import { ReactNode, useEffect, useState } from 'react';
import { Collapsible } from './Collapsible';

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

  return (
    <Collapsible
      variant="text"
      label={label}
      open={isOpen}
      onOpenChange={setIsOpen}
      className={className}
      contentClassName={contentClassName}
    >
      {children}
    </Collapsible>
  );
}
