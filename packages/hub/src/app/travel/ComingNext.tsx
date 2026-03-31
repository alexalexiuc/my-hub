'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { SectionCard } from '@/components/SectionCard';
import { BookingTypeIcon } from '@/components';
import { TicketIcon, DocumentIcon, ClipboardIcon, PinIcon } from '@/components/icons';
import type { TripDocument } from '@my-hub/shared/types';
import type { TripBookingExtended } from './types';
import { mapBookingsToSegments, formatSegmentTime } from './coming-next-utils';
import type { Segment, SegmentAction, TimeBucket } from './coming-next-utils';

const actionIcons: Record<SegmentAction['type'], () => React.JSX.Element> = {
  boarding_pass: TicketIcon,
  view_booking: DocumentIcon,
  copy_ref: ClipboardIcon,
  navigate: PinIcon,
};

function ActionChip({ action, segmentLabel }: { action: SegmentAction; segmentLabel: string }) {
  const [copied, setCopied] = useState(false);
  const Icon = actionIcons[action.type];

  async function handleClick() {
    if (action.type === 'copy_ref') {
      if (!navigator.clipboard || !navigator.clipboard.writeText) {
        return;
      }
      try {
        await navigator.clipboard.writeText(action.value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      } catch {
        // Clipboard write failed; do not show "Copied!" state.
      }
      return;
    }
    if (action.type === 'navigate') {
      const newWindow = window.open(action.value, '_blank', 'noopener,noreferrer');
      if (newWindow) {
        newWindow.opener = null;
      }
      return;
    }
    // boarding_pass, view_booking
    const newWindow = window.open(action.value, '_blank', 'noopener,noreferrer');
    if (newWindow) {
      newWindow.opener = null;
    }
  }

  const ariaLabel =
    action.type === 'copy_ref'
      ? `Copy reference ${action.value} for ${segmentLabel}`
      : `${action.label} for ${segmentLabel}`;

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={ariaLabel}
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors ${
        action.type === 'boarding_pass'
          ? 'border-sky-600 bg-sky-900/40 text-sky-300 hover:bg-sky-800/50'
          : 'border-zinc-600 bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
      }`}
    >
      <Icon />
      {copied ? 'Copied!' : action.label}
    </button>
  );
}

const bucketCardClasses: Record<TimeBucket, string> = {
  past: 'border-zinc-700/40 bg-zinc-900/40',
  now: 'border-l-[3px] border-l-sky-500 border-t-zinc-700 border-r-zinc-700 border-b-zinc-700 bg-sky-950/30',
  imminent: 'border-red-500/70 bg-red-950/20',
  soon: 'border-amber-600/50 bg-amber-950/15',
  future: 'border-zinc-700 bg-zinc-900',
};

const bucketTimeClasses: Record<TimeBucket, string> = {
  past: 'text-zinc-500 line-through',
  now: 'text-sky-400',
  imminent: 'text-red-400 font-semibold',
  soon: 'text-amber-400',
  future: 'text-zinc-500',
};

function SegmentCard({ segment }: { segment: Segment }) {
  const [expanded, setExpanded] = useState(false);
  const activeRef = useRef<HTMLElement | null>(null);
  const { text: timeText } = formatSegmentTime(segment.datetime);
  const { timeBucket, isPast, isActive } = segment;

  useEffect(() => {
    if (isActive && activeRef.current) {
      activeRef.current.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, [isActive]);

  // Past cards: collapsed compact chip unless user expands
  if (isPast && !expanded) {
    return (
      <button
        type="button"
        ref={activeRef}
        onClick={() => setExpanded(true)}
        aria-label={`Expand past segment: ${segment.primaryLabel}`}
        title="Click to expand"
        className="relative flex items-center gap-2 rounded-lg border border-dashed border-zinc-700/40 bg-zinc-900/30 px-3 py-2 text-sm opacity-55 transition-all hover:opacity-80 hover:border-zinc-600/60 hover:bg-zinc-900/50 md:w-[210px] md:flex-none cursor-pointer"
      >
        <span className="shrink-0 text-zinc-500">
          <BookingTypeIcon type={segment.bookingType} />
        </span>
        <span className={`text-xs shrink-0 ${bucketTimeClasses.past}`}>{timeText}</span>
        <span className="text-xs text-zinc-400 truncate flex-1 text-left">{segment.primaryLabel}</span>
        <span className="shrink-0 rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500 ml-auto">
          Done
        </span>
      </button>
    );
  }

  return (
    <div
      ref={isActive ? activeRef : undefined}
      aria-current={isActive ? 'true' : undefined}
      role={isPast ? 'button' : undefined}
      tabIndex={isPast ? 0 : undefined}
      onClick={isPast ? () => setExpanded(false) : undefined}
      onKeyDown={isPast ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpanded(false); } } : undefined}
      className={`relative flex flex-col gap-1.5 rounded-lg border p-3 text-sm transition-all md:w-[210px] md:flex-none ${bucketCardClasses[timeBucket]} ${
        isPast ? 'opacity-70 cursor-pointer hover:opacity-90' : 'hover:shadow-md hover:shadow-black/30'
      }`}
    >
      {isActive && (
        <span className="absolute top-1.5 right-1.5 rounded bg-sky-900 px-1.5 py-0.5 text-[10px] font-semibold text-sky-400">
          Now
        </span>
      )}
      {isPast && !isActive && (
        <span className="absolute top-1.5 right-1.5 rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500">
          Past ↑ collapse
        </span>
      )}
      {timeBucket === 'imminent' && (
        <span className="absolute top-1.5 right-1.5 rounded bg-red-900/60 px-1.5 py-0.5 text-[10px] font-semibold text-red-400 animate-pulse">
          Soon!
        </span>
      )}
      <div className={timeBucket === 'past' ? 'text-zinc-600' : 'text-zinc-400'}>
        <BookingTypeIcon type={segment.bookingType} />
      </div>
      <span className={`text-xs ${bucketTimeClasses[timeBucket]}`}>{timeText}</span>
      <span className={`font-medium text-sm leading-tight ${isPast ? 'text-zinc-400 line-through decoration-zinc-600' : 'text-zinc-100'}`}>
        {segment.primaryLabel}
      </span>
      {segment.secondaryLabel && (
        <span className={`text-xs leading-tight ${isPast ? 'text-zinc-600' : 'text-zinc-400'}`}>
          {segment.secondaryLabel}
        </span>
      )}
      {!isPast && (
        <>
          {segment.actions.length > 0 ? (
            <div className="flex flex-wrap gap-1 mt-0.5">
              {segment.actions.map((action, i) => (
                <ActionChip key={i} action={action} segmentLabel={segment.primaryLabel} />
              ))}
            </div>
          ) : (
            <p className="text-xs italic text-zinc-500 mt-0.5">No documents attached</p>
          )}
        </>
      )}
    </div>
  );
}

function Connector({ dim }: { dim?: boolean }) {
  return (
    <div className="flex items-center justify-center py-1 md:py-0 md:px-1" aria-hidden="true">
      <span className={`hidden text-sm md:block ${dim ? 'text-zinc-700' : 'text-zinc-600'}`}>→</span>
      <span className={`text-sm md:hidden ${dim ? 'text-zinc-700' : 'text-zinc-600'}`}>↓</span>
    </div>
  );
}

interface ComingNextProps {
  bookings: TripBookingExtended[];
  documents: TripDocument[];
}

export function ComingNext({ bookings, documents }: ComingNextProps) {
  const segments = useMemo(() => mapBookingsToSegments(bookings, documents), [bookings, documents]);

  if (segments.length === 0) return null;

  return (
    <SectionCard title="Coming Next" className="bg-sky-950/20 border-sky-800/50">
      <div className="flex flex-col gap-0 md:flex-row md:overflow-x-auto md:items-stretch md:gap-0">
        {segments.map((segment, i) => (
          <div key={segment.id} className="contents">
            <SegmentCard segment={segment} />
            {i < segments.length - 1 && <Connector dim={segment.isPast && segments[i + 1]?.isPast} />}
          </div>
        ))}
      </div>
    </SectionCard>
  );
}
