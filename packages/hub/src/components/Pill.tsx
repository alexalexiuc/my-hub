import { cn } from '@/lib/utils';

export type PillProps = {
  icon?: string;
  label: string;
  color: string;
  className?: string;
  onClick?: () => void;
  onRemove?: () => void;
  disabled?: boolean;
  title?: string;
};

/** Compact label pill. Renders as a button when `onClick` is provided, otherwise as a passive badge. Renders a remove button when `onRemove` is provided. */
export function Pill({ icon, label, color, className, onClick, onRemove, disabled = false, title }: PillProps) {
  const pillClassName = cn(
    'inline-flex items-center gap-1 rounded-[20px] border px-2 py-[2px] text-[11px] font-medium transition-[filter,transform] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fin-accent)]',
    onClick ? 'cursor-pointer hover:brightness-95 active:translate-y-px' : 'cursor-default',
    disabled ? 'cursor-not-allowed opacity-50' : null,
    className,
  );

  const content = (
    <>
      {icon && <span className="text-[10px]">{icon}</span>}
      {label}
      {onRemove && (
        <button
          type="button"
          onClick={e => {
            e.stopPropagation();
            onRemove();
          }}
          className="ml-0.5 opacity-60 hover:opacity-100"
          aria-label={`Remove ${label}`}
        >
          ×
        </button>
      )}
    </>
  );

  const style = {
    background: color + '22',
    border: `1px solid ${color}44`,
    color,
  };

  if (onClick) {
    return (
      <button type="button" onClick={onClick} disabled={disabled} title={title} className={pillClassName} style={style}>
        {content}
      </button>
    );
  }

  return (
    <span className={pillClassName} style={style} title={title}>
      {content}
    </span>
  );
}
