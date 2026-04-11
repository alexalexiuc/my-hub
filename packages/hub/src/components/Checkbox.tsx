import { cn } from '@/lib/utils';

type CheckboxProps = Omit<React.ComponentPropsWithoutRef<'input'>, 'type'>;

/** Styled checkbox input. Wrap in a `<label>` for click-target expansion. */
export function Checkbox({ className, ...props }: CheckboxProps) {
  return <input {...props} type="checkbox" className={cn('accent-blue-500 w-4 h-4', className)} />;
}
