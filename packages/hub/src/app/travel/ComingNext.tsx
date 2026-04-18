'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { SectionCard } from '@/components/SectionCard';
import { BookingTypeIcon, Button } from '@/components';
import { TicketIcon, DocumentIcon, ClipboardIcon, PinIcon, PhoneIcon, MailOutlineIcon } from '@/components/icons';
import type { TripDocument } from '@my-hub/shared/types';
import type { TripBookingExtended } from './types';
import { mapBookingsToSegments } from './coming-next.utils';
import type { Segment, SegmentAction, TimeBucket } from './coming-next.utils';
import { TravelTimeDisplay } from './TravelTimeDisplay';

const actionIcons: Record<SegmentAction['type'], () => React.JSX.Element> = {
  boarding_pass: TicketIcon,
  view_booking: DocumentIcon,
  copy_ref: ClipboardIcon,
  navigate: PinIcon,
  contact_phone: PhoneIcon,
  contact_email: MailOutlineIcon,
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
    if (action.type === 'contact_phone' || action.type === 'contact_email') {
      window.location.href = action.value;
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
  const chipTitle = action.type === 'copy_ref' ? `${action.label}: ${action.value}` : action.value || action.label;

  const chipColorClass =
    action.type === 'boarding_pass'
      ? 'border-sky-600 bg-sky-900/40 text-sky-300 hover:bg-sky-800/50 hover:text-sky-300'
      : action.type === 'contact_phone' || action.type === 'contact_email'
        ? 'border-emerald-700 bg-emerald-950/40 text-emerald-300 hover:bg-emerald-900/50 hover:text-emerald-300'
        : 'border-zinc-600 bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-300';

  return (
    <Button
      type="button"
      variant="ghost"
      size="xs"
      onClick={handleClick}
      aria-label={ariaLabel}
      title={chipTitle}
      className={`inline-flex min-w-0 max-w-full items-center gap-1 rounded-full border py-0.5 ${chipColorClass}`}
    >
      <Icon />
      <span className="max-w-[8rem] truncate sm:max-w-[12rem]">{copied ? 'Copied!' : action.label}</span>
    </Button>
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
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { timeBucket, isPast, isActive } = segment;

  useEffect(() => {
    if (isActive) {
      containerRef.current?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, [isActive]);

  const showCollapsed = isPast && !expanded;

  // Stable outer wrapper — keeps a consistent footprint in the flex layout across
  // both collapsed and expanded states, preventing the layout-jump on transition.
  return (
    <div ref={isActive ? containerRef : undefined} className="flex items-center md:w-[210px] md:flex-none">
      {showCollapsed ? (
        <Button
          type="button"
          variant="ghost"
          onClick={() => setExpanded(true)}
          aria-label={`Expand past segment: ${segment.primaryLabel}`}
          title="Click to expand"
          className="relative flex items-center gap-2 h-fit w-full rounded-lg border border-dashed border-zinc-700/40 bg-zinc-900/30 px-3 py-2 text-sm opacity-55 hover:opacity-80 hover:border-zinc-600/60 hover:bg-zinc-900/50 hover:text-inherit cursor-pointer"
        >
          <span className="shrink-0 text-zinc-500">
            <BookingTypeIcon type={segment.bookingType} />
          </span>
          <TravelTimeDisplay
            datetime={segment.datetime}
            timezone={segment.timezone}
            size="xs"
            showTimezoneOffset
            className="shrink-0"
            timeClassName={bucketTimeClasses.past}
          />
          <span className="text-xs text-zinc-400 truncate flex-1 text-left">{segment.primaryLabel}</span>
        </Button>
      ) : (
        <div
          aria-current={isActive ? 'true' : undefined}
          role={isPast ? 'button' : undefined}
          tabIndex={isPast ? 0 : undefined}
          onClick={isPast ? () => setExpanded(false) : undefined}
          onKeyDown={
            isPast
              ? e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setExpanded(false);
                  }
                }
              : undefined
          }
          className={`relative flex flex-col gap-1.5 rounded-lg border p-3 text-sm transition-all w-full h-full ${bucketCardClasses[timeBucket]} ${
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
          <div className="flex items-center gap-1.5">
            <span className={timeBucket === 'past' ? 'text-zinc-600' : 'text-zinc-400'}>
              <BookingTypeIcon type={segment.bookingType} />
            </span>
            <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
              {segment.endpointLabel}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <TravelTimeDisplay
              datetime={segment.datetime}
              timezone={segment.timezone}
              size="xs"
              showTimezoneOffset
              timeClassName={bucketTimeClasses[timeBucket]}
            />
          </div>
          <span
            className={`font-medium text-sm leading-tight ${isPast ? 'text-zinc-400 line-through decoration-zinc-600' : 'text-zinc-100'}`}
          >
            {segment.primaryLabel}
          </span>
          {segment.secondaryLabel && (
            <span className={`text-xs leading-tight ${isPast ? 'text-zinc-600' : 'text-zinc-400'}`}>
              {segment.secondaryLabel}
            </span>
          )}
          {!isPast && segment.actions.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-0.5">
              {segment.actions.map((action, i) => (
                <ActionChip key={i} action={action} segmentLabel={segment.primaryLabel} />
              ))}
            </div>
          )}
          {!isPast && !segment.isEndSegment && segment.actions.length === 0 && (
            <p className="text-xs italic text-zinc-500 mt-0.5">No documents attached</p>
          )}
        </div>
      )}
    </div>
  );
}

function Connector({ dim, durationBadge }: { dim?: boolean; durationBadge?: string | null }) {
  if (durationBadge) {
    return (
      <div className="flex items-center justify-center py-1 md:py-0 md:px-1" aria-hidden="true">
        <span className="rounded-full bg-zinc-800 border border-zinc-700 px-2 py-0.5 text-[10px] font-medium text-zinc-400 whitespace-nowrap">
          {durationBadge}
        </span>
      </div>
    );
  }
  return (
    <div className="flex items-center justify-center py-1 md:py-0 md:px-1" aria-hidden="true">
      <span className={`hidden text-sm md:block ${dim ? 'text-zinc-700' : 'text-zinc-600'}`}>→</span>
      <span className={`text-sm md:hidden ${dim ? 'text-zinc-700' : 'text-zinc-600'}`}>↓</span>
    </div>
  );
}

type ComingNextProps = {
  bookings: TripBookingExtended[];
  documents: TripDocument[];
};

export function ComingNext({ bookings, documents }: ComingNextProps) {
  const segments = useMemo(() => mapBookingsToSegments(bookings, documents), [bookings, documents]);

  if (segments.length === 0) return null;

  return (
    <SectionCard title="Itinerary" className="bg-sky-950/20 border-sky-800/50">
      <div className="min-w-0 flex flex-col gap-0 md:flex-row md:items-stretch md:gap-0 md:overflow-x-auto pb-2">
        {segments.map((segment, i) => {
          const next = segments[i + 1];
          // Duration badge shown on connector between same-booking start→end pair
          const connectorDuration =
            next?.bookingId === segment.bookingId && next?.isEndSegment ? next.durationBadge : null;
          return (
            <div key={segment.segmentId} className="contents">
              <SegmentCard segment={segment} />
              {i < segments.length - 1 && (
                <Connector dim={segment.isPast && next?.isPast} durationBadge={connectorDuration} />
              )}
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}
