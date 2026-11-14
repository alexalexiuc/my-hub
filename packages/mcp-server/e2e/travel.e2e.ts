import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getE2eEnv } from './helpers/env.js';
import { generateToken } from './helpers/token.js';
import { createMcpClient, parseToolResult, type McpClient } from './helpers/mcp-client.js';

interface Trip {
  id: number;
  name: string;
  destination: string | null;
}

interface Booking {
  id: number;
  tripId: number;
  bookingType: string;
  title: string;
  startAt: string | null;
  endAt: string | null;
}

interface DayNote {
  id: number;
  tripId: number;
  date: string;
  title: string | null;
  notes: string | null;
}

interface PlanTripResult {
  trip: Trip;
}

interface AddReservationResult {
  booking: Booking;
}

interface UpsertDayNoteResult {
  day: DayNote;
}

interface GetDayNotesResult {
  days: DayNote[];
}

interface DeleteDayNoteResult {
  id: number;
  date: string;
}

interface TripBriefResult {
  trip: { id: number };
  bookings: Booking[];
  dayNotes: DayNote[];
}

/**
 * E2e tests for the travel MCP sub-server.
 *
 * Exercises the full tool lifecycle via the MCP protocol:
 *   travel_plan_trip → travel_add_reservation_from_text → travel_get_trip_brief
 *   travel_upsert_day_note → travel_get_day_notes → travel_delete_day_note
 *   travel_remove_booking → (cleanup)
 *
 * A unique run ID is embedded in names so test data can be identified
 * among real data without relying on a test-only database.
 */
describe('travel — trip and booking lifecycle', () => {
  let client: McpClient;
  let tripId: number | undefined;
  let bookingId: number | undefined;

  const runId = Date.now().toString(36);
  const tripName = `[e2e:${runId}] Cyprus Holiday`;

  beforeAll(async () => {
    const { baseUrl } = getE2eEnv();
    const token = await generateToken();
    client = await createMcpClient(baseUrl, '/travel/mcp', token);
  });

  afterAll(async () => {
    // Best-effort cleanup in reverse order
    if (bookingId != null) {
      try {
        await client.callTool({ name: 'travel_remove_booking', arguments: { bookingId } });
      } catch {
        // Ignore
      }
    }
    await client.close();
  });

  it('travel_plan_trip creates a trip and returns it', async () => {
    const result = await client.callTool({
      name: 'travel_plan_trip',
      arguments: {
        name: tripName,
        destination: 'Paralimni, Cyprus',
        startAt: '2099-07-01T00:00:00Z',
        endAt: '2099-07-10T00:00:00Z',
        autoPrepareChecklist: false,
      },
    });

    expect(result.isError).toBeFalsy();
    const data = parseToolResult<PlanTripResult>(result);

    expect(data.trip.id).toBeGreaterThan(0);
    expect(data.trip.name).toBe(tripName);
    expect(data.trip.destination).toBe('Paralimni, Cyprus');

    tripId = data.trip.id;
  });

  it('travel_add_reservation_from_text adds a hotel booking', async () => {
    expect(tripId).toBeDefined();

    const result = await client.callTool({
      name: 'travel_add_reservation_from_text',
      arguments: {
        tripId,
        bookingText: 'Confirmation: your booking at Sunrise Hotel is confirmed for 1-5 July 2099.',
        bookingType: 'accommodation',
        title: `[e2e:${runId}] Sunrise Hotel`,
        provider: 'Sunrise Hotel',
        location: 'Paralimni, Cyprus',
        timezone: 'Asia/Nicosia',
        startAt: '2099-07-01T14:00:00Z',
        endAt: '2099-07-05T11:00:00Z',
      },
    });

    expect(result.isError).toBeFalsy();
    const data = parseToolResult<AddReservationResult>(result);

    expect(data.booking.id).toBeGreaterThan(0);
    expect(data.booking.tripId).toBe(tripId);
    expect(data.booking.bookingType).toBe('accommodation');
    expect(data.booking.title).toContain('Sunrise Hotel');

    bookingId = data.booking.id;
  });

  it('travel_get_trip_brief returns the trip with its booking', async () => {
    expect(tripId).toBeDefined();
    expect(bookingId).toBeDefined();

    const result = await client.callTool({
      name: 'travel_get_trip_brief',
      arguments: { tripId, include: ['bookings'] },
    });

    expect(result.isError).toBeFalsy();
    const data = parseToolResult<TripBriefResult>(result);

    expect(data.trip.id).toBe(tripId);
    expect(Array.isArray(data.bookings)).toBe(true);
    expect(data.bookings.some((b: { id: number }) => b.id === bookingId)).toBe(true);
  });

  it('travel://trips resource includes the created trip', async () => {
    expect(tripId).toBeDefined();

    const result = await client.readResource({ uri: 'travel://trips' });

    const raw = result.contents[0];
    expect(raw).toBeDefined();
    const data = JSON.parse(raw!.text as string) as { trips: Trip[]; count: number };

    expect(typeof data.count).toBe('number');
    expect(Array.isArray(data.trips)).toBe(true);
    const found = data.trips.find(t => t.id === tripId);
    expect(found).toBeDefined();
    expect(found!.name).toBe(tripName);
  });

  it('travel://upcoming resource returns a valid structure', async () => {
    const result = await client.readResource({ uri: 'travel://upcoming' });

    const raw = result.contents[0];
    expect(raw).toBeDefined();
    const data = JSON.parse(raw!.text as string) as {
      nextTrip: Trip | null;
      upcomingDepartures48h: unknown[];
    };

    expect(Array.isArray(data.upcomingDepartures48h)).toBe(true);
    expect(data.nextTrip === null || typeof data.nextTrip === 'object').toBe(true);
  });

  it('travel://upload-policy resource returns file constraints', async () => {
    const result = await client.readResource({ uri: 'travel://upload-policy' });

    const raw = result.contents[0];
    expect(raw).toBeDefined();
    const data = JSON.parse(raw!.text as string) as { maxMb: number; allowedMime: string[] };

    expect(data.maxMb).toBeGreaterThan(0);
    expect(Array.isArray(data.allowedMime)).toBe(true);
    expect(data.allowedMime.length).toBeGreaterThan(0);
  });
});

