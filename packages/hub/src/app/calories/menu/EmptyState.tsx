import type { ReactNode } from 'react';

type EmptyStateProps = {
  title: string;
  hint: ReactNode;
  /** Shown under the text, e.g. a "Plan this week" button. */
  action?: ReactNode;
};

/** The Weekly Menu's empty card: no menus at all, or no menu for the week on screen. */
export function EmptyState({ title, hint, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-[var(--border)] p-12 text-center">
      <div>
        <p className="font-semibold text-[var(--text)]">{title}</p>
        <p className="mt-1 text-sm text-[var(--muted)]">{hint}</p>
      </div>
      {action}
    </div>
  );
}
