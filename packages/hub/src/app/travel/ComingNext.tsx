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
      ? 'border-[var(--sky)]/60 bg-[var(--blue-d)] text-[var(--sky)] hover:opacity-80'
      : action.type === 'contact_phone' || action.type === 'contact_email'
        ? 'border-[var(--accent)]/50 bg-[var(--green-d)] text-[var(--green)] hover:opacity-80'
        : 'border-[var(--border)] bg-[var(--card3)] text-[var(--muted)] hover:text-[var(--text)]';

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
  past: 'border-[var(--border)]/40 bg-[var(--card2)]/40',
  now: 'border-l-[3px] border-l-[var(--sky)] border-t-[var(--border)] border-r-[var(--border)] border-b-[var(--border)] bg-[var(--blue-d)]',
  imminent: 'border-[var(--red)]/70 bg-[var(--red-d)]',
  soon: 'border-[var(--amber)]/50 bg-[var(--amber-d)]',
  future: 'border-[var(--border)] bg-[var(--card2)]',
};

const bucketTimeClasses: Record<TimeBucket, string> = {
  past: 'text-[var(--subtle)] line-through',
  now: 'text-[var(--sky)]',
  imminent: 'text-[var(--red)] font-semibold',
  soon: 'text-[var(--amber)]',
  future: 'text-[var(--muted)]',
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
          className="relative flex items-center gap-2 h-fit w-full rounded-lg border border-dashed border-[var(--border)]/40 bg-[var(--card2)]/30 px-3 py-2 text-sm opacity-55 hover:opacity-80 hover:border-[var(--border)]/60 hover:bg-[var(--card2)]/50 hover:text-inherit cursor-pointer"
        >
          <span className="shrink-0 text-[var(--subtle)]">
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
          <span className="text-xs text-[var(--muted)] truncate flex-1 text-left">{segment.primaryLabel}</span>
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
            <span className="absolute top-1.5 right-1.5 rounded bg-[var(--blue-d)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--sky)]">
              Now
            </span>
          )}
          {isPast && !isActive && (
            <span className="absolute top-1.5 right-1.5 rounded bg-[var(--card3)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--subtle)]">
              Past ↑ collapse
            </span>
          )}
          {timeBucket === 'imminent' && (
            <span className="absolute top-1.5 right-1.5 rounded bg-[var(--red-d)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--red)] animate-pulse">
              Soon!
            </span>
          )}
          <div className="flex items-center gap-1.5">
            <span className={timeBucket === 'past' ? 'text-[var(--subtle)]' : 'text-[var(--muted)]'}>
              <BookingTypeIcon type={segment.bookingType} />
            </span>
            <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--muted)]">
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
            className={`font-medium text-sm leading-tight ${isPast ? 'text-[var(--subtle)] line-through decoration-[var(--subtle)]' : 'text-[var(--text)]'}`}
          >
            {segment.primaryLabel}
          </span>
          {segment.secondaryLabel && (
            <span className={`text-xs leading-tight ${isPast ? 'text-[var(--subtle)]' : 'text-[var(--muted)]'}`}>
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
            <p className="text-xs italic text-[var(--muted)] mt-0.5">No documents attached</p>
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
        <span className="rounded-full bg-[var(--card3)] border border-[var(--border)] px-2 py-0.5 text-[10px] font-medium text-[var(--muted)] whitespace-nowrap">
          {durationBadge}
        </span>
      </div>
    );
  }
  return (
    <div className="flex items-center justify-center py-1 md:py-0 md:px-1" aria-hidden="true">
      <span className={`hidden text-sm md:block ${dim ? 'text-[var(--subtle)]' : 'text-[var(--border)]'}`}>→</span>
      <span className={`text-sm md:hidden ${dim ? 'text-[var(--subtle)]' : 'text-[var(--border)]'}`}>↓</span>
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
    <SectionCard title="Itinerary" className="bg-[var(--card)] border-[var(--border)]">
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
