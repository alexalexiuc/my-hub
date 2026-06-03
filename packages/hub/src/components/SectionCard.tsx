import Link from 'next/link';
import { cn } from '@/lib/utils';

interface Props {
  title?: string;
  titleHref?: string;
  titleHoverClass?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function SectionCard({ title, titleHref, titleHoverClass, action, children, className = '' }: Props) {
  return (
    <section className={cn('rounded-xl border border-zinc-800 bg-zinc-900 p-6 shadow-sm', className)}>
      {(title || action) && (
        <div className="flex items-center justify-between mb-4">
          {title && (
            <h2 className="text-lg font-semibold">
              {titleHref ? (
                <Link href={titleHref} className={`transition-colors ${titleHoverClass ?? 'hover:text-zinc-400'}`}>
                  {title}
                </Link>
              ) : (
                title
              )}
            </h2>
          )}
          {action && <div>{action}</div>}
        </div>
      )}
      {children}
    </section>
  );
}