describe('travel — day note lifecycle', () => {
  let client: McpClient;
  let tripId: number | undefined;
  let dayNoteId: number | undefined;

  const runId = Date.now().toString(36);
  const tripName = `[e2e:${runId}] Day Notes Trip`;

  beforeAll(async () => {
    const { baseUrl } = getE2eEnv();
    const token = await generateToken();
    client = await createMcpClient(baseUrl, '/travel/mcp', token);

    // Create a trip to attach day notes to
    const result = await client.callTool({
      name: 'travel_plan_trip',
      arguments: {
        name: tripName,
        destination: 'Chișinău, Moldova',
        startAt: '2099-08-01T00:00:00Z',
        endAt: '2099-08-05T00:00:00Z',
        autoPrepareChecklist: false,
      },
    });
    const data = parseToolResult<PlanTripResult>(result);
    tripId = data.trip.id;
  });

  afterAll(async () => {
    if (dayNoteId != null) {
      try {
        await client.callTool({ name: 'travel_delete_day_note', arguments: { id: dayNoteId } });
      } catch {
        // Ignore
      }
    }
    await client.close();
  });

  it('travel_upsert_day_note creates a day note and returns it', async () => {
    expect(tripId).toBeDefined();

    const result = await client.callTool({
      name: 'travel_upsert_day_note',
      arguments: {
        tripId,
        date: '2099-08-01',
        title: 'Arrival day',
        notes: 'Pick up rental car. Check in to hotel.',
      },
    });

    expect(result.isError).toBeFalsy();
    const data = parseToolResult<UpsertDayNoteResult>(result);

    expect(data.day.id).toBeGreaterThan(0);
    expect(data.day.tripId).toBe(tripId);
    expect(data.day.date).toBe('2099-08-01');
    expect(data.day.title).toBe('Arrival day');
    expect(data.day.notes).toBe('Pick up rental car. Check in to hotel.');

    dayNoteId = data.day.id;
  });

  it('travel_upsert_day_note updates the same date without creating a duplicate', async () => {
    expect(tripId).toBeDefined();
    expect(dayNoteId).toBeDefined();

    const result = await client.callTool({
      name: 'travel_upsert_day_note',
      arguments: {
        tripId,
        date: '2099-08-01',
        title: 'Travel day',
        notes: 'Updated notes.',
      },
    });

    expect(result.isError).toBeFalsy();
    const data = parseToolResult<UpsertDayNoteResult>(result);

    // Must be the same row — not a new id
    expect(data.day.id).toBe(dayNoteId);
    expect(data.day.title).toBe('Travel day');
    expect(data.day.notes).toBe('Updated notes.');
  });

  it('travel_get_day_notes returns the day note', async () => {
    expect(tripId).toBeDefined();
    expect(dayNoteId).toBeDefined();

    const result = await client.callTool({
      name: 'travel_get_day_notes',
      arguments: { tripId },
    });

    expect(result.isError).toBeFalsy();
    const data = parseToolResult<GetDayNotesResult>(result);

    expect(Array.isArray(data.days)).toBe(true);
    const found = data.days.find(d => d.id === dayNoteId);
    expect(found).toBeDefined();
    expect(found!.date).toBe('2099-08-01');
    expect(found!.title).toBe('Travel day');
  });

  it('travel_delete_day_note removes the day note', async () => {
    expect(dayNoteId).toBeDefined();

    const result = await client.callTool({
      name: 'travel_delete_day_note',
      arguments: { id: dayNoteId },
    });

    expect(result.isError).toBeFalsy();
    const data = parseToolResult<DeleteDayNoteResult>(result);
    expect(data.id).toBe(dayNoteId);

    dayNoteId = undefined; // prevent afterAll double-delete
  });

  it('travel_get_day_notes no longer includes the deleted note', async () => {
    expect(tripId).toBeDefined();

    const result = await client.callTool({
      name: 'travel_get_day_notes',
      arguments: { tripId },
    });

    const data = parseToolResult<GetDayNotesResult>(result);
    expect(data.days.every(d => d.date !== '2099-08-01')).toBe(true);
  });

  it('travel_delete_day_note returns an error for a non-existent note', async () => {
    const result = await client.callTool({
      name: 'travel_delete_day_note',
      arguments: { id: 999_999_999 },
    });

    expect(result.isError).toBe(true);
  });
});

