import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

type InputProps = React.ComponentPropsWithoutRef<'input'> & {
  variant?: 'default' | 'ghost';
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, variant = 'default', ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      className={cn(
        variant === 'ghost'
          ? 'flex-1 min-w-0 bg-transparent border-b border-[var(--border)] focus:border-[var(--accent)] outline-none text-sm py-0.5 placeholder:text-[var(--subtle)] transition-colors'
          : 'input',
        className,
      )}
      {...props}
    />
  );
});
