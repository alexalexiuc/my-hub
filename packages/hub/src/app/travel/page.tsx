'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import PageHeader from '@/components/page-header';
import SectionCard from '@/components/section-card';
import BookingsCalendar from '@/components/travel/bookings-calendar';
import type {
  Trip,
  TripBooking,
  TripChecklistItem,
  TripCompanion,
  TripDocument,
  TripPlace,
  TripStatus,
} from '@my-hub/shared/types';

interface TripOverviewResponse {
  trip: Trip;
  bookings: TripBooking[];
  places: TripPlace[];
  checklist: TripChecklistItem[];
  companions: TripCompanion[];
  documents: TripDocument[];
}

interface UploadConfig {
  max_mb: number;
  allowed_mime: string[];
}

interface BookingRange {
  tripId: number;
  fromAt: string | null;
  toAt: string | null;
}

interface ApiTrip extends Trip {
  owner_user_id: string;
  owner_name: string | null;
  owner_email: string;
  access_role: 'owner' | 'viewer';
  can_edit: boolean;
  permission: 'view';
}

interface TripShareView {
  id: number;
  user_id: string;
  permission: 'view';
  name: string | null;
  email: string;
}

interface TripShareSuggestion {
  user_id: string;
  name: string | null;
  email: string;
}

const tripColorPalette = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#EC4899', '#84CC16'];

function randomTripColor(): string {
  return tripColorPalette[Math.floor(Math.random() * tripColorPalette.length)] ?? '#3B82F6';
}

const bookingTypeOptions = [
  'flight',
  'accommodation',
  'rental_car',
  'train',
  'bus',
  'ferry',
  'taxi',
  'restaurant',
  'tour',
  'activity',
  'ticket',
  'other',
] as const;

const statusOptions: TripStatus[] = ['planned', 'active', 'completed', 'cancelled'];

