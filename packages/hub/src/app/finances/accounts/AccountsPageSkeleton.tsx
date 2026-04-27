export function AccountsPageSkeleton() {
  return (
    <div className="flex flex-col gap-[14px]">
      {[80, 120, 100].map((h, i) => (
        <div
          key={i}
          className="rounded-[10px] border border-[var(--fin-border)] bg-[var(--fin-card)]"
          style={{ height: h, opacity: 0.6 }}
        />
      ))}
    </div>
  );
}
