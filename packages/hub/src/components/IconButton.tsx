import type { ReactNode } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { SpinnerIcon } from './icons';

interface Props {
  label: string;
  icon: ReactNode;
  onClick?: () => void;
  href?: string;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
  variant?: 'default' | 'ghost';
  'aria-expanded'?: boolean;
}

const variantClassName = {
  default: 'rounded-md bg-[var(--card2,#27272a)] p-1.5 text-[var(--text,#d4d4d8)] hover:bg-[var(--card3,#3f3f46)]',
  ghost: 'text-[var(--muted,#a1a1aa)] hover:text-[var(--text,#e4e4e7)] transition-colors',
};

export function IconButton({
  label,
  icon,
  onClick,
  href,
  loading = false,
  disabled = false,
  className,
  variant = 'default',
  'aria-expanded': ariaExpanded,
}: Props) {
  const content = loading ? <SpinnerIcon className="opacity-70" /> : icon;
  const base = variantClassName[variant];

  if (href) {
    return (
      <Link href={href} className={cn(base, className)} aria-label={label} title={label}>
        {content}
      </Link>
    );
  }

  return (
    <button
      onClick={onClick}
      disabled={loading || disabled}
      className={cn(base, 'disabled:cursor-not-allowed disabled:opacity-50', className)}
      aria-label={label}
      title={label}
      aria-expanded={ariaExpanded}
    >
      {content}
    </button>
  );
}
