import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

type TextareaProps = React.ComponentPropsWithoutRef<'textarea'>;

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea({ className, ...props }, ref) {
  return <textarea ref={ref} className={cn('input', className)} {...props} />;
});
