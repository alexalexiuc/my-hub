import type { ReactNode } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { SpinnerIcon } from './icons';

interface Props {
  label: string;
  icon: ReactNode;
  onClick?: () => void;
  href?: string;
  loading?: boolean;
}

const baseClassName = 'rounded-md bg-zinc-800 p-1.5 text-zinc-300 hover:bg-zinc-700';

export function IconButton({ label, icon, onClick, href, loading = false }: Props) {
  const content = loading ? <SpinnerIcon className="opacity-70" /> : icon;

  if (href) {
    return (
      <Link href={href} className={baseClassName} aria-label={label} title={label}>
        {content}
      </Link>
    );
  }

  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={cn(baseClassName, 'disabled:opacity-50')}
      aria-label={label}
      title={label}
    >
      {content}
    </button>
  );
}
