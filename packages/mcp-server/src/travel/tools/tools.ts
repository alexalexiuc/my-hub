import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { defineTool, withUserIdCheck } from '../../shared/toolsUtils';
import {
  TravelAddReservationFromTextInputSchema,
  TravelAddFlightSchema,
  TravelAddTransportSchema,
  TravelEditBookingSchema,
  TravelEditFlightSchema,
  TravelRemoveBookingSchema,
  travelAddReservationFromTextTool,
  travelAddFlightTool,
  travelAddTransportTool,
  travelEditBookingTool,
  travelEditFlightTool,
  travelRemoveBookingTool,
} from './bookings';
import {
  TravelUpsertDayNoteSchema,
  TravelGetDayNotesSchema,
  TravelDeleteDayNoteSchema,
  travelUpsertDayNoteTool,
  travelGetDayNotesTool,
  travelDeleteDayNoteTool,
} from './days';
import {
  TravelAttachDocumentLinkSchema,
  TravelGetTripBriefSchema,
  TravelPlanTripSchema,
  TravelPrepareTripChecklistSchema,
  TravelWhoIsTravelingSchema,
  travelAttachDocumentLinkTool,
  travelGetTripBriefTool,
  travelPlanTripTool,
  travelPrepareTripChecklistTool,
  travelWhoIsTravelingTool,
} from './tasks';

const travelTools = [
  defineTool({
    name: 'travel_plan_trip',
    description:
      'Plan a new trip from natural language details. Optionally seeds a practical checklist for preparation.',
    inputSchema: TravelPlanTripSchema.shape,
    annotations: { idempotentHint: false, destructiveHint: false },
    callback: travelPlanTripTool,
  }),
  defineTool({
    name: 'travel_add_reservation_from_text',
    description:
      'Capture a booking/reservation from raw text (email/snippet/chat) and attach it to an existing trip. ' +
      'Use this when the user pastes a confirmation email or snippet. ' +
      'For structured flight data where all details are already known, prefer travel_add_flight.',
    inputSchema: TravelAddReservationFromTextInputSchema.shape,
    annotations: { idempotentHint: false, destructiveHint: false },
    callback: travelAddReservationFromTextTool,
  }),
  defineTool({
    name: 'travel_add_flight',
    description:
      'Add a flight booking to a trip with all required flight details (flight number, route, departure time). ' +
      'Prefer this over travel_add_reservation_from_text when the model already has structured flight data. ' +
      'Automatically registers the flight for live tracking and status updates.',
    inputSchema: TravelAddFlightSchema.shape,
    annotations: { idempotentHint: false, destructiveHint: false },
    callback: travelAddFlightTool,
  }),
  defineTool({
    name: 'travel_add_transport',
    description:
      'Add a transport booking (train, bus, ferry, taxi, transfer, rental car, or car) to a trip with structured ' +
      'origin and destination details. Use this instead of travel_add_reservation_from_text when you already have ' +
      'structured route data — it stores origin/destination as structured data for rich display.',
    inputSchema: TravelAddTransportSchema.shape,
    annotations: { idempotentHint: false, destructiveHint: false },
    callback: travelAddTransportTool,
  }),
  defineTool({
    name: 'travel_edit_booking',
    description:
      'Correct or update details of an existing non-flight booking — title, times, confirmation number, notes, etc. ' +
      'For flight bookings use travel_edit_flight instead.',
    inputSchema: TravelEditBookingSchema.shape,
    annotations: { idempotentHint: false, destructiveHint: false },
    callback: travelEditBookingTool,
  }),
  defineTool({
    name: 'travel_edit_flight',
    description:
      'Correct or update details of an existing flight booking — seat, terminal, gate, times, or flight number. ' +
      'If the flight number changes, live tracking is automatically re-linked to the new flight.',
    inputSchema: TravelEditFlightSchema.shape,
    annotations: { idempotentHint: false, destructiveHint: false },
    callback: travelEditFlightTool,
  }),
  defineTool({
    name: 'travel_remove_booking',
    description:
      'Remove a booking from a trip. Use when the user says a reservation was cancelled, added by mistake, or is no longer needed.',
    inputSchema: TravelRemoveBookingSchema.shape,
    annotations: { idempotentHint: false, destructiveHint: true },
    callback: travelRemoveBookingTool,
  }),
  defineTool({
    name: 'travel_prepare_trip_checklist',
    description:
      'Prepare a trip checklist with default travel-readiness items. Use when user asks what to prepare before departure.',
    inputSchema: TravelPrepareTripChecklistSchema.shape,
    annotations: { idempotentHint: false, destructiveHint: false },
    callback: travelPrepareTripChecklistTool,
  }),
  defineTool({
    name: 'travel_who_is_traveling',
    description: 'Manage and summarize trip companions in one task-oriented call (add/update/remove/list).',
    inputSchema: TravelWhoIsTravelingSchema.shape,
    annotations: { idempotentHint: false, destructiveHint: false },
    callback: travelWhoIsTravelingTool,
  }),
  defineTool({
    name: 'travel_get_trip_brief',
    description:
      'Get a concise trip brief with itinerary counts, checklist, and companions. Defaults to next upcoming trip if trip_id is omitted.',
    inputSchema: TravelGetTripBriefSchema.shape,
    annotations: { readOnlyHint: true },
    callback: travelGetTripBriefTool,
  }),
  defineTool({
    name: 'travel_upsert_day_note',
    description:
      'Create or update a planning note for a specific calendar day within a trip. Use when the user wants to add a title or notes to a particular day.',
    inputSchema: TravelUpsertDayNoteSchema.shape,
    annotations: { idempotentHint: true, destructiveHint: false },
    callback: travelUpsertDayNoteTool,
  }),
  defineTool({
    name: 'travel_get_day_notes',
    description: 'Get all day-by-day planning notes for a trip, ordered by date.',
    inputSchema: TravelGetDayNotesSchema.shape,
    annotations: { readOnlyHint: true },
    callback: travelGetDayNotesTool,
  }),
  defineTool({
    name: 'travel_delete_day_note',
    description: 'Delete a day planning note by its ID.',
    inputSchema: TravelDeleteDayNoteSchema.shape,
    annotations: { idempotentHint: false, destructiveHint: true },
    callback: travelDeleteDayNoteTool,
  }),
  defineTool({
    name: 'travel_attach_document_link',
    description: 'Attach a document URL to a trip (tickets, boarding passes, visas, vouchers, etc).',
    inputSchema: TravelAttachDocumentLinkSchema.shape,
    annotations: { idempotentHint: false, destructiveHint: false },
    callback: travelAttachDocumentLinkTool,
  }),
];

export function registerTravelTools(server: McpServer): void {
  for (const tool of travelTools) {
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputSchema,
        annotations: tool.annotations,
      },
      withUserIdCheck(tool.callback, tool.skipUserIdCheck),
    );
  }
}
