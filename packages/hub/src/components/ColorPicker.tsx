import { cn } from '@/lib/utils';

type ColorPickerProps = React.ComponentPropsWithoutRef<'input'>;

/** Styled color input. Renders a circular swatch — pass `id` and a sibling `<label>` if you need a visible label. */
export function ColorPicker({ className, ...props }: ColorPickerProps) {
  return (
    <input
      type="color"
      className={cn('h-8 w-8 cursor-pointer rounded-full border-none bg-transparent p-0', className)}
      {...props}
    />
  );
}
