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
describe.sequential('travel — trip and booking lifecycle', () => {
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
        await client.callTool({ name: 'travel_remove_booking', arguments: { booking_id: bookingId } });
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
        start_at: '2099-07-01T00:00:00Z',
        end_at: '2099-07-10T00:00:00Z',
        auto_prepare_checklist: false,
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
        trip_id: tripId,
        booking_text: 'Confirmation: your booking at Sunrise Hotel is confirmed for 1-5 July 2099.',
        booking_type: 'accommodation',
        title: `[e2e:${runId}] Sunrise Hotel`,
        provider: 'Sunrise Hotel',
        location: 'Paralimni, Cyprus',
        timezone: 'Asia/Nicosia',
        start_at: '2099-07-01T14:00:00Z',
        end_at: '2099-07-05T11:00:00Z',
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
      arguments: { trip_id: tripId },
    });

    expect(result.isError).toBeFalsy();
    const data = parseToolResult<TripBriefResult>(result);

    expect(data.trip.id).toBe(tripId);
    expect(data.bookings.some((b) => b.id === bookingId)).toBe(true);
  });
});

describe.sequential('travel — day note lifecycle', () => {
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
        start_at: '2099-08-01T00:00:00Z',
        end_at: '2099-08-05T00:00:00Z',
        auto_prepare_checklist: false,
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
        trip_id: tripId,
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
        trip_id: tripId,
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
      arguments: { trip_id: tripId },
    });

    expect(result.isError).toBeFalsy();
    const data = parseToolResult<GetDayNotesResult>(result);

    expect(Array.isArray(data.days)).toBe(true);
    const found = data.days.find((d) => d.id === dayNoteId);
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
      arguments: { trip_id: tripId },
    });

    const data = parseToolResult<GetDayNotesResult>(result);
    expect(data.days.every((d) => d.date !== '2099-08-01')).toBe(true);
  });

  it('travel_delete_day_note returns an error for a non-existent note', async () => {
    const result = await client.callTool({
      name: 'travel_delete_day_note',
      arguments: { id: 999_999_999 },
    });

    expect(result.isError).toBe(true);
  });
});
