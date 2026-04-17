import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

type CheckboxProps = Omit<React.ComponentPropsWithoutRef<'input'>, 'type'>;

/** Styled checkbox input. Wrap in a `<label>` for click-target expansion. */
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox({ className, ...props }, ref) {
  return <input ref={ref} {...props} type="checkbox" className={cn('accent-blue-500 w-4 h-4', className)} />;
});
