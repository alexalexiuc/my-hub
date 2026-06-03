import { SectionCard } from '@/components/SectionCard';
import type { TripWithStatus } from '@my-hub/shared/types';
import type { TripOverviewResponse } from './types';

function StatRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-xs text-[var(--muted)]">{label}</span>
      <span className="text-sm font-semibold text-[var(--text)]">{value}</span>
    </div>
  );
}

type TripOverviewCardsProps = {
  activeTrip: TripWithStatus | null;
  overview: TripOverviewResponse | null;
  loadingOverview: boolean;
};

export function TripOverviewCards({ activeTrip, overview, loadingOverview }: TripOverviewCardsProps) {
  return (
    <SectionCard
      title={activeTrip ? `${activeTrip.name} Overview` : 'Overview'}
      className="bg-[var(--card)] border-[var(--border)]"
    >
      {!activeTrip && <p className="text-sm text-[var(--muted)]">Select a trip to view details.</p>}
      {activeTrip && loadingOverview && <p className="text-sm text-[var(--muted)]">Loading…</p>}
      {activeTrip && overview && (
        <div className="divide-y divide-[var(--border)]">
          <StatRow label="Reservations" value={overview.bookings.length} />
          <StatRow label="Checklist" value={overview.checklist.length} />
          <StatRow label="Companions" value={overview.companions.length} />
          <StatRow label="Places" value={overview.places.length} />
          <StatRow label="Documents" value={overview.documents.length} />
        </div>
      )}
    </SectionCard>
  );
}
