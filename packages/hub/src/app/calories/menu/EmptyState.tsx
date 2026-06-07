export function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-[var(--border)] p-12 text-center">
      <span className="text-4xl">🗓️</span>
      <div>
        <p className="font-semibold text-[var(--text)]">No weekly menus yet</p>
        <p className="mt-1 text-sm text-[var(--subtle)]">
          Ask Claude: <span className="italic">"Plan my meals for next week"</span> and it will create a menu here.
        </p>
      </div>
    </div>
  );
}
