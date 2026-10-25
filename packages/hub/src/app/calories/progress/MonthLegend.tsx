import { DayTargetStatuses } from '@my-hub/shared/constants';
import { MenuStatusIcon } from '../calendar/MenuStatusIcon';
import { dayStatusColor } from '../calories.utils';

const SWATCHES = [
  { label: 'On target', color: dayStatusColor(DayTargetStatuses.OnTarget) },
  { label: 'Under minimum', color: dayStatusColor(DayTargetStatuses.Under) },
  { label: 'Over target', color: dayStatusColor(DayTargetStatuses.Over) },
];

/** What the month grid's colours and menu icons mean — new users shouldn't have to guess. */
export function MonthLegend() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-[var(--muted)]">
      {SWATCHES.map(s => (
        <span key={s.label} className="flex items-center gap-1.5">
          <span
            className="size-2.5 rounded-[3px] border"
            style={{ borderColor: s.color, backgroundColor: `color-mix(in srgb, ${s.color} 20%, transparent)` }}
          />
          {s.label}
        </span>
      ))}
      <span className="flex items-center gap-1.5">
        <span className="size-2.5 rounded-[3px] border border-dashed border-[var(--accent)]" />
        Today, in progress
      </span>
      <span className="flex items-center gap-1.5">
        <MenuStatusIcon status="logged" className="size-3" />
        Menu logged
      </span>
      <span className="flex items-center gap-1.5">
        <MenuStatusIcon status="missed" className="size-3" />
        Menu missed
      </span>
    </div>
  );
}
