import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

type FilePickerProps = Omit<React.ComponentPropsWithoutRef<'input'>, 'type'>;

/** File picker input. Separate component to allow future drag-and-drop enhancement. */
export const FilePicker = forwardRef<HTMLInputElement, FilePickerProps>(function FilePicker(
  { className, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      {...props}
      type="file"
      className={cn('w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm', className)}
    />
  );
});
