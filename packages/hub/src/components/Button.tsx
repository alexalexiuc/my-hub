import type { ButtonHTMLAttributes } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { SpinnerIcon } from './icons';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'transparent' | 'accent' | 'fin-pill' | 'neutral';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  variant?: Variant;
  size?: 'xs' | 'sm' | 'md';
  active?: boolean;
  href?: string;
}

const variants: Record<Variant, string> = {
  primary: 'bg-indigo-600 text-white hover:bg-indigo-500',
  secondary: 'border border-zinc-700 bg-zinc-800 text-zinc-200 hover:bg-zinc-700',
  neutral: 'border border-[var(--border)] bg-[var(--card2)] text-[var(--muted)] hover:text-[var(--text)]',
  danger: 'bg-red-600 text-white hover:bg-red-500',
  ghost: 'text-[var(--muted)] hover:text-[var(--text)]',
  transparent: 'bg-transparent',
  accent: 'bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)]',
  'fin-pill':
    'rounded-[20px] border border-[var(--border)] bg-[var(--card2)] px-3 py-[5px] text-[11px] text-[var(--muted)] hover:text-[var(--text)]',
};

const activeVariants: Record<Variant, string> = {
  primary: 'bg-indigo-700',
  secondary: 'bg-zinc-700 border-zinc-600 text-white',
  danger: 'bg-red-700',
  ghost: 'border border-[var(--border)]',
  transparent: 'bg-zinc-800/30',
  accent: 'bg-[var(--accent-hover)]',
  'fin-pill': 'text-[var(--text)] border-[var(--accent)]',
  neutral: 'border-[var(--accent)]',
};

const sizes = {
  xs: 'px-2 py-1 text-[10px] leading-none',
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
};

export function Button({
  variant = 'primary',
  loading = false,
  size = 'md',
  active = false,
  href,
  disabled,
  children,
  className,
  ...props
}: Props) {
  const resolvedClassName = cn(
    'rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed self-center',
    variants[variant],
    sizes[size],
    active && activeVariants[variant],
    className,
  );

  if (href) {
    return (
      <Link href={href} className={resolvedClassName}>
        {children}
      </Link>
    );
  }

  return (
    <button disabled={disabled || loading} className={resolvedClassName} {...props}>
      {loading ? (
        <>
          <SpinnerIcon className="mr-1.5 inline-block" />
          <span className="opacity-70">{children}</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}
