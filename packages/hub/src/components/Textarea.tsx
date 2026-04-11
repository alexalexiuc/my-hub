import { cn } from '@/lib/utils';

type TextareaProps = React.ComponentPropsWithoutRef<'textarea'>;

export function Textarea({ className, ...props }: TextareaProps) {
  return <textarea className={cn('input', className)} {...props} />;
}
