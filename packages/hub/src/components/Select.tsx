import { cn } from '@/lib/utils';

export type SelectOption = { value: string | number; label: string };

type SelectProps = React.ComponentPropsWithoutRef<'select'> & {
  options?: SelectOption[];
};

export function Select({ className, children, options, ...props }: SelectProps) {
  return (
    <select className={cn('input', className)} {...props}>
      {children}
      {options?.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
