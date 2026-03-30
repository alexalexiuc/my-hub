import { SectionCard } from '@/components/SectionCard';
import type { ApiTrip, TripOverviewResponse } from './types';

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2">
      <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="text-2xl font-semibold text-zinc-100">{value}</p>
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
      title={activeTrip ? `${activeTrip.name} Overview` : 'Trip Overview'}
      className="bg-sky-950/20 border-sky-800/50"
    >
      {!activeTrip && <p className="text-sm text-zinc-500">Select a trip to view details.</p>}
      {activeTrip && loadingOverview && <p className="text-sm text-zinc-500">Loading details...</p>}
      {activeTrip && overview && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatTile label="Reservations" value={overview.bookings.length} />
          <StatTile label="Checklist" value={overview.checklist.length} />
          <StatTile label="Companions" value={overview.companions.length} />
          <StatTile label="Places" value={overview.places.length} />
          <StatTile label="Documents" value={overview.documents.length} />
        </div>
      )}
    </SectionCard>
  );
}
