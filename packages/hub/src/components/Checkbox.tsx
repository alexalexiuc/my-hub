import { cn } from '@/lib/utils';

type CheckboxProps = React.ComponentPropsWithoutRef<'input'>;

/** Styled checkbox input. Wrap in a `<label>` for click-target expansion. */
export function Checkbox({ className, ...props }: CheckboxProps) {
  return <input type="checkbox" className={cn('accent-blue-500 w-4 h-4', className)} {...props} />;
}