interface TripSummary {
  id: number;
  name: string;
  startAt: string | null;
  endAt: string | null;
  status: string;
  bookingCount: number;
  datesFromBookings: boolean;
}

interface BookingWithDetails extends Booking {
  costAmount: number | null;
  costCurrency: string;
  details: { kind: string; extra?: Record<string, unknown> } | null;
}

interface ChecklistItem {
  id: number;
  title: string;
  done: boolean;
}

/**
 * Trip management: travel_list_trips → travel_update_trip → travel_edit_booking (details, cost, move)
 * → travel_manage_checklist → travel_delete_trip (also the cleanup).
 */
describe('travel — trip management', () => {
  let client: McpClient;
  const tripIds: number[] = [];
  let bookingId: number | undefined;

  const runId = Date.now().toString(36);
  const tripName = `[e2e:${runId}] Undated Lisbon`;

  async function call<T>(name: string, args: Record<string, unknown>): Promise<T> {
    const result = await client.callTool({ name, arguments: args });
    expect(result.isError, JSON.stringify(result.content)).toBeFalsy();
    return parseToolResult<T>(result);
  }

  beforeAll(async () => {
    const { baseUrl } = getE2eEnv();
    const token = await generateToken();
    client = await createMcpClient(baseUrl, '/travel/mcp', token);
  });

  afterAll(async () => {
    for (const tripId of tripIds) {
      try {
        await client.callTool({ name: 'travel_delete_trip', arguments: { tripId } });
      } catch {
        // Ignore
      }
    }
    await client.close();
  });

  it("travel_list_trips shows an undated trip with its bookings' dates", async () => {
    const { trip } = await call<PlanTripResult>('travel_plan_trip', {
      name: tripName,
      destination: 'Lisbon, Portugal',
      autoPrepareChecklist: false,
    });
    tripIds.push(trip.id);
    const { booking } = await call<AddReservationResult>('travel_add_reservation_from_text', {
      tripId: trip.id,
      bookingText: 'Your stay at Casa Azul, 24-27 Nov 2098. Check-in after 14:00. Balance due on arrival.',
      bookingType: 'accommodation',
      title: `[e2e:${runId}] Casa Azul`,
      startAt: '2098-11-24T14:00:00Z',
      endAt: '2098-11-27T10:00:00Z',
      extra: { checkIn: 'after 14:00', balanceDue: '200 EUR' },
    });
    bookingId = booking.id;

    const { trips } = await call<{ trips: TripSummary[] }>('travel_list_trips', {
      status: ['planned'],
      from: '2098-11-01',
      to: '2098-11-30',
    });
    const found = trips.find(t => t.id === trip.id);
    expect(found).toMatchObject({ bookingCount: 1, datesFromBookings: true, status: 'planned' });
    expect(found!.startAt).toBe('2098-11-24T14:00:00.000Z');
    expect(found!.endAt).toBe('2098-11-27T10:00:00.000Z');

    const { trips: completed } = await call<{ trips: TripSummary[] }>('travel_list_trips', { status: ['completed'] });
    expect(completed.some(t => t.id === trip.id)).toBe(false);
  });

  it('travel_update_trip sets dates and cancels / reinstates a trip', async () => {
    const tripId = tripIds[0];
    const { trip } = await call<{ trip: TripSummary & { cancelledAt: string | null } }>('travel_update_trip', {
      tripId,
      startAt: '2098-11-24T00:00:00Z',
      endAt: '2098-11-28T00:00:00Z',
      cancelled: true,
    });
    expect(trip.startAt).toBe('2098-11-24T00:00:00.000Z');
    expect(trip.status).toBe('cancelled');

    const reinstated = await call<{ trip: TripSummary }>('travel_update_trip', { tripId, cancelled: false });
    expect(reinstated.trip.status).toBe('planned');

    const invalid = await client.callTool({
      name: 'travel_update_trip',
      arguments: { tripId, endAt: '2098-11-01T00:00:00Z' },
    });
    expect(invalid.isError).toBe(true);
  });

  it('travel_edit_booking deep-merges details, sets cost and moves the booking', async () => {
    const { booking } = await call<{ booking: BookingWithDetails }>('travel_edit_booking', {
      bookingId,
      costAmount: 412.5,
      costCurrency: 'eur',
      details: { extra: { checkIn: 'after 14:30', balanceDue: null } },
    });
    expect(booking.costAmount).toBe(412.5);
    expect(booking.costCurrency).toBe('EUR');
    expect(booking.details?.kind).toBe('accommodation');
    expect(booking.details?.extra).toEqual({ checkIn: 'after 14:30' });

    const { trip: other } = await call<PlanTripResult>('travel_plan_trip', {
      name: `[e2e:${runId}] Other trip`,
      destination: 'Porto, Portugal',
      autoPrepareChecklist: false,
    });
    tripIds.push(other.id);
    const moved = await call<{ booking: BookingWithDetails }>('travel_edit_booking', { bookingId, tripId: other.id });
    expect(moved.booking.tripId).toBe(other.id);
  });

  it('travel_manage_checklist adds, checks off and removes items', async () => {
    const tripId = tripIds[0];
    const added = await call<{ checklist: ChecklistItem[] }>('travel_manage_checklist', {
      tripId,
      add: ['Book airport taxi', 'Print vouchers'],
    });
    expect(added.checklist).toHaveLength(2);
    const [taxi, vouchers] = ['Book airport taxi', 'Print vouchers'].map(title =>
      added.checklist.find(i => i.title === title)!,
    );

    const result = await call<{ checklist: ChecklistItem[]; remaining: number }>('travel_manage_checklist', {
      tripId,
      update: [{ id: taxi!.id, done: true }],
      removeIds: [vouchers!.id],
    });
    expect(result.checklist).toEqual([expect.objectContaining({ id: taxi!.id, done: true })]);
    expect(result.remaining).toBe(0);
  });

  it('travel_delete_trip removes the trip', async () => {
    const tripId = tripIds.pop()!;
    await call('travel_delete_trip', { tripId });
    const { trips } = await call<{ trips: TripSummary[] }>('travel_list_trips', {});
    expect(trips.some(t => t.id === tripId)).toBe(false);
  });
});
