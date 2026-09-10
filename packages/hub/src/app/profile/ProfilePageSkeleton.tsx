import { SectionCard } from '@/components/SectionCard';

function SkeletonRow() {
  return (
    <div className="flex justify-between">
      <div className="h-4 w-20 rounded bg-[var(--card2,#27272a)]" />
      <div className="h-4 w-32 rounded bg-[var(--card2,#27272a)]" />
    </div>
  );
}

function SkeletonCard({ title, children }: { title: string; children: React.ReactNode }) {
  return <SectionCard title={title}>{children}</SectionCard>;
}

export function ProfilePageSkeleton() {
  return (
    <div className="space-y-6 animate-pulse" aria-hidden="true">
      {/* Account */}
      <SkeletonCard title="Account">
        <div className="space-y-3">
          <SkeletonRow />
          <SkeletonRow />
        </div>
      </SkeletonCard>

      {/* Personal information */}
      <SkeletonCard title="Personal information">
        <div className="space-y-3">
          <SkeletonRow />
          <SkeletonRow />
        </div>
      </SkeletonCard>

      {/* Data deletion */}
      <SkeletonCard title="Data deletion">
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-14 w-full rounded-lg border border-[var(--border,#3f3f46)] bg-[var(--card,#18181b)]/70"
            />
          ))}
        </div>
      </SkeletonCard>

      {/* Notifications */}
      <SkeletonCard title="Notifications">
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-12 w-full rounded-lg border border-[var(--border,#3f3f46)] bg-[var(--card,#18181b)]/70"
            />
          ))}
        </div>
      </SkeletonCard>

      {/* Danger zone */}
      <SkeletonCard title="Danger zone">
        <div className="space-y-3">
          <div className="h-4 w-4/5 rounded bg-[var(--card2,#27272a)]" />
          <div className="h-9 w-36 rounded-lg border border-[var(--border,#3f3f46)] bg-[var(--card,#18181b)]/70" />
        </div>
      </SkeletonCard>

      {/* Session */}
      <SkeletonCard title="Session">
        <div className="flex items-center justify-between">
          <div className="h-4 w-48 rounded bg-[var(--card2,#27272a)]" />
          <div className="h-8 w-20 rounded-lg border border-[var(--border,#3f3f46)] bg-[var(--card,#18181b)]/70" />
        </div>
      </SkeletonCard>
    </div>
  );
}
