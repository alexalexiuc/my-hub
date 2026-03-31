import { SectionCard } from '@/components/SectionCard';
import type { ApiTrip, TripOverviewResponse } from './types';

function StatRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-xs text-zinc-500">{label}</span>
      <span className="text-sm font-semibold text-zinc-100">{value}</span>
    </div>
  );
}

interface TripOverviewCardsProps {
  activeTrip: ApiTrip | null;
  overview: TripOverviewResponse | null;
  loadingOverview: boolean;
}

export function TripOverviewCards({ activeTrip, overview, loadingOverview }: TripOverviewCardsProps) {
  return (
    <SectionCard
      title={activeTrip ? `${activeTrip.name} Overview` : 'Overview'}
      className="bg-sky-950/20 border-sky-800/50"
    >
      {!activeTrip && <p className="text-sm text-zinc-500">Select a trip to view details.</p>}
      {activeTrip && loadingOverview && <p className="text-sm text-zinc-500">Loading details...</p>}
      {activeTrip && overview && (
        <div className="divide-y divide-zinc-800">
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
