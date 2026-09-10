import { SectionCard } from '@/components/SectionCard';

export function TravelOverviewSkeleton() {
  return (
    <div className="space-y-6 animate-pulse" aria-hidden="true">
      <SectionCard title="Itinerary" className="border-[var(--border)] bg-[var(--card)]">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-2">
          <div className="h-16 rounded-lg border border-zinc-700 bg-zinc-900/70 md:w-[210px] md:flex-none" />
          <div className="h-4 w-4 rounded bg-zinc-800 md:w-6" />
          <div className="h-16 rounded-lg border border-zinc-700 bg-zinc-900/70 md:w-[210px] md:flex-none" />
          <div className="h-4 w-4 rounded bg-zinc-800 md:w-6" />
          <div className="h-16 rounded-lg border border-zinc-700 bg-zinc-900/70 md:w-[210px] md:flex-none" />
        </div>
      </SectionCard>

      <SectionCard title="Map" className="border-[var(--border)] bg-[var(--card)]">
        <div className="h-[320px] w-full rounded-lg border border-zinc-700 bg-zinc-900/70" />
      </SectionCard>

      <SectionCard title="Calendar" className="bg-cyan-950/20 border-cyan-800/50">
        <div className="space-y-2">
          <div className="h-4 w-2/5 rounded bg-zinc-800" />
          <div className="h-40 w-full rounded-lg border border-zinc-700 bg-zinc-900/70" />
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <SectionCard key={index} className="bg-zinc-900/70 border-zinc-800">
            <div className="space-y-2">
              <div className="h-4 w-1/3 rounded bg-zinc-800" />
              <div className="h-24 w-full rounded-lg border border-zinc-700 bg-zinc-900" />
              <div className="h-12 w-full rounded-lg border border-zinc-700 bg-zinc-900" />
            </div>
          </SectionCard>
        ))}
      </div>

      <SectionCard title="Day by day" className="border-[var(--border)] bg-[var(--card)]">
        <div className="space-y-3">
          <div className="h-4 w-1/4 rounded bg-zinc-800" />
          <div className="h-16 w-full rounded-lg border border-zinc-700 bg-zinc-900/70" />
          <div className="h-16 w-full rounded-lg border border-zinc-700 bg-zinc-900/70" />
          <div className="h-16 w-full rounded-lg border border-zinc-700 bg-zinc-900/70" />
        </div>
      </SectionCard>
    </div>
  );
}
