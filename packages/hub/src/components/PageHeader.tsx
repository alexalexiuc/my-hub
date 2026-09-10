import Link from 'next/link';

interface Props {
  title: string;
  backHref?: string;
  backLabel?: string;
  actions?: React.ReactNode;
}

export function PageHeader({ title, backHref, backLabel = '← Back', actions }: Props) {
  return (
    <div className="flex items-center justify-between mb-8">
      <div className="flex items-center gap-4">
        {backHref && (
          <Link
            href={backHref}
            className="text-sm text-[var(--muted,#a1a1aa)] hover:text-[var(--text,#e4e4e7)] transition"
          >
            {backLabel}
          </Link>
        )}
        <h1 className="text-3xl font-bold text-[var(--text,#f4f4f5)]">{title}</h1>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
