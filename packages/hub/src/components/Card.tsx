import { cn } from '@/lib/utils';

export type CardProps = {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
  /** Skips the mobile full-bleed stretch and renders a compact bordered card at all sizes */
  compact?: boolean;
};

/**
 * Responsive content card. On desktop: rounded border card. On mobile: full-bleed
 * with top/bottom borders (stretches edge-to-edge). Use `compact` to opt out of
 * the full-bleed mobile style. Use FinFieldCard (in finances/ui.tsx) for form inputs.
 */
export function Card({ children, className, style, onClick, compact }: CardProps) {
  return (
    <div
      data-card
      onClick={onClick}
      className={cn(
        'bg-[var(--card)] px-4 py-[14px] transition-colors',
        onClick ? 'cursor-pointer' : 'cursor-default',
        !compact && '-mx-7 rounded-none border-y border-[var(--border)] border-x-0',
        compact && 'rounded-[10px] border border-[var(--border)]',
        'md:mx-0 md:rounded-[10px] md:border md:border-[var(--border)]',
        className,
      )}
      style={style}
    >
      {children}
    </div>
  );
}
