import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export type SelectOption = { value: string | number; label: string };

type SelectProps = React.ComponentPropsWithoutRef<'select'> & {
  options?: SelectOption[];
};

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, children, options, ...props },
  ref,
) {
  return (
    <select ref={ref} className={cn('input', className)} {...props}>
      {children}
      {options?.map(o => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
});
