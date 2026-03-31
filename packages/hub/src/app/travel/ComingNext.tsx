'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { SectionCard } from '@/components/SectionCard';
import { BookingTypeIcon } from '@/components';
import { TicketIcon, DocumentIcon, ClipboardIcon, PinIcon, PhoneIcon } from '@/components/icons';
import type { TripDocument } from '@my-hub/shared/types';
import type { TripBookingExtended } from './types';
import { mapBookingsToSegments, formatSegmentTime } from './coming-next-utils';
import type { Segment, SegmentAction } from './coming-next-utils';

const actionIcons: Record<SegmentAction['type'], () => React.JSX.Element> = {
  boarding_pass: TicketIcon,
  view_booking: DocumentIcon,
  copy_ref: ClipboardIcon,
  navigate: PinIcon,
  call: PhoneIcon,
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
    if (action.type === 'navigate' || action.type === 'call') {
      window.open(action.type === 'call' ? `tel:${action.value}` : action.value, '_blank');
      return;
    }
    // boarding_pass, view_booking
    window.open(action.value, '_blank');
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

function SegmentCard({ segment, isActive }: { segment: Segment; isActive: boolean }) {
  const activeRef = useRef<HTMLDivElement>(null);
  const { text: timeText, isSoon } = formatSegmentTime(segment.datetime);

  useEffect(() => {
    if (isActive && activeRef.current) {
      activeRef.current.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, [isActive]);

  return (
    <div
      ref={isActive ? activeRef : undefined}
      aria-current={isActive ? 'true' : undefined}
      className={`relative flex flex-col gap-1.5 rounded-lg border p-3 text-sm md:w-[210px] md:flex-none ${
        isActive
          ? 'border-l-[3px] border-l-sky-500 border-t-zinc-700 border-r-zinc-700 border-b-zinc-700 bg-sky-950/30'
          : 'border-zinc-700 bg-zinc-900'
      }`}
    >
      {isActive && (
        <span className="absolute top-1.5 right-1.5 rounded bg-sky-900 px-1.5 py-0.5 text-[10px] font-semibold text-sky-400">
          Now
        </span>
      )}
      <div className="text-zinc-400">
        <BookingTypeIcon type={segment.bookingType} />
      </div>
      <span className={`text-xs ${isSoon ? 'text-amber-400' : 'text-zinc-500'}`}>{timeText}</span>
      <span className="font-medium text-sm text-zinc-100 leading-tight">{segment.primaryLabel}</span>
      {segment.secondaryLabel && <span className="text-xs text-zinc-400 leading-tight">{segment.secondaryLabel}</span>}
      {segment.actions.length > 0 ? (
        <div className="flex flex-wrap gap-1 mt-0.5">
          {segment.actions.map((action, i) => (
            <ActionChip key={i} action={action} segmentLabel={segment.primaryLabel} />
          ))}
        </div>
      ) : (
        <p className="text-xs italic text-zinc-500 mt-0.5">No documents attached</p>
      )}
    </div>
  );
}

function Connector() {
  return (
    <div className="flex items-center justify-center py-1 md:py-0 md:px-1" aria-hidden="true">
      <span className="hidden text-zinc-600 text-sm md:block">→</span>
      <span className="text-zinc-600 text-sm md:hidden">↓</span>
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
            <SegmentCard segment={segment} isActive={segment.isActive} />
            {i < segments.length - 1 && <Connector />}
          </div>
        ))}
      </div>
    </SectionCard>
  );
}
