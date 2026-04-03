import type { ReactNode } from 'react';
import Link from 'next/link';

interface Props {
  label: string;
  icon: ReactNode;
  onClick?: () => void;
  href?: string;
}

const className = 'rounded-md bg-zinc-800 p-1.5 text-zinc-300 hover:bg-zinc-700';

export function IconButton({ label, icon, onClick, href }: Props) {
  if (href) {
    return (
      <Link href={href} className={className} aria-label={label} title={label}>
        {icon}
      </Link>
    );
  }

  return (
    <button onClick={onClick} className={className} aria-label={label} title={label}>
      {icon}
    </button>
  );
}
