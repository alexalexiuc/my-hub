'use client';

import { cn } from '@/lib/utils';

/** Horizontal rule using the `--border` CSS variable. */
export function Divider({ className }: { className?: string }) {
  return <div className={cn('my-[2px] h-px bg-[var(--border)]', className)} />;
}

/** Uppercase 11px section heading using `--subtle`. */
export function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('mb-1 text-[11px] font-semibold uppercase tracking-widest text-[var(--subtle)]', className)}>
      {children}
    </div>
  );
}

type SubTextProps = React.HTMLAttributes<HTMLSpanElement>;

/** 11px muted text span using `--subtle`. */
export function SubText({ children, className, ...rest }: SubTextProps) {
  return (
    <span className={cn('text-[11px] text-[var(--subtle)]', className)} {...rest}>
      {children}
    </span>
  );
}