export default function TravelPage() {
  const [trips, setTrips] = useState<ApiTrip[]>([]);
  const [activeTripId, setActiveTripId] = useState<number | null>(null);
  const [overview, setOverview] = useState<TripOverviewResponse | null>(null);
  const [loadingTrips, setLoadingTrips] = useState(true);
  const [loadingOverview, setLoadingOverview] = useState(false);

  const [newTripName, setNewTripName] = useState('');
  const [newTripColor, setNewTripColor] = useState(() => randomTripColor());
  const [newTripDestination, setNewTripDestination] = useState('');
  const [newTripStartAt, setNewTripStartAt] = useState('');
  const [newTripEndAt, setNewTripEndAt] = useState('');
  const [editingTripId, setEditingTripId] = useState<number | null>(null);
  const [editTripName, setEditTripName] = useState('');
  const [editTripDestination, setEditTripDestination] = useState('');
  const [editTripColor, setEditTripColor] = useState('#3B82F6');
  const [editTripStartAt, setEditTripStartAt] = useState('');
  const [editTripEndAt, setEditTripEndAt] = useState('');
  const [newChecklistItem, setNewChecklistItem] = useState('');
  const [newCompanionName, setNewCompanionName] = useState('');
  const [newCompanionEmail, setNewCompanionEmail] = useState('');
  const [newCompanionPhone, setNewCompanionPhone] = useState('');
  const [editingCompanionId, setEditingCompanionId] = useState<number | null>(null);
  const [editCompanionName, setEditCompanionName] = useState('');
  const [editCompanionEmail, setEditCompanionEmail] = useState('');
  const [editCompanionPhone, setEditCompanionPhone] = useState('');

  const [newBookingTitle, setNewBookingTitle] = useState('');
  const [newBookingType, setNewBookingType] = useState<(typeof bookingTypeOptions)[number]>('other');
  const [newBookingProvider, setNewBookingProvider] = useState('');
  const [newBookingStartAt, setNewBookingStartAt] = useState('');
  const [newBookingEndAt, setNewBookingEndAt] = useState('');
  const [editingBookingId, setEditingBookingId] = useState<number | null>(null);
  const [editBookingTitle, setEditBookingTitle] = useState('');
  const [editBookingType, setEditBookingType] = useState<(typeof bookingTypeOptions)[number]>('other');
  const [editBookingProvider, setEditBookingProvider] = useState('');
  const [editBookingStartAt, setEditBookingStartAt] = useState('');
  const [editBookingEndAt, setEditBookingEndAt] = useState('');

  const [editingChecklistId, setEditingChecklistId] = useState<number | null>(null);
  const [editChecklistTitle, setEditChecklistTitle] = useState('');

  const [documentTitle, setDocumentTitle] = useState('');
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [documentBookingId, setDocumentBookingId] = useState<number | null>(null);
  const [tripBookingRanges, setTripBookingRanges] = useState<Record<number, BookingRange>>({});
  const [tripShares, setTripShares] = useState<TripShareView[]>([]);
  const [shareSuggestions, setShareSuggestions] = useState<TripShareSuggestion[]>([]);
  const [shareEmail, setShareEmail] = useState('');
  const [uploadConfig, setUploadConfig] = useState<UploadConfig>({
    max_mb: 15,
    allowed_mime: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'],
  });

  const activeTrip = useMemo(() => trips.find((trip) => trip.id === activeTripId) ?? null, [trips, activeTripId]);
  const canEditActiveTrip = activeTrip?.can_edit ?? false;
  const documentsByBookingId = useMemo(() => {
    const groups = new Map<number, TripDocument[]>();
    if (!overview) return groups;
    for (const document of overview.documents) {
      if (!document.bookingId) continue;
      const current = groups.get(document.bookingId) ?? [];
      current.push(document);
      groups.set(document.bookingId, current);
    }
    return groups;
  }, [overview]);

  const loadTrips = useCallback(async () => {
    setLoadingTrips(true);
    try {
      const res = await fetch('/api/travel/trips');
      if (!res.ok) throw new Error(`Failed to load trips (${res.status})`);
      const data = (await res.json()) as { trips: ApiTrip[]; booking_ranges?: BookingRange[] };
      setTrips(data.trips);
      setTripBookingRanges(
        Object.fromEntries((data.booking_ranges ?? []).map((range) => [range.tripId, range])) as Record<
          number,
          BookingRange
        >,
      );

      if (data.trips.length === 0) {
        setActiveTripId(null);
        setOverview(null);
      } else if (!activeTripId || !data.trips.some((trip) => trip.id === activeTripId)) {
        setActiveTripId(data.trips[0]!.id);
      }
    } finally {
      setLoadingTrips(false);
    }
  }, [activeTripId]);

  const loadOverview = useCallback(
    async (tripId: number) => {
      setLoadingOverview(true);
      try {
        const res = await fetch(`/api/travel/trips/${tripId}/overview`);
        if (!res.ok) throw new Error(`Failed to load trip overview (${res.status})`);
        const data = (await res.json()) as TripOverviewResponse;
        setOverview(data);
        if (data.documents.every((doc) => doc.bookingId !== documentBookingId)) {
          setDocumentBookingId(null);
        }
      } finally {
        setLoadingOverview(false);
      }
    },
    [documentBookingId],
  );

  const loadShares = useCallback(async (tripId: number) => {
    const res = await fetch(`/api/travel/trips/${tripId}/shares`);
    if (!res.ok) {
      setTripShares([]);
      setShareSuggestions([]);
      return;
    }

    const data = (await res.json()) as { shares: TripShareView[]; suggestions: TripShareSuggestion[] };
    setTripShares(data.shares);
    setShareSuggestions(data.suggestions);
  }, []);

  useEffect(() => {
    loadTrips();
  }, [loadTrips]);

  useEffect(() => {
    if (!activeTripId) return;
    loadOverview(activeTripId);
  }, [activeTripId, loadOverview]);

  useEffect(() => {
    if (!activeTripId || !canEditActiveTrip) {
      setTripShares([]);
      setShareSuggestions([]);
      return;
    }

    loadShares(activeTripId);
  }, [activeTripId, canEditActiveTrip, loadShares]);

  useEffect(() => {
    async function loadUploadConfig() {
      const res = await fetch('/api/travel/documents/config');
      if (!res.ok) return;
      const data = (await res.json()) as UploadConfig;
      setUploadConfig(data);
    }

    loadUploadConfig();
  }, []);

  async function createTrip() {
    if (!newTripName.trim()) return;

    const status = statusOptions[0];
    const res = await fetch('/api/travel/trips', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newTripName.trim(),
        color: newTripColor,
        destination: newTripDestination.trim() || null,
        start_at: newTripStartAt ? `${newTripStartAt}T00:00:00.000Z` : undefined,
        end_at: newTripEndAt ? `${newTripEndAt}T00:00:00.000Z` : undefined,
        status,
      }),
    });

    if (!res.ok) return;

    setNewTripName('');
    setNewTripColor(randomTripColor());
    setNewTripDestination('');
    setNewTripStartAt('');
    setNewTripEndAt('');
    await loadTrips();
  }

  function startEditTrip(trip: Trip) {
    setEditingTripId(trip.id);
    setEditTripName(trip.name);
    setEditTripDestination(trip.destination ?? '');
    setEditTripColor(trip.color);
    setEditTripStartAt(toDateInputValue(trip.startAt));
    setEditTripEndAt(toDateInputValue(trip.endAt));
  }

  function cancelEditTrip() {
    setEditingTripId(null);
    setEditTripName('');
    setEditTripDestination('');
    setEditTripColor('#3B82F6');
    setEditTripStartAt('');
    setEditTripEndAt('');
  }

  async function saveTripEdits(tripId: number) {
    const trimmedName = editTripName.trim();
    if (!trimmedName) return;

    await fetch(`/api/travel/trips/${tripId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: trimmedName,
        destination: editTripDestination.trim() || null,
        color: editTripColor,
        start_at: editTripStartAt ? `${editTripStartAt}T00:00:00.000Z` : null,
        end_at: editTripEndAt ? `${editTripEndAt}T00:00:00.000Z` : null,
      }),
    });

    cancelEditTrip();
    await loadTrips();
    if (activeTripId === tripId) {
      await loadOverview(tripId);
    }
  }

  async function removeTrip(tripId: number) {
    await fetch(`/api/travel/trips/${tripId}`, { method: 'DELETE' });
    if (activeTripId === tripId) {
      setActiveTripId(null);
      setOverview(null);
    }
    await loadTrips();
  }

  async function addChecklistItem() {
    if (!activeTripId || !canEditActiveTrip || !newChecklistItem.trim()) return;

    await fetch('/api/travel/checklist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trip_id: activeTripId, title: newChecklistItem.trim() }),
    });

    setNewChecklistItem('');
    await loadOverview(activeTripId);
  }

  async function toggleChecklist(item: TripChecklistItem) {
    if (!activeTripId || !canEditActiveTrip) return;

    await fetch(`/api/travel/checklist/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ done: !item.done }),
    });

    await loadOverview(activeTripId);
  }

  async function addCompanion() {
    if (!activeTripId || !canEditActiveTrip || !newCompanionName.trim()) return;

    await fetch('/api/travel/companions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        trip_id: activeTripId,
        name: newCompanionName.trim(),
        email: newCompanionEmail.trim() || undefined,
        phone: newCompanionPhone.trim() || undefined,
      }),
    });

    setNewCompanionName('');
    setNewCompanionEmail('');
    setNewCompanionPhone('');
    await loadOverview(activeTripId);
  }

  async function removeCompanion(companionId: number) {
    if (!activeTripId || !canEditActiveTrip) return;
    await fetch(`/api/travel/companions/${companionId}`, { method: 'DELETE' });
    if (editingCompanionId === companionId) {
      cancelEditCompanion();
    }
    await loadOverview(activeTripId);
  }

  function startEditCompanion(companion: TripCompanion) {
    setEditingCompanionId(companion.id);
    setEditCompanionName(companion.name);
    setEditCompanionEmail(companion.email ?? '');
    setEditCompanionPhone(companion.phone ?? '');
  }

  function cancelEditCompanion() {
    setEditingCompanionId(null);
    setEditCompanionName('');
    setEditCompanionEmail('');
    setEditCompanionPhone('');
  }

  async function saveCompanionEdits(companionId: number) {
    if (!activeTripId || !canEditActiveTrip) return;

    const name = editCompanionName.trim();
    if (!name) return;

    await fetch(`/api/travel/companions/${companionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        email: editCompanionEmail.trim() || null,
        phone: editCompanionPhone.trim() || null,
      }),
    });

    cancelEditCompanion();
    await loadOverview(activeTripId);
  }

  async function addBooking() {
    if (!activeTripId || !canEditActiveTrip || !newBookingTitle.trim()) return;

    await fetch('/api/travel/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        trip_id: activeTripId,
        title: newBookingTitle.trim(),
        booking_type: newBookingType,
        provider: newBookingProvider.trim() || undefined,
        start_at: newBookingStartAt ? new Date(newBookingStartAt).toISOString() : undefined,
        end_at: newBookingEndAt ? new Date(newBookingEndAt).toISOString() : undefined,
      }),
    });

    setNewBookingTitle('');
    setNewBookingProvider('');
    setNewBookingStartAt('');
    setNewBookingEndAt('');
    await loadOverview(activeTripId);
  }

  async function removeBooking(bookingId: number) {
    if (!activeTripId || !canEditActiveTrip) return;
    await fetch(`/api/travel/bookings/${bookingId}`, { method: 'DELETE' });
    await loadOverview(activeTripId);
  }

  function toDateTimeLocalValue(value: Date | string | null | undefined): string {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const timezoneOffsetMs = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - timezoneOffsetMs).toISOString().slice(0, 16);
  }

  function formatShortDate(value: string | null | undefined): string | null {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleDateString();
  }

  function toDateInputValue(value: Date | string | null | undefined): string {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    // Adjust for timezone offset to get the correct local date
    const timezoneOffsetMs = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - timezoneOffsetMs).toISOString().slice(0, 10);
  }

  function startEditBooking(booking: TripBooking) {
    setEditingBookingId(booking.id);
    setEditBookingTitle(booking.title);
    setEditBookingType(booking.bookingType as (typeof bookingTypeOptions)[number]);
    setEditBookingProvider(booking.provider ?? '');
    setEditBookingStartAt(toDateTimeLocalValue(booking.startAt));
    setEditBookingEndAt(toDateTimeLocalValue(booking.endAt));
  }

  function cancelEditBooking() {
    setEditingBookingId(null);
    setEditBookingTitle('');
    setEditBookingType('other');
    setEditBookingProvider('');
    setEditBookingStartAt('');
    setEditBookingEndAt('');
  }

  async function saveBookingEdits(bookingId: number) {
    if (!activeTripId || !canEditActiveTrip || !editBookingTitle.trim()) return;

    await fetch(`/api/travel/bookings/${bookingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: editBookingTitle.trim(),
        booking_type: editBookingType,
        provider: editBookingProvider.trim() || null,
        start_at: editBookingStartAt ? new Date(editBookingStartAt).toISOString() : null,
        end_at: editBookingEndAt ? new Date(editBookingEndAt).toISOString() : null,
      }),
    });

    cancelEditBooking();
    await loadOverview(activeTripId);
  }

  async function removeChecklistItem(itemId: number) {
    if (!activeTripId || !canEditActiveTrip) return;
    await fetch(`/api/travel/checklist/${itemId}`, { method: 'DELETE' });
    await loadOverview(activeTripId);
  }

  function startEditChecklistItem(item: TripChecklistItem) {
    setEditingChecklistId(item.id);
    setEditChecklistTitle(item.title);
  }

  function cancelEditChecklistItem() {
    setEditingChecklistId(null);
    setEditChecklistTitle('');
  }

  async function saveChecklistEdits(itemId: number) {
    if (!activeTripId || !canEditActiveTrip || !editChecklistTitle.trim()) return;

    await fetch(`/api/travel/checklist/${itemId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: editChecklistTitle.trim() }),
    });

    cancelEditChecklistItem();
    await loadOverview(activeTripId);
  }

  async function uploadDocument() {
    if (!activeTripId || !documentFile || !canEditActiveTrip) return;

    const maxBytes = uploadConfig.max_mb * 1024 * 1024;
    if (documentFile.size > maxBytes) {
      alert(`File is too large. Max allowed is ${uploadConfig.max_mb} MB.`);
      return;
    }

    if (!uploadConfig.allowed_mime.includes(documentFile.type)) {
      alert(`File type ${documentFile.type} is not allowed.`);
      return;
    }

    const form = new FormData();
    form.append('trip_id', String(activeTripId));
    if (documentBookingId) {
      form.append('booking_id', String(documentBookingId));
    }
    form.append('title', documentTitle.trim() || documentFile.name);
    form.append('type', 'other');
    form.append('file', documentFile);

    const res = await fetch('/api/travel/documents/upload', {
      method: 'POST',
      body: form,
    });

    if (!res.ok) return;

    setDocumentTitle('');
    setDocumentFile(null);
    setDocumentBookingId(null);
    await loadOverview(activeTripId);
  }

  async function removeDocument(documentId: number) {
    if (!activeTripId || !canEditActiveTrip) return;
    await fetch(`/api/travel/documents/${documentId}`, { method: 'DELETE' });
    await loadOverview(activeTripId);
  }

  async function shareTripByEmail() {
    if (!activeTripId || !canEditActiveTrip || !shareEmail.trim()) return;

    const res = await fetch(`/api/travel/trips/${activeTripId}/shares`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: shareEmail.trim() }),
    });

    if (!res.ok) return;

    setShareEmail('');
    await loadShares(activeTripId);
  }

  async function shareTripWithUser(userId: string) {
    if (!activeTripId || !canEditActiveTrip) return;

    const res = await fetch(`/api/travel/trips/${activeTripId}/shares`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId }),
    });

    if (!res.ok) return;
    await loadShares(activeTripId);
  }

  async function revokeTripShare(shareId: number) {
    if (!activeTripId || !canEditActiveTrip) return;

    const res = await fetch(`/api/travel/trips/${activeTripId}/shares/${shareId}`, {
      method: 'DELETE',
    });

    if (!res.ok) return;
    await loadShares(activeTripId);
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-8 space-y-6">
      <PageHeader title="My Travels" backHref="/" backLabel="← Home" />

      <section className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-6">
        <SectionCard title="Trips" className="bg-emerald-950/20 border-emerald-800/50">
          <div className="space-y-3">
            <div className="space-y-2">
              <input
                value={newTripName}
                onChange={(e) => setNewTripName(e.target.value)}
                placeholder="Trip name"
                className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
              />
              <input
                value={newTripDestination}
                onChange={(e) => setNewTripDestination(e.target.value)}
                placeholder="Destination"
                className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  value={newTripStartAt}
                  onChange={(e) => setNewTripStartAt(e.target.value)}
                  className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
                />
                <input
                  type="date"
                  value={newTripEndAt}
                  onChange={(e) => setNewTripEndAt(e.target.value)}
                  className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
                />
              </div>
              <div className="flex items-center gap-2 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm">
                <label htmlFor="trip-color" className="text-zinc-300">
                  Color
                </label>
                <input
                  id="trip-color"
                  type="color"
                  value={newTripColor}
                  onChange={(e) => setNewTripColor(e.target.value)}
                  className="h-8 w-8 cursor-pointer rounded-full border-none bg-transparent p-0"
                />
              </div>
              <button
                onClick={createTrip}
                className="w-full rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500"
              >
                Create Trip
              </button>
            </div>

            <div className="max-h-[420px] overflow-auto space-y-2">
              {loadingTrips && <p className="text-sm text-zinc-500">Loading trips...</p>}
              {!loadingTrips && trips.length === 0 && <p className="text-sm text-zinc-500">No trips yet.</p>}
              {trips.map((trip) => (
                <div
                  key={trip.id}
                  className={`w-full rounded-lg border px-3 py-2 text-left transition ${
                    activeTripId === trip.id ? 'bg-emerald-500/10' : 'bg-zinc-900 hover:border-zinc-500'
                  }`}
                  style={{ borderColor: activeTripId === trip.id ? trip.color : undefined, borderLeftWidth: '4px' }}
                >
                  {editingTripId === trip.id ? (
                    <div className="space-y-2">
                      <input
                        value={editTripName}
                        onChange={(e) => setEditTripName(e.target.value)}
                        placeholder="Trip name"
                        className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm"
                      />
                      <input
                        value={editTripDestination}
                        onChange={(e) => setEditTripDestination(e.target.value)}
                        placeholder="Destination"
                        className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="date"
                          value={editTripStartAt}
                          onChange={(e) => setEditTripStartAt(e.target.value)}
                          className="rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm"
                        />
                        <input
                          type="date"
                          value={editTripEndAt}
                          onChange={(e) => setEditTripEndAt(e.target.value)}
                          className="rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm"
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <input
                          type="color"
                          value={editTripColor}
                          onChange={(e) => setEditTripColor(e.target.value)}
                          className="h-8 w-8 cursor-pointer rounded-full border-none bg-transparent p-0"
                          aria-label="Trip color"
                          title="Trip color"
                        />
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => saveTripEdits(trip.id)}
                            className="rounded-md bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-500"
                          >
                            Save
                          </button>
                          <button
                            onClick={cancelEditTrip}
                            className="rounded-md bg-zinc-800 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-700"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <button onClick={() => setActiveTripId(trip.id)} className="min-w-0 flex-1 text-left">
                          <p className="font-medium flex items-center gap-2">
                            <span
                              className="inline-block h-2.5 w-2.5 rounded-full"
                              style={{ backgroundColor: trip.color }}
                            />
                            {trip.name}
                          </p>
                          <p className="text-xs text-zinc-400">{trip.destination ?? 'No destination set'}</p>
                          <p className="text-xs text-zinc-500 mt-0.5">
                            Owner: {trip.access_role === 'owner' ? 'You' : (trip.owner_name ?? trip.owner_email)}
                          </p>
                        </button>
                        {trip.can_edit && (
                          <div className="flex items-center gap-1">
                            <IconButton label="Edit trip" onClick={() => startEditTrip(trip)} icon={<IconEdit />} />
                            <IconButton label="Remove trip" onClick={() => removeTrip(trip.id)} icon={<IconTrash />} />
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-zinc-500 mt-1">
                        {(() => {
                          const from = formatShortDate(
                            tripBookingRanges[trip.id]?.fromAt ?? (trip.startAt as string | null),
                          );
                          const to = formatShortDate(tripBookingRanges[trip.id]?.toAt ?? (trip.endAt as string | null));
                          if (!from && !to) return 'Reservation dates not set';
                          if (from && to && from !== to) return `${from} -> ${to}`;
                          return from ?? to ?? 'Reservation dates not set';
                        })()}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </SectionCard>

        <div className="space-y-6">
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

          <SectionCard title="Calendar" className="bg-cyan-950/20 border-cyan-800/50">
            {overview ? (
              <BookingsCalendar bookings={overview.bookings} tripColor={overview.trip.color} />
            ) : (
              <p className="text-sm text-zinc-500">Select a trip to view booking dates on the calendar.</p>
            )}
          </SectionCard>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SectionCard title="Reservations" className="bg-indigo-950/20 border-indigo-800/50">
              <div className="space-y-2 mb-3">
                <input
                  value={newBookingTitle}
                  onChange={(e) => setNewBookingTitle(e.target.value)}
                  placeholder="Reservation title"
                  className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
                />
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={newBookingType}
                    onChange={(e) => setNewBookingType(e.target.value as (typeof bookingTypeOptions)[number])}
                    className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
                  >
                    {bookingTypeOptions.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                  <input
                    value={newBookingProvider}
                    onChange={(e) => setNewBookingProvider(e.target.value)}
                    placeholder="Provider"
                    className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
                  />
                </div>
                <input
                  type="datetime-local"
                  value={newBookingStartAt}
                  onChange={(e) => setNewBookingStartAt(e.target.value)}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
                />
                <input
                  type="datetime-local"
                  value={newBookingEndAt}
                  onChange={(e) => setNewBookingEndAt(e.target.value)}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
                />
                <button
                  onClick={addBooking}
                  disabled={!activeTripId || !canEditActiveTrip}
                  className="w-full rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
                >
                  Add Reservation
                </button>
              </div>

              <div className="space-y-2 max-h-64 overflow-auto">
                {overview?.bookings.map((booking) => (
                  <div key={booking.id} className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm">
                    {editingBookingId === booking.id ? (
                      <div className="space-y-2">
                        <input
                          value={editBookingTitle}
                          onChange={(e) => setEditBookingTitle(e.target.value)}
                          placeholder="Reservation title"
                          className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <select
                            value={editBookingType}
                            onChange={(e) => setEditBookingType(e.target.value as (typeof bookingTypeOptions)[number])}
                            className="rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm"
                          >
                            {bookingTypeOptions.map((type) => (
                              <option key={type} value={type}>
                                {type}
                              </option>
                            ))}
                          </select>
                          <input
                            value={editBookingProvider}
                            onChange={(e) => setEditBookingProvider(e.target.value)}
                            placeholder="Provider"
                            className="rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="datetime-local"
                            value={editBookingStartAt}
                            onChange={(e) => setEditBookingStartAt(e.target.value)}
                            className="rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm"
                          />
                          <input
                            type="datetime-local"
                            value={editBookingEndAt}
                            onChange={(e) => setEditBookingEndAt(e.target.value)}
                            className="rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm"
                          />
                        </div>
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => saveBookingEdits(booking.id)}
                            className="rounded-md bg-indigo-600 px-2 py-1 text-xs font-medium text-white hover:bg-indigo-500"
                          >
                            Save
                          </button>
                          <button
                            onClick={cancelEditBooking}
                            className="rounded-md bg-zinc-800 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-700"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-medium">{booking.title}</p>
                          <div className="flex items-center gap-2">
                            <p className="text-xs text-zinc-400">
                              {booking.bookingType}
                              {booking.provider ? ` · ${booking.provider}` : ''}
                              {booking.startAt ? ` · ${new Date(booking.startAt).toLocaleString()}` : ''}
                              {booking.endAt ? ` → ${new Date(booking.endAt).toLocaleString()}` : ''}
                            </p>
                            {(documentsByBookingId.get(booking.id)?.length ?? 0) > 0 && (
                              <div
                                className="relative group"
                                aria-label="Booking attachments"
                                title="Booking attachments"
                              >
                                <button
                                  type="button"
                                  className="rounded p-0.5 text-amber-300 hover:text-amber-200"
                                  aria-label="Show booking attachments"
                                >
                                  <IconAttachment />
                                </button>
                                <div className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 w-64 -translate-x-1/2 rounded-md border border-zinc-700 bg-zinc-950 p-2 opacity-0 shadow-xl transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
                                  <p className="mb-1 text-[11px] uppercase tracking-wide text-zinc-500">Attachments</p>
                                  <ul className="space-y-1">
                                    {documentsByBookingId.get(booking.id)?.map((doc) => (
                                      <li key={doc.id} className="text-xs text-zinc-200">
                                        {doc.storagePath ? (
                                          <a
                                            className="pointer-events-auto hover:underline"
                                            href={`/api/travel/documents/${doc.id}/download`}
                                          >
                                            {doc.title}
                                          </a>
                                        ) : (
                                          <span>{doc.title}</span>
                                        )}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                        {canEditActiveTrip && (
                          <div className="flex items-center gap-1">
                            <IconButton
                              label="Edit reservation"
                              onClick={() => startEditBooking(booking)}
                              icon={<IconEdit />}
                            />
                            <IconButton
                              label="Remove reservation"
                              onClick={() => removeBooking(booking.id)}
                              icon={<IconTrash />}
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                {overview && overview.bookings.length === 0 && (
                  <p className="text-sm text-zinc-500">No reservations yet.</p>
                )}
              </div>
            </SectionCard>

            <SectionCard title="Checklist" className="bg-teal-950/20 border-teal-800/50">
              <div className="flex gap-2 mb-3">
                <input
                  value={newChecklistItem}
                  onChange={(e) => setNewChecklistItem(e.target.value)}
                  placeholder="Add checklist item"
                  className="flex-1 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
                />
                <button
                  onClick={addChecklistItem}
                  disabled={!activeTripId || !canEditActiveTrip}
                  className="rounded-md bg-teal-600 px-3 py-2 text-sm font-medium text-white hover:bg-teal-500 disabled:opacity-50"
                >
                  Add
                </button>
              </div>

              <div className="space-y-2 max-h-64 overflow-auto">
                {overview?.checklist.map((item) => (
                  <div
                    key={item.id}
                    className={`w-full rounded-md border px-3 py-2 text-left text-sm ${
                      item.done ? 'border-emerald-700 bg-emerald-900/20 text-zinc-400' : 'border-zinc-700 bg-zinc-900'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      {editingChecklistId === item.id ? (
                        <>
                          <input
                            value={editChecklistTitle}
                            onChange={(e) => setEditChecklistTitle(e.target.value)}
                            className="min-w-0 flex-1 rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm"
                          />
                          <button
                            onClick={() => saveChecklistEdits(item.id)}
                            className="rounded-md bg-teal-600 px-2 py-1 text-xs font-medium text-white hover:bg-teal-500"
                          >
                            Save
                          </button>
                          <button
                            onClick={cancelEditChecklistItem}
                            className="rounded-md bg-zinc-800 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-700"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => toggleChecklist(item)}
                            disabled={!canEditActiveTrip}
                            className={`min-w-0 flex-1 text-left ${item.done ? 'line-through' : ''} disabled:cursor-default`}
                          >
                            {item.title}
                          </button>
                          {canEditActiveTrip && (
                            <div className="flex items-center gap-1">
                              <IconButton
                                label="Edit checklist item"
                                onClick={() => startEditChecklistItem(item)}
                                icon={<IconEdit />}
                              />
                              <IconButton
                                label="Remove checklist item"
                                onClick={() => removeChecklistItem(item.id)}
                                icon={<IconTrash />}
                              />
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ))}
                {overview && overview.checklist.length === 0 && (
                  <p className="text-sm text-zinc-500">No checklist items yet.</p>
                )}
              </div>
            </SectionCard>

            <SectionCard title="Companions" className="bg-fuchsia-950/20 border-fuchsia-800/50">
              <div className="space-y-2 mb-3">
                <input
                  value={newCompanionName}
                  onChange={(e) => setNewCompanionName(e.target.value)}
                  placeholder="Name"
                  className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    value={newCompanionEmail}
                    onChange={(e) => setNewCompanionEmail(e.target.value)}
                    placeholder="Email"
                    className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
                  />
                  <input
                    value={newCompanionPhone}
                    onChange={(e) => setNewCompanionPhone(e.target.value)}
                    placeholder="Phone"
                    className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
                  />
                </div>
                <button
                  onClick={addCompanion}
                  disabled={!activeTripId || !canEditActiveTrip}
                  className="w-full rounded-md bg-fuchsia-600 px-3 py-2 text-sm font-medium text-white hover:bg-fuchsia-500 disabled:opacity-50"
                >
                  Add Companion
                </button>
              </div>

              <div className="space-y-2 max-h-64 overflow-auto">
                {overview?.companions.map((companion) => (
                  <div key={companion.id} className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm">
                    {editingCompanionId === companion.id ? (
                      <div className="space-y-2">
                        <input
                          value={editCompanionName}
                          onChange={(e) => setEditCompanionName(e.target.value)}
                          placeholder="Name"
                          className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            value={editCompanionEmail}
                            onChange={(e) => setEditCompanionEmail(e.target.value)}
                            placeholder="Email"
                            className="rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm"
                          />
                          <input
                            value={editCompanionPhone}
                            onChange={(e) => setEditCompanionPhone(e.target.value)}
                            placeholder="Phone"
                            className="rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm"
                          />
                        </div>
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => saveCompanionEdits(companion.id)}
                            className="rounded-md bg-fuchsia-600 px-2 py-1 text-xs font-medium text-white hover:bg-fuchsia-500"
                          >
                            Save
                          </button>
                          <button
                            onClick={cancelEditCompanion}
                            className="rounded-md bg-zinc-800 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-700"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-medium">{companion.name}</p>
                          <p className="text-xs text-zinc-400">
                            {companion.email ?? companion.phone ?? 'No contact info'}
                          </p>
                        </div>
                        {canEditActiveTrip && (
                          <div className="flex items-center gap-1">
                            <IconButton
                              label="Edit companion"
                              onClick={() => startEditCompanion(companion)}
                              icon={<IconEdit />}
                            />
                            <IconButton
                              label="Remove companion"
                              onClick={() => removeCompanion(companion.id)}
                              icon={<IconTrash />}
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                {overview && overview.companions.length === 0 && (
                  <p className="text-sm text-zinc-500">No companions yet.</p>
                )}
              </div>
            </SectionCard>

            <SectionCard title="Sharing" className="bg-violet-950/20 border-violet-800/50">
              {!activeTrip && <p className="text-sm text-zinc-500">Select a trip to manage sharing.</p>}
              {activeTrip && !canEditActiveTrip && (
                <p className="text-sm text-zinc-500">
                  Only the trip owner can manage sharing. You currently have view-only access.
                </p>
              )}
              {activeTrip && canEditActiveTrip && (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <input
                      value={shareEmail}
                      onChange={(e) => setShareEmail(e.target.value)}
                      placeholder="Share with user email"
                      className="flex-1 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
                    />
                    <button
                      onClick={shareTripByEmail}
                      className="rounded-md bg-violet-600 px-3 py-2 text-sm font-medium text-white hover:bg-violet-500"
                    >
                      Share
                    </button>
                  </div>

                  {shareSuggestions.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs uppercase tracking-wide text-zinc-500">
                        Suggestions from companions in Hub
                      </p>
                      <div className="space-y-1">
                        {shareSuggestions.map((suggestion) => (
                          <div
                            key={suggestion.user_id}
                            className="flex items-center justify-between rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs"
                          >
                            <span className="text-zinc-300">{suggestion.name ?? suggestion.email}</span>
                            <button
                              onClick={() => shareTripWithUser(suggestion.user_id)}
                              className="rounded bg-violet-700 px-2 py-1 text-[11px] text-white hover:bg-violet-600"
                            >
                              Share
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="space-y-1">
                    <p className="text-xs uppercase tracking-wide text-zinc-500">Shared with</p>
                    {tripShares.length === 0 && <p className="text-sm text-zinc-500">No shared users yet.</p>}
                    {tripShares.map((share) => (
                      <div
                        key={share.id}
                        className="flex items-center justify-between rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs"
                      >
                        <span className="text-zinc-300">{share.name ?? share.email}</span>
                        <button
                          onClick={() => revokeTripShare(share.id)}
                          className="rounded bg-zinc-800 px-2 py-1 text-[11px] text-zinc-300 hover:bg-zinc-700"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </SectionCard>

            <SectionCard title="Documents" className="bg-amber-950/20 border-amber-800/50">
              <div className="space-y-2 mb-3">
                <input
                  value={documentTitle}
                  onChange={(e) => setDocumentTitle(e.target.value)}
                  placeholder="Document title"
                  className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
                />
                <input
                  type="file"
                  accept={uploadConfig.allowed_mime.join(',')}
                  onChange={(e) => setDocumentFile(e.target.files?.[0] ?? null)}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
                />
                <select
                  value={documentBookingId ?? ''}
                  onChange={(e) => setDocumentBookingId(e.target.value ? Number(e.target.value) : null)}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
                >
                  <option value="">Link to reservation (optional)</option>
                  {(overview?.bookings ?? []).map((booking) => (
                    <option key={booking.id} value={booking.id}>
                      {booking.title}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-zinc-500">
                  Max {uploadConfig.max_mb} MB. Allowed: {uploadConfig.allowed_mime.join(', ')}
                </p>
                <button
                  onClick={uploadDocument}
                  disabled={!activeTripId || !documentFile || !canEditActiveTrip}
                  className="w-full rounded-md bg-amber-600 px-3 py-2 text-sm font-medium text-white hover:bg-amber-500 disabled:opacity-50"
                >
                  Upload Document
                </button>
              </div>

              <div className="space-y-2 max-h-64 overflow-auto">
                {overview?.documents.map((document) => (
                  <div key={document.id} className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="font-medium">{document.title}</p>
                        <p className="text-xs text-zinc-400">
                          {document.originalName ?? document.sourceUrl ?? 'Link-only document'}
                        </p>
                        {document.bookingId && (
                          <p className="text-[11px] text-zinc-500">
                            Linked to:{' '}
                            {overview?.bookings.find((booking) => booking.id === document.bookingId)?.title ??
                              `Reservation #${document.bookingId}`}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {document.storagePath && (
                          <a
                            href={`/api/travel/documents/${document.id}/download`}
                            className="rounded-md bg-zinc-800 p-1.5 text-zinc-200 hover:bg-zinc-700"
                            aria-label="Download document"
                            title="Download document"
                          >
                            <IconDownload />
                          </a>
                        )}
                        {canEditActiveTrip && (
                          <IconButton
                            label="Remove document"
                            onClick={() => removeDocument(document.id)}
                            icon={<IconTrash />}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {overview && overview.documents.length === 0 && (
                  <p className="text-sm text-zinc-500">No documents yet.</p>
                )}
              </div>
            </SectionCard>
          </div>
        </div>
      </section>
    </main>
  );
}

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2">
      <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="text-2xl font-semibold text-zinc-100">{value}</p>
    </div>
  );
}

function IconButton({ label, onClick, icon }: { label: string; onClick: () => void; icon: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="rounded-md bg-zinc-800 p-1.5 text-zinc-300 hover:bg-zinc-700"
      aria-label={label}
      title={label}
    >
      {icon}
    </button>
  );
}

function IconEdit() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
      <path d="M14.69 2.86a2 2 0 0 1 2.83 2.83l-8.4 8.4a1 1 0 0 1-.46.26l-3.4.85a.5.5 0 0 1-.61-.61l.85-3.4a1 1 0 0 1 .26-.46l8.4-8.4Zm1.41 1.42a1 1 0 0 0-1.41 0l-.88.88 1.41 1.41.88-.88a1 1 0 0 0 0-1.41ZM6.46 11.1l-.52 2.08 2.08-.52 6.68-6.68-1.41-1.41-6.68 6.68Z" />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
      <path d="M7.5 3a1 1 0 0 0-1 1v1H4a.5.5 0 0 0 0 1h.54l.72 9.07A2 2 0 0 0 7.26 17h5.48a2 2 0 0 0 1.99-1.93L15.46 6H16a.5.5 0 0 0 0-1h-2.5V4a1 1 0 0 0-1-1h-5Zm1 2V4h3v1h-3Zm-1.96 1 .71 8.93a1 1 0 0 0 1 .97h5.5a1 1 0 0 0 1-.97L15.46 6H6.54Z" />
    </svg>
  );
}

function IconDownload() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
      <path d="M10 3a.5.5 0 0 1 .5.5v7.29l2.15-2.14a.5.5 0 0 1 .7.7l-3 3a.5.5 0 0 1-.7 0l-3-3a.5.5 0 1 1 .7-.7L9.5 10.8V3.5A.5.5 0 0 1 10 3Zm-5 11a.5.5 0 0 1 .5.5V16h9v-1.5a.5.5 0 0 1 1 0V16a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1v-1.5a.5.5 0 0 1 .5-.5Z" />
    </svg>
  );
}

function IconAttachment() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21.44 11.05 12 20.5a5.5 5.5 0 0 1-7.78-7.78l9.55-9.55a3.5 3.5 0 1 1 4.95 4.95L8.9 18a1.5 1.5 0 1 1-2.12-2.12l8.49-8.48" />
    </svg>
  );
}
