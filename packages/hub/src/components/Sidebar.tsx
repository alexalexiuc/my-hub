'use client';

import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

export type SidebarNavItem = {
  id: string;
  label: string;
  icon: string;
  path: string;
  dividerBefore?: boolean;
  /** Use exact pathname match instead of startsWith — needed for root routes (e.g. /finances) */
  exact?: boolean;
};

export type SidebarProps = {
  items: SidebarNavItem[];
  /** Optional header rendered above the nav items, separated by a border */
  header?: React.ReactNode;
  /** Optional action rendered at the bottom (e.g. a primary CTA button) */
  action?: React.ReactNode;
};

export function Sidebar({ items, header, action }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const isActive = (item: SidebarNavItem) => (item.exact ? pathname === item.path : pathname.startsWith(item.path));

  return (
    <div className="flex w-[200px] shrink-0 flex-col px-2.5 py-4 bg-[var(--card)] border-r border-[var(--border)]">
      {header && <div className="mb-3 border-b border-[var(--border)] px-2 pb-4 pt-1">{header}</div>}

      {items.map(item => {
        const { id, label, icon, path, dividerBefore } = item;
        const active = isActive(item);
        return (
          <div key={id}>
            {dividerBefore && <div className="mx-1 my-1.5 h-px bg-[var(--border)]" />}
            <button
              onClick={() => router.push(path)}
              className={cn(
                'mb-0.5 flex w-full cursor-pointer items-center gap-2.5 rounded-[7px] px-2.5 py-[9px] text-left text-[13px]',
                active
                  ? 'bg-[var(--accent-d)] text-[var(--accent)] font-semibold'
                  : 'bg-transparent text-[var(--muted)]',
              )}
              style={{ border: active ? `1px solid var(--accent)44` : '1px solid transparent' }}
            >
              {icon && <span className="text-[15px] leading-none">{icon}</span>}
              {label}
            </button>
          </div>
        );
      })}

      <div className="flex-1" />

      {action}
    </div>
  );
}
