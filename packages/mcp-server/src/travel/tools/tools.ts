import { McpServer } from '@modelcontextprotocol/server';
import { defineTool, registerTools } from '../../shared/toolsUtils';
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
import { TravelManagePlacesSchema, TravelGetPlacesSchema, travelManagePlacesTool, travelGetPlacesTool } from './places';
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
import {
  TravelDeleteTripSchema,
  TravelListTripsSchema,
  TravelManageChecklistSchema,
  TravelUpdateTripSchema,
  travelDeleteTripTool,
  travelListTripsTool,
  travelManageChecklistTool,
  travelUpdateTripTool,
} from './trips';

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
    name: 'travel_list_trips',
    description:
      "List the user's trips (owned and shared) with id, name, destination, dates, status and booking count. " +
      'Trips without their own dates show the dates of their bookings (datesFromBookings: true). ' +
      'Filter by status and/or a date range. Use this to find a tripId before calling other travel tools.',
    inputSchema: TravelListTripsSchema.shape,
    annotations: { readOnlyHint: true },
    callback: travelListTripsTool,
  }),
  defineTool({
    name: 'travel_update_trip',
    description:
      'Change an existing trip: name, destination, start/end dates, notes, colour, or mark it cancelled / reinstated. ' +
      'Only the fields you pass change; null clears a field. To create a trip use travel_plan_trip.',
    inputSchema: TravelUpdateTripSchema.shape,
    annotations: { idempotentHint: true, destructiveHint: false },
    callback: travelUpdateTripTool,
  }),
  defineTool({
    name: 'travel_delete_trip',
    description:
      'Permanently delete a trip with all its bookings, places, checklist, companions, day notes and documents. ' +
      'Use only for duplicate or mistaken trips and confirm with the user first; ' +
      'for a trip that will not happen prefer travel_update_trip with cancelled: true.',
    inputSchema: TravelDeleteTripSchema.shape,
    annotations: { idempotentHint: false, destructiveHint: true },
    callback: travelDeleteTripTool,
  }),
  defineTool({
    name: 'travel_add_reservation_from_text',
    description:
      'Capture a booking/reservation from raw text (email/snippet/chat) and attach it to an existing trip. ' +
      'Extract and pass a direct reservation URL in referenceLink whenever one exists in the source text. ' +
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
      'Include referenceLink when available (airline/OTA manage-booking URL). ' +
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
      'origin and destination details. Include referenceLink when available. Use this instead of travel_add_reservation_from_text when you already have ' +
      'structured route data — it stores origin/destination as structured data for rich display.',
    inputSchema: TravelAddTransportSchema.shape,
    annotations: { idempotentHint: false, destructiveHint: false },
    callback: travelAddTransportTool,
  }),
  defineTool({
    name: 'travel_edit_booking',
    description:
      'Correct or update an existing non-flight booking — title, times, confirmation number, notes, cost, ' +
      'structured details (deep-merged, e.g. details.extra.checkIn), or move it to another trip with tripId. ' +
      'Keep details consistent with changed times/notes. For flight bookings use travel_edit_flight instead.',
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
      'Prepare a trip checklist with default travel-readiness items. Use when user asks what to prepare before departure. ' +
      'To add custom items, check items off, rename or remove them use travel_manage_checklist.',
    inputSchema: TravelPrepareTripChecklistSchema.shape,
    annotations: { idempotentHint: false, destructiveHint: false },
    callback: travelPrepareTripChecklistTool,
  }),
  defineTool({
    name: 'travel_manage_checklist',
    description:
      'Add, rename, check off / un-check, or remove trip checklist items in one call. ' +
      'Item IDs come from travel_get_trip_brief with include: ["checklist"]. Returns the full updated checklist.',
    inputSchema: TravelManageChecklistSchema.shape,
    annotations: { idempotentHint: false, destructiveHint: false },
    callback: travelManageChecklistTool,
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
      'Get a trip summary with counts for all sections (bookings, places, checklist, companions, documents, day notes). ' +
      "Defaults to the next upcoming trip if tripId is omitted (trips without dates use their bookings' dates); " +
      'use travel_list_trips to find other trips. ' +
      'Pass include to retrieve full data for specific sections, e.g. include: ["bookings", "day_notes"]. ' +
      'Use travel_get_places for a standalone place list and travel_get_day_notes for enriched day notes.',
    inputSchema: TravelGetTripBriefSchema.shape,
    annotations: { readOnlyHint: true },
    callback: travelGetTripBriefTool,
  }),
  defineTool({
    name: 'travel_upsert_day_note',
    description:
      'Create or update a planning note for a specific calendar day within a trip. ' +
      'Use when the user wants to add a title, notes, or linked places to a particular day. ' +
      'To link places: obtain place IDs from travel_get_trip_brief; create new places first if they do not exist yet. ' +
      'Provide precise location data (street address or lat/lng) when creating places so the map chip works correctly.',
    inputSchema: TravelUpsertDayNoteSchema.shape,
    annotations: { idempotentHint: true, destructiveHint: false },
    callback: travelUpsertDayNoteTool,
  }),
  defineTool({
    name: 'travel_get_day_notes',
    description:
      'Get all day-by-day planning notes for a trip, ordered by date. ' +
      'Returns each day enriched with full place details for any linked place IDs.',
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
    name: 'travel_manage_places',
    description:
      'Add, update, or remove points of interest for a trip in one call. Returns the updated full places list with IDs. ' +
      'Always provide a precise address (e.g. "Piazza del Colosseo 1, 00184 Rome, Italy") and lat/lng when available — ' +
      'these power the map chips in the UI. ' +
      'After adding places, pass their returned IDs to travel_upsert_day_note to link them to specific days.',
    inputSchema: TravelManagePlacesSchema.shape,
    annotations: { idempotentHint: false, destructiveHint: false },
    callback: travelManagePlacesTool,
  }),
  defineTool({
    name: 'travel_get_places',
    description:
      'Get all points of interest for a trip with full details (id, name, location, lat/lng, priority, visited). ' +
      'Use this when you need place IDs to link to day notes, or to check what places already exist before adding.',
    inputSchema: TravelGetPlacesSchema.shape,
    annotations: { readOnlyHint: true },
    callback: travelGetPlacesTool,
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
  registerTools(server, travelTools);
}
