import Link from 'next/link';

interface Props {
  title: string;
  backHref?: string;
  backLabel?: string;
  actions?: React.ReactNode;
}

export default function PageHeader({ title, backHref, backLabel = '← Back', actions }: Props) {
  return (
    <div className="flex items-center justify-between mb-8">
      <div className="flex items-center gap-4">
        {backHref && (
          <Link href={backHref} className="text-sm text-gray-500 hover:text-gray-700">
            {backLabel}
          </Link>
        )}
        <h1 className="text-2xl font-bold">{title}</h1>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
