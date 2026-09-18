import { cn } from '@/lib/utils';
import { FieldInfo } from './FieldInfo';

interface Props {
  label: string;
  children: React.ReactNode;
  className?: string;
  /**
   * Explanation of the field, revealed by an info icon beside the label.
   *
   * Prefer this over a placeholder for anything that has to survive the first keystroke: what the
   * field unlocks, what happens when it is left blank, what unit or convention it follows.
   * Placeholders are for a short example of a value ("e.g. 175") and nothing else.
   */
  info?: React.ReactNode;
}

export function Field({ label, children, className = '', info }: Props) {
  return (
    <label className={cn('block', className)}>
      <span className={cn('text-xs text-zinc-400 mb-1', info ? 'flex items-center gap-1.5' : 'block')}>
        {label}
        {info && <FieldInfo label={label}>{info}</FieldInfo>}
      </span>
      {children}
    </label>
  );
}
