import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import { SpinnerIcon } from './icons';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'transparent';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  loading?: boolean;
  size?: 'xs' | 'sm' | 'md';
}

const variants: Record<Variant, string> = {
  primary: 'bg-indigo-600 text-white hover:bg-indigo-500',
  secondary: 'border border-zinc-700 bg-zinc-800 text-zinc-200 hover:bg-zinc-700',
  danger: 'bg-red-600 text-white hover:bg-red-500',
  ghost: 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800',
  transparent: 'bg-transparent',
};

const sizes = {
  xs: 'px-2 py-1 text-xs',
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
};

export function Button({
  variant = 'primary',
  loading = false,
  size = 'md',
  disabled,
  children,
  className,
  ...props
}: Props) {
  return (
    <button
      disabled={disabled || loading}
      className={cn('rounded-lg font-medium transition disabled:opacity-50', variants[variant], sizes[size], className)}
      {...props}
    >
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
