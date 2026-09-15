export function CashflowPageSkeleton() {
  return (
    <div className="flex flex-col gap-[14px]">
      {[44, 60, 260].map((h, i) => (
        <div
          key={i}
          className="rounded-[10px] border border-[var(--border)] bg-[var(--card)] opacity-60"
          style={{ height: h }}
        />
      ))}
    </div>
  );
}
